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
	versionRepository := postgresadapter.NewDocumentVersionRepository(db, minioClient, bucketName)
	taskRepository := postgresadapter.NewTaskRepository(db)
	lifecycleService := appservice.NewDocumentLifecycleService(documentRepository, versionRepository)

	lis, err := net.Listen("tcp", addr)
	if err != nil {
		slog.Error("failed to listen", "err", err)
		os.Exit(1)
	}

	server := grpcadapter.NewServer()
	server.AddRegistrar(grpcadapter.NewDocumentHandler(lifecycleService))
	server.AddRegistrar(grpcadapter.NewTaskOrchestrationHandler(taskRepository))
	server.RegisterServices()

	slog.Info("document-service gRPC listening", "addr", addr)

	if err := server.GRPCServer().Serve(lis); err != nil {
		slog.Error("failed to serve", "err", err)
		os.Exit(1)
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
			ADD COLUMN IF NOT EXISTS current_version_number BIGINT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS current_object_key TEXT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS current_object_version_id TEXT`,
		`ALTER TABLE documents
			ADD COLUMN IF NOT EXISTS owner_user_name TEXT`,
		`ALTER TABLE document_versions
			ADD COLUMN IF NOT EXISTS object_key TEXT`,
		`ALTER TABLE document_versions
			ADD COLUMN IF NOT EXISTS object_version_id TEXT`,
		`DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_name = 'document_versions'
				  AND column_name = 'status'
			) THEN
				ALTER TABLE document_versions ALTER COLUMN status DROP NOT NULL;
			END IF;
		END $$`,
		`UPDATE documents SET current_version_number = COALESCE(current_version_number, version, 1)`,
		`ALTER TABLE documents ALTER COLUMN current_version_number SET DEFAULT 1`,
		`ALTER TABLE documents ALTER COLUMN current_version_number SET NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_document_versions_document_id_version ON document_versions(document_id, version_number DESC)`,
	}

	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}

	return nil
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
