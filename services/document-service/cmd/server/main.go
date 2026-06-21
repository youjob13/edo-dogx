package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"os"
	"strconv"
	"time"

	grpcadapter "edo/services/document-service/internal/adapters/inbound/grpc"
	postgresadapter "edo/services/document-service/internal/adapters/outbound/postgres"
	appservice "edo/services/document-service/internal/application/service"

	_ "github.com/lib/pq"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

func main() {
	addr := os.Getenv("GRPC_ADDR")
	if addr == "" {
		addr = ":50052"
	}

	db, err := connectPostgres()
	if err != nil {
		slog.Error("failed to connect postgres", "err", err)
		os.Exit(1)
	}
	defer db.Close()
	if err := ensureDocumentSchema(db); err != nil {
		slog.Error("failed to ensure document schema", "err", err)
		os.Exit(1)
	}
	if err := seedExampleProducts(db); err != nil {
		slog.Error("failed to seed example products", "err", err)
		os.Exit(1)
	}
	if err := seedExampleDocumentsAndTasks(db); err != nil {
		slog.Error("failed to seed example documents and tasks", "err", err)
		os.Exit(1)
	}

	minioClient, bucketName, err := connectMinIO()
	if err != nil {
		slog.Error("failed to connect minio", "err", err)
		os.Exit(1)
	}

	presignedExpirySeconds, err := strconv.Atoi(getEnv("MINIO_PRESIGNED_EXPIRY_SECONDS", "900"))
	if err != nil {
		slog.Error("invalid MINIO_PRESIGNED_EXPIRY_SECONDS", "err", err)
		os.Exit(1)
	}

	publicMinIOURL, err := getOptionalURL("MINIO_PUBLIC_BASE_URL")
	if err != nil {
		slog.Error("invalid MINIO_PUBLIC_BASE_URL", "err", err)
		os.Exit(1)
	}

	publicMinIOClient, err := connectPublicMinIO(publicMinIOURL)
	if err != nil {
		slog.Error("invalid public minio client configuration", "err", err)
		os.Exit(1)
	}

	documentRepository := postgresadapter.NewDocumentRepository(
		db,
		minioClient,
		publicMinIOClient,
		bucketName,
		time.Duration(presignedExpirySeconds)*time.Second,
	)
	workflowRepository := postgresadapter.NewDocumentWorkflowRepository(db)
	versionRepository := postgresadapter.NewDocumentVersionRepository(db, minioClient, bucketName)
	taskRepository := postgresadapter.NewTaskRepository(db)
	activityRepository := postgresadapter.NewActivityRepository(db)
	lifecycleService := appservice.NewDocumentLifecycleService(documentRepository, versionRepository)
	workflowService := appservice.NewDocumentWorkflowService(workflowRepository)
	activityService := appservice.NewActivityService(activityRepository)
	searchSyncClient, err := grpcadapter.NewSearchProjectionSyncClient(getEnv("SEARCH_NOTIFICATION_SERVICE_GRPC_ADDR", "search-notification-service:50055"))
	if err != nil {
		slog.Error("failed to initialize search projection sync client", "err", err)
		os.Exit(1)
	}
	notificationClient, err := grpcadapter.NewNotificationClient(getEnv("NOTIFICATION_SERVICE_GRPC_ADDR", "notification-service:50056"))
	if err != nil {
		slog.Error("failed to initialize notification client", "err", err)
		os.Exit(1)
	}

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := grpcadapter.NewServer()
	server.AddRegistrar(grpcadapter.NewDocumentHandler(lifecycleService, workflowService, activityService, searchSyncClient))
	server.AddRegistrar(grpcadapter.NewTaskOrchestrationHandler(taskRepository, activityService, searchSyncClient, notificationClient))
	server.RegisterServices()
	go runActivityRetentionCleanup(activityService)

	slog.Info("document-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
	}
}

func runActivityRetentionCleanup(activityService *appservice.ActivityService) {
	if activityService == nil {
		return
	}

	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()
	for range ticker.C {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		_, err := activityService.CleanupExpired(ctx, 90)
		cancel()
		if err != nil {
			slog.Warn("activity retention cleanup failed", "err", err)
		}
	}
}

func connectPostgres() (*sql.DB, error) {
	port, err := strconv.Atoi(getEnv("POSTGRES_PORT", "5432"))
	if err != nil {
		return nil, fmt.Errorf("invalid POSTGRES_PORT: %w", err)
	}

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		getEnv("POSTGRES_HOST", "postgres"),
		port,
		getEnv("POSTGRES_USER", "edo_user"),
		getEnv("POSTGRES_PASSWORD", ""),
		getEnv("POSTGRES_DB", "edo"),
		getEnv("POSTGRES_SSLMODE", "disable"),
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, err
	}

	return db, nil
}

func ensureDocumentSchema(db *sql.DB) error {
	statements := []string{
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'`,
		`ALTER TABLE document_versions
			ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'`,
		`UPDATE documents SET status = COALESCE(NULLIF(status, ''), 'DRAFT')`,
		`UPDATE document_versions SET status = COALESCE(NULLIF(status, ''), 'DRAFT')`,
		`ALTER TABLE documents ALTER COLUMN status SET DEFAULT 'DRAFT'`,
		`ALTER TABLE documents ALTER COLUMN status SET NOT NULL`,
		`ALTER TABLE document_versions ALTER COLUMN status SET DEFAULT 'DRAFT'`,
		`ALTER TABLE document_versions ALTER COLUMN status SET NOT NULL`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS current_version_number BIGINT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS current_object_key TEXT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS current_object_version_id TEXT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS owner_user_name TEXT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS organization_id TEXT`,
		`ALTER TABLE document_versions
			ADD COLUMN IF NOT EXISTS object_key TEXT`,
		`ALTER TABLE document_versions
			ADD COLUMN IF NOT EXISTS object_version_id TEXT`,
		`UPDATE documents SET current_version_number = COALESCE(current_version_number, version, 1)`,
		`UPDATE documents SET organization_id = COALESCE(NULLIF(organization_id, ''), 'org-main')`,
		`ALTER TABLE documents ALTER COLUMN current_version_number SET DEFAULT 1`,
		`ALTER TABLE documents ALTER COLUMN current_version_number SET NOT NULL`,
		`ALTER TABLE documents ALTER COLUMN organization_id SET DEFAULT 'org-main'`,
		`ALTER TABLE documents ALTER COLUMN organization_id SET NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id_version ON document_versions(document_id, version_number DESC)`,
		`CREATE TABLE IF NOT EXISTS document_workflows (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
			organization_id TEXT NOT NULL,
			submitted_version BIGINT NOT NULL,
			status VARCHAR(32) NOT NULL,
			submitted_by_user_id TEXT NOT NULL,
			approver_user_id TEXT NOT NULL DEFAULT '',
			decision_comment TEXT,
			submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			decided_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_document_workflows_document UNIQUE (document_id)
		)`,
		`CREATE TABLE IF NOT EXISTS document_workflow_events (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			workflow_id UUID NOT NULL REFERENCES document_workflows(id) ON DELETE CASCADE,
			document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
			actor_user_id TEXT NOT NULL,
			event_type VARCHAR(32) NOT NULL,
			previous_status VARCHAR(32) NOT NULL,
			new_status VARCHAR(32) NOT NULL,
			document_version BIGINT NOT NULL,
			comment TEXT,
			occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_document_workflows_organization ON document_workflows(organization_id)`,
		`CREATE INDEX IF NOT EXISTS idx_document_workflows_approver_status ON document_workflows(approver_user_id, status)`,
		`CREATE INDEX IF NOT EXISTS idx_document_workflows_status_submitted ON document_workflows(status, submitted_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_document_workflow_events_document ON document_workflow_events(document_id, occurred_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_document_workflow_events_workflow ON document_workflow_events(workflow_id, occurred_at ASC)`,
		`ALTER TABLE tasks
			ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES task_boards(id) ON DELETE SET NULL`,
		`ALTER TABLE task_attachments
			ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE RESTRICT`,
		`ALTER TABLE task_attachments
			ADD COLUMN IF NOT EXISTS title VARCHAR(300) NOT NULL DEFAULT ''`,
		`ALTER TABLE task_attachments
			ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'GENERAL'`,
		`ALTER TABLE task_attachments
			ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'DRAFT'`,
		`ALTER TABLE organization_members
			ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}'`,
		`ALTER TABLE organization_members
			ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
		`ALTER TABLE task_board_members
			ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'MEMBER'`,
		`ALTER TABLE tasks
			ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT`,
		`ALTER TABLE tasks
			ADD COLUMN IF NOT EXISTS updated_by_user_name TEXT`,
		`DO $$
		BEGIN
			IF NOT EXISTS (
				SELECT 1
				FROM pg_constraint
				WHERE conname = 'uq_task_attachments_task_document'
			) THEN
				ALTER TABLE task_attachments
				ADD CONSTRAINT uq_task_attachments_task_document UNIQUE (task_id, document_id);
			END IF;
		END $$`,
		`WITH duplicate_attachments AS (
			SELECT id
			FROM (
				SELECT
					id,
					ROW_NUMBER() OVER (
						PARTITION BY document_id
						ORDER BY created_at ASC, id ASC
					) AS row_num
				FROM task_attachments
			) ranked
			WHERE ranked.row_num > 1
		)
		DELETE FROM task_attachments
		WHERE id IN (SELECT id FROM duplicate_attachments)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_task_attachments_document_id
			ON task_attachments(document_id)`,
		`CREATE TABLE IF NOT EXISTS activity_events (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			organization_id TEXT NOT NULL,
			actor_user_id TEXT NOT NULL,
			actor_user_name TEXT NOT NULL,
			entity_type VARCHAR(32) NOT NULL,
			entity_id TEXT NOT NULL,
			action_type VARCHAR(64) NOT NULL,
			summary TEXT NOT NULL,
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			document_id UUID NULL,
			task_id UUID NULL,
			board_id UUID NULL
		)`,
		`CREATE TABLE IF NOT EXISTS activity_event_subjects (
			event_id UUID NOT NULL REFERENCES activity_events(id) ON DELETE CASCADE,
			subject_type VARCHAR(32) NOT NULL,
			subject_id TEXT NOT NULL,
			PRIMARY KEY (event_id, subject_type, subject_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_events_org_occurred ON activity_events(organization_id, occurred_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_events_entity ON activity_events(entity_type, entity_id)`,
		`CREATE INDEX IF NOT EXISTS idx_activity_event_subjects_filter ON activity_event_subjects(subject_type, subject_id, event_id)`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func seedExampleProducts(db *sql.DB) error {
	const seedSQL = `
		INSERT INTO organization_members (organization_id, user_id, full_name, department, email, roles)
		VALUES (
			'org-main',
			'gateway-user',
			'Системный пользователь',
			'ЭДО',
			'gateway-user@localhost',
			ARRAY['edms.user', 'edms.admin']
		)
		ON CONFLICT (organization_id, user_id) DO NOTHING;

		WITH seed_documents (
			id,
			title,
			category,
			status,
			owner_user_id,
			owner_user_name,
			content_document_json
		) AS (
			VALUES
			(
				'11111111-1111-4111-8111-111111111111'::uuid,
				'Дверь противопожарная ДПМ-01',
				'PRODUCT',
				'DRAFT',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'product', jsonb_build_object(
							'name', 'Дверь противопожарная ДПМ-01',
							'model', 'ДПМ-01',
							'type', 'Противопожарная дверь',
							'description', 'Металлическая дверь для эвакуационных выходов и технических помещений. Пример карточки изделия с паспортом и действующим сертификатом.'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph'))
				)
			),
			(
				'22222222-2222-4222-8222-222222222222'::uuid,
				'Люк противопожарный ЛПМ-60',
				'PRODUCT',
				'DRAFT',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'product', jsonb_build_object(
							'name', 'Люк противопожарный ЛПМ-60',
							'model', 'ЛПМ-60',
							'type', 'Противопожарный люк',
							'description', 'Люк для инженерных шахт с пределом огнестойкости EI 60. Пример изделия с сертификатом, срок которого скоро истекает.'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph'))
				)
			),
			(
				'33333333-3333-4333-8333-333333333333'::uuid,
				'Ворота секционные ВС-EI60',
				'PRODUCT',
				'DRAFT',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'product', jsonb_build_object(
							'name', 'Ворота секционные ВС-EI60',
							'model', 'ВС-EI60',
							'type', 'Противопожарные ворота',
							'description', 'Секционные ворота для складских и производственных зон. Пример изделия с просроченным сертификатом для проверки предупреждений.'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph'))
				)
			),
			(
				'44444444-4444-4444-8444-444444444444'::uuid,
				'Паспорт изделия ДПМ-01',
				'GENERAL',
				'APPROVED',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'edoMvp', jsonb_build_object(
							'documentType', 'PRODUCT_PASSPORT',
							'productId', '11111111-1111-4111-8111-111111111111',
							'productName', 'Дверь противопожарная ДПМ-01',
							'productModel', 'ДПМ-01'
						)
					),
					'content', jsonb_build_array(
						jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 1), 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Паспорт изделия ДПМ-01'))),
						jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Назначение: установка в противопожарных преградах эвакуационных и технических помещений.')))
					)
				)
			),
			(
				'55555555-5555-4555-8555-555555555555'::uuid,
				'Сертификат соответствия ДПМ-01',
				'GENERAL',
				'APPROVED',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'edoMvp', jsonb_build_object(
							'documentType', 'CERTIFICATE',
							'productId', '11111111-1111-4111-8111-111111111111',
							'productName', 'Дверь противопожарная ДПМ-01',
							'productModel', 'ДПМ-01',
							'certificateNumber', 'RU-C-DEMO-001',
							'issueDate', '2026-01-15',
							'expiryDate', '2027-01-15'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Сертификат подтверждает соответствие требованиям пожарной безопасности.'))))
				)
			),
			(
				'66666666-6666-4666-8666-666666666666'::uuid,
				'Паспорт изделия ЛПМ-60',
				'GENERAL',
				'APPROVED',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'edoMvp', jsonb_build_object(
							'documentType', 'PRODUCT_PASSPORT',
							'productId', '22222222-2222-4222-8222-222222222222',
							'productName', 'Люк противопожарный ЛПМ-60',
							'productModel', 'ЛПМ-60'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Паспорт содержит сведения о комплектации, монтаже и обслуживании люка.'))))
				)
			),
			(
				'77777777-7777-4777-8777-777777777777'::uuid,
				'Сертификат соответствия ЛПМ-60',
				'GENERAL',
				'APPROVED',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'edoMvp', jsonb_build_object(
							'documentType', 'CERTIFICATE',
							'productId', '22222222-2222-4222-8222-222222222222',
							'productName', 'Люк противопожарный ЛПМ-60',
							'productModel', 'ЛПМ-60',
							'certificateNumber', 'RU-C-DEMO-002',
							'issueDate', '2025-07-20',
							'expiryDate', '2026-07-10'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Сертификат скоро истекает и должен попасть в зону внимания ответственных сотрудников.'))))
				)
			),
			(
				'88888888-8888-4888-8888-888888888888'::uuid,
				'Сертификат соответствия ВС-EI60',
				'GENERAL',
				'APPROVED',
				'gateway-user',
				'Системный пользователь',
				jsonb_build_object(
					'type', 'doc',
					'attrs', jsonb_build_object(
						'edoMvp', jsonb_build_object(
							'documentType', 'CERTIFICATE',
							'productId', '33333333-3333-4333-8333-333333333333',
							'productName', 'Ворота секционные ВС-EI60',
							'productModel', 'ВС-EI60',
							'certificateNumber', 'RU-C-DEMO-003',
							'issueDate', '2024-03-01',
							'expiryDate', '2026-05-30'
						)
					),
					'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Просроченный сертификат добавлен как демонстрационный пример контроля рисков.'))))
				)
			)
		),
		inserted AS (
			INSERT INTO documents (
				id,
				title,
				category,
				organization_id,
				status,
				owner_user_id,
				owner_user_name,
				version,
				current_version_number,
				current_object_key,
				current_object_version_id,
				content_document_json
			)
			SELECT
				id,
				title,
				category,
				'org-main',
				status,
				owner_user_id,
				owner_user_name,
				1,
				1,
				'seed/documents/' || id::text || '.json',
				'seed-v1',
				content_document_json
			FROM seed_documents
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		)
		INSERT INTO document_versions (
			document_id,
			version_number,
			title,
			category,
			status,
			changed_by_user_id,
			change_summary,
			object_key,
			object_version_id,
			content_document_json
		)
		SELECT
			seed_documents.id,
			1,
			seed_documents.title,
			seed_documents.category,
			seed_documents.status,
			seed_documents.owner_user_id,
			'example product seed',
			'seed/documents/' || seed_documents.id::text || '.json',
			'seed-v1',
			seed_documents.content_document_json
		FROM seed_documents
		INNER JOIN inserted ON inserted.id = seed_documents.id
		ON CONFLICT (document_id, version_number) DO NOTHING;
	`

	_, err := db.Exec(seedSQL)
	return err
}

func seedExampleDocumentsAndTasks(db *sql.DB) error {
	const seedSQL = `
		INSERT INTO organization_members (organization_id, user_id, full_name, department, email, roles)
		VALUES
			('org-main', 'danil.rodionov', 'Данил Родионов', 'Разработки', 'danil.rodionov@localhost', ARRAY['edms.user', 'edms.admin']),
			('org-main', 'viktor.shemetov', 'Виктор Шеметов', 'Разработки', 'viktor.shemetov@localhost', ARRAY['edms.user', 'edms.approver']),
			('org-main', 'vasiliy.parushev', 'Василий Порышев', 'Разработки', 'vasiliy.parushev@localhost', ARRAY['edms.user']),
			('org-main', 'ekaterina.smirnova', 'Екатерина Смирнова', 'Финансы', 'ekaterina.smirnova@localhost', ARRAY['edms.user', 'edms.finance', 'edms.approver'])
		ON CONFLICT (organization_id, user_id) DO NOTHING;

		INSERT INTO task_boards (id, organization_id, name, description)
		VALUES (
			'99999999-9999-4999-8999-999999999999'::uuid,
			'org-main',
			'Демо-доска ЭДО',
			'Пример задач по согласованию и обработке документов'
		)
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO task_board_members (board_id, user_id, full_name, department, email, role)
		VALUES
			('99999999-9999-4999-8999-999999999999'::uuid, 'danil.rodionov', 'Данил Родионов', 'Разработки', 'danil.rodionov@localhost', 'OWNER'),
			('99999999-9999-4999-8999-999999999999'::uuid, 'viktor.shemetov', 'Виктор Шеметов', 'Разработки', 'viktor.shemetov@localhost', 'MEMBER'),
			('99999999-9999-4999-8999-999999999999'::uuid, 'vasiliy.parushev', 'Василий Порышев', 'Разработки', 'vasiliy.parushev@localhost', 'MEMBER'),
			('99999999-9999-4999-8999-999999999999'::uuid, 'ekaterina.smirnova', 'Екатерина Смирнова', 'Финансы', 'ekaterina.smirnova@localhost', 'MANAGER')
		ON CONFLICT (board_id, user_id) DO NOTHING;

		WITH seed_documents (
			id,
			title,
			category,
			status,
			owner_user_id,
			owner_user_name,
			content_document_json
		) AS (
			VALUES
			(
				'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
				'Договор поставки противопожарных дверей',
				'GENERAL',
				'DRAFT',
				'danil.rodionov',
				'Данил Родионов',
				jsonb_build_object(
					'type', 'doc',
					'content', jsonb_build_array(
						jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 1), 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Договор поставки'))),
						jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Поставка противопожарных дверей ДПМ-01 для объекта заказчика.')))
					)
				)
			),
			(
				'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
				'Счет на оплату партии ЛПМ-60',
				'FINANCE',
				'IN_REVIEW',
				'ekaterina.smirnova',
				'Екатерина Смирнова',
				jsonb_build_object(
					'type', 'doc',
					'content', jsonb_build_array(
						jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 1), 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Счет на оплату'))),
						jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Оплата партии противопожарных люков ЛПМ-60 по спецификации.')))
					)
				)
			),
			(
				'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
				'Акт приемки ворот ВС-EI60',
				'GENERAL',
				'APPROVED',
				'viktor.shemetov',
				'Виктор Шеметов',
				jsonb_build_object(
					'type', 'doc',
					'content', jsonb_build_array(
						jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 1), 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Акт приемки'))),
						jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Приемка секционных противопожарных ворот после монтажа.')))
					)
				)
			),
			(
				'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
				'Приказ о назначении ответственного за сертификаты',
				'HR',
				'DRAFT',
				'vasiliy.parushev',
				'Василий Порышев',
				jsonb_build_object(
					'type', 'doc',
					'content', jsonb_build_array(
						jsonb_build_object('type', 'heading', 'attrs', jsonb_build_object('level', 1), 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Приказ'))),
						jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', 'Назначить ответственного за контроль сроков действия сертификатов продукции.')))
					)
				)
			)
		),
		inserted AS (
			INSERT INTO documents (
				id,
				title,
				category,
				organization_id,
				status,
				owner_user_id,
				owner_user_name,
				version,
				current_version_number,
				current_object_key,
				current_object_version_id,
				content_document_json
			)
			SELECT
				id,
				title,
				category,
				'org-main',
				status,
				owner_user_id,
				owner_user_name,
				1,
				1,
				'seed/documents/' || id::text || '.json',
				'seed-v1',
				content_document_json
			FROM seed_documents
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		)
		INSERT INTO document_versions (
			document_id,
			version_number,
			title,
			category,
			status,
			changed_by_user_id,
			change_summary,
			object_key,
			object_version_id,
			content_document_json
		)
		SELECT
			seed_documents.id,
			1,
			seed_documents.title,
			seed_documents.category,
			seed_documents.status,
			seed_documents.owner_user_id,
			'example document seed',
			'seed/documents/' || seed_documents.id::text || '.json',
			'seed-v1',
			seed_documents.content_document_json
		FROM seed_documents
		INNER JOIN inserted ON inserted.id = seed_documents.id
		ON CONFLICT (document_id, version_number) DO NOTHING;

		INSERT INTO tasks (
			id,
			board_id,
			title,
			description,
			status,
			task_type,
			creator_user_id,
			creator_user_name,
			assignee_user_id,
			assignee_user_name,
			approver_user_id,
			approver_user_name,
			decision,
			decision_comment,
			due_date
		)
		VALUES
			(
				'aaaaaaaa-1111-4111-8111-aaaaaaaa1111'::uuid,
				'99999999-9999-4999-8999-999999999999'::uuid,
				'Проверить договор поставки',
				'Проверить реквизиты, сроки поставки и перечень изделий перед отправкой на согласование.',
				'PENDING',
				'approval',
				'danil.rodionov',
				'Данил Родионов',
				'viktor.shemetov',
				'Виктор Шеметов',
				'ekaterina.smirnova',
				'Екатерина Смирнова',
				NULL,
				NULL,
				CURRENT_DATE + 5
			),
			(
				'bbbbbbbb-2222-4222-8222-bbbbbbbb2222'::uuid,
				'99999999-9999-4999-8999-999999999999'::uuid,
				'Согласовать счет на оплату',
				'Проверить сумму, НДС и соответствие счета спецификации.',
				'IN_REVIEW',
				'approval',
				'danil.rodionov',
				'Данил Родионов',
				'ekaterina.smirnova',
				'Екатерина Смирнова',
				'viktor.shemetov',
				'Виктор Шеметов',
				NULL,
				NULL,
				CURRENT_DATE + 2
			),
			(
				'cccccccc-3333-4333-8333-cccccccc3333'::uuid,
				'99999999-9999-4999-8999-999999999999'::uuid,
				'Подготовить комплект документов для архива',
				'Собрать акт приемки и действующие сертификаты по воротам ВС-EI60.',
				'APPROVED',
				'general',
				'viktor.shemetov',
				'Виктор Шеметов',
				'vasiliy.parushev',
				'Василий Порышев',
				NULL,
				NULL,
				'approved',
				'Комплект подготовлен.',
				CURRENT_DATE - 1
			)
		ON CONFLICT (id) DO NOTHING;

		INSERT INTO task_attachments (task_id, document_id, title, category, status)
		VALUES
			('aaaaaaaa-1111-4111-8111-aaaaaaaa1111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'Договор поставки противопожарных дверей', 'GENERAL', 'DRAFT'),
			('bbbbbbbb-2222-4222-8222-bbbbbbbb2222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'Счет на оплату партии ЛПМ-60', 'FINANCE', 'IN_REVIEW'),
			('cccccccc-3333-4333-8333-cccccccc3333'::uuid, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'Акт приемки ворот ВС-EI60', 'GENERAL', 'APPROVED')
		ON CONFLICT DO NOTHING;
	`

	_, err := db.Exec(seedSQL)
	return err
}

func connectMinIO() (*minio.Client, string, error) {
	endpoint := getEnv("MINIO_ENDPOINT", "minio:9000")
	bucketName := getEnv("MINIO_BUCKET", "edo-exports")
	client, err := newMinIOClient(endpoint, getEnv("MINIO_USE_SSL", "false") == "true")
	if err != nil {
		return nil, "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	exists, err := client.BucketExists(ctx, bucketName)
	if err != nil {
		return nil, "", err
	}
	if !exists {
		if err := client.MakeBucket(ctx, bucketName, minio.MakeBucketOptions{}); err != nil {
			return nil, "", err
		}
	}
	if err := client.EnableVersioning(ctx, bucketName); err != nil {
		return nil, "", err
	}

	return client, bucketName, nil
}

func connectPublicMinIO(publicURL *url.URL) (*minio.Client, error) {
	if publicURL == nil {
		return nil, nil
	}

	return newMinIOClient(publicURL.Host, publicURL.Scheme == "https")
}

func newMinIOClient(endpoint string, secure bool) (*minio.Client, error) {
	accessKey := getEnv("MINIO_ACCESS_KEY", "minioadmin")
	secretKey := getEnv("MINIO_SECRET_KEY", "minioadmin")
	region := getEnv("MINIO_REGION", "us-east-1")

	return minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: secure,
		Region: region,
	})
}

func getEnv(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getOptionalURL(key string) (*url.URL, error) {
	value := os.Getenv(key)
	if value == "" {
		return nil, nil
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return nil, err
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("%s must include scheme and host", key)
	}

	return parsed, nil
}
