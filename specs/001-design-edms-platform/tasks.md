# Tasks: Scalable EDMS Platform

**Input**: Design documents from `/specs/001-design-edms-platform/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Validation**: Use manual acceptance validation, lint/build checks, and quickstart execution steps. Do not add automated test authoring/execution tasks under current governance.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare infrastructure and shared configuration for the EDMS implementation.

- [ ] T001 Add Elasticsearch service and network wiring in docker-compose.yml
- [ ] T002 Add EDMS environment variables for search/signature/notifications in README.md
- [ ] T003 [P] Add Elasticsearch client dependency in services/service/go.mod
- [ ] T004 [P] Add gateway DTO/runtime dependencies for EDMS contracts in apps/gateway/package.json
- [ ] T005 [P] Register EDMS feature routes in frontend routing config in apps/frontend/src/app/app.routes.ts
- [ ] T006 Define EDMS bounded-context overview and module map in specs/001-design-edms-platform/plan.md

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish cross-story contracts, shared domain interfaces, and baseline architecture.

**CRITICAL**: Complete this phase before implementing user stories.

- [ ] T007 Extend internal gRPC contract and message shapes for EDMS domains in shared/proto/service.proto
- [ ] T008 Align public gateway API contract to EDMS endpoints and payloads in shared/openapi/openapi.yaml
- [ ] T009 [P] Add shared TypeScript EDMS contract types in shared/ts-types/src/index.ts
- [ ] T010 [P] Define core repository and outbound service ports in services/service/internal/ports/outbound/edms_ports.go
- [ ] T011 [P] Define inbound application interfaces for EDMS use cases in services/service/internal/ports/inbound/edms_usecases.go
- [ ] T012 Implement baseline gRPC server wiring for EDMS services in services/service/internal/adapters/inbound/grpc/server.go
- [ ] T013 Implement gateway gRPC client bootstrap for EDMS service calls in apps/gateway/src/adapters/outbound/grpc/edms.client.ts

## Phase 3: User Story 1 - Controlled Document Lifecycle (Priority: P1) MVP

**Goal**: Deliver full draft-to-archive lifecycle flow with structured approval transitions.

**Independent Validation**: A user can create a draft, submit for review, approve, and archive it with enforced state transitions and immutable history.

- [ ] T014 [P] [US1] Implement Document and DocumentVersion aggregates in services/service/internal/domain/model/document.go
- [ ] T015 [P] [US1] Implement WorkflowDefinition and WorkflowInstance aggregates in services/service/internal/domain/model/workflow.go
- [ ] T016 [US1] Implement document lifecycle orchestration use case in services/service/internal/application/service/document_lifecycle.go
- [ ] T017 [US1] Implement workflow transition policy and validation rules in services/service/internal/application/service/workflow_policy.go
- [ ] T018 [US1] Implement PostgreSQL repository for document and workflow persistence in services/service/internal/adapters/outbound/postgres/document_repository.go
- [ ] T019 [US1] Implement gRPC handlers for CreateDraft/Submit/Approve/Archive in services/service/internal/adapters/inbound/grpc/document_handler.go
- [ ] T020 [US1] Implement gateway HTTP handlers for document create/search/workflow submit/approve in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [ ] T021 [US1] Implement frontend document lifecycle UI flow (draft/review/approve/archive) in apps/frontend/src/app/adapters/http/dashboard/dashboard.component.ts
- [ ] T022 [US1] Add manual US1 acceptance checklist steps in specs/001-design-edms-platform/quickstart.md

## Phase 4: User Story 2 - Legally Binding Signing Flow (Priority: P1)

**Goal**: Deliver provider-agnostic digital signing requests and completion handling.

**Independent Validation**: A document can start a signature request, collect signer results, and lock content after completed signatures.

- [ ] T023 [P] [US2] Implement SignatureRequest and SignatureRecord aggregates in services/service/internal/domain/model/signature.go
- [ ] T024 [P] [US2] Define signature provider outbound port and callback contract in services/service/internal/ports/outbound/signature_provider.go
- [ ] T025 [US2] Implement signature orchestration use case with due-date and status rules in services/service/internal/application/service/signature_flow.go
- [ ] T026 [US2] Implement external signature provider adapter shell in services/service/internal/adapters/outbound/signature/provider_adapter.go
- [ ] T027 [US2] Implement gRPC handlers for StartSignature/GetSignatureStatus/RecordCallback in services/service/internal/adapters/inbound/grpc/signature_handler.go
- [ ] T028 [US2] Implement gateway signature endpoints and payload mapping in apps/gateway/src/adapters/inbound/http/signatures.routes.ts
- [ ] T029 [US2] Implement frontend signing request/status UI integration in apps/frontend/src/app/adapters/http/dashboard/signature-panel.component.ts
- [ ] T030 [US2] Add manual US2 signing acceptance steps and failure-path checks in specs/001-design-edms-platform/quickstart.md

## Phase 5: User Story 3 - Role-Based Access and Auditability (Priority: P1)

**Goal**: Enforce role permissions on lifecycle actions and persist immutable audit events.

**Independent Validation**: Unauthorized actions are denied and logged; authorized actions succeed and appear in ordered audit history.

- [ ] T031 [P] [US3] Implement Role and PermissionAssignment domain models in services/service/internal/domain/model/authorization.go
- [ ] T032 [P] [US3] Implement AuditEvent aggregate and append-only constraints in services/service/internal/domain/model/audit.go
- [ ] T033 [US3] Implement authorization policy service for action/category checks in services/service/internal/application/service/authorization_policy.go
- [ ] T034 [US3] Implement audit append/read use case orchestration in services/service/internal/application/service/audit_service.go
- [ ] T035 [US3] Implement PostgreSQL adapters for permissions and audit persistence in services/service/internal/adapters/outbound/postgres/authorization_audit_repository.go
- [ ] T036 [US3] Enforce RBAC guard middleware on gateway EDMS routes in apps/gateway/src/adapters/inbound/http/middleware/edms-rbac.guard.ts
- [ ] T037 [US3] Implement frontend audit timeline and denied-action feedback UX in apps/frontend/src/app/adapters/http/dashboard/audit-timeline.component.ts

## Phase 6: User Story 4 - Specialized HR and Financial Handling (Priority: P2)

**Goal**: Support category-aware workflows, visibility constraints, and retention behavior for HR/Finance.

**Independent Validation**: HR and Finance documents follow distinct routing/visibility policies and archive behavior.

- [ ] T038 [P] [US4] Implement category policy model for HR/FINANCE/GENERAL in services/service/internal/domain/model/category_policy.go
- [ ] T039 [US4] Implement category-based workflow assignment use case in services/service/internal/application/service/category_routing.go
- [ ] T040 [US4] Implement category-scoped authorization checks in services/service/internal/application/service/category_access_control.go
- [ ] T041 [US4] Implement gateway request handling for category-specific actions in apps/gateway/src/adapters/inbound/http/category.routes.ts
- [ ] T042 [US4] Implement frontend category-aware document forms and status presentation in apps/frontend/src/app/adapters/http/dashboard/category-workflow.component.ts

## Phase 7: User Story 5 - Search, Retrieval, and Notifications (Priority: P2)

**Goal**: Deliver Elasticsearch-backed search and event-driven lifecycle notifications.

**Independent Validation**: Indexed documents are retrievable via filters/keywords and notification events are emitted for lifecycle actions.

- [ ] T043 [P] [US5] Implement SearchDocumentProjection domain model and indexing rules in services/service/internal/domain/model/search_projection.go
- [ ] T044 [P] [US5] Implement NotificationEvent domain model and delivery status transitions in services/service/internal/domain/model/notification.go
- [ ] T045 [US5] Implement Elasticsearch outbound adapter for index upsert/query in services/service/internal/adapters/outbound/elasticsearch/document_index_adapter.go
- [ ] T046 [US5] Implement projection synchronization use case from lifecycle events in services/service/internal/application/service/search_projection_sync.go
- [ ] T047 [US5] Implement notification dispatcher use case with retry policy in services/service/internal/application/service/notification_dispatcher.go
- [ ] T048 [US5] Implement gateway search endpoint integration with filter DTO mapping in apps/gateway/src/adapters/inbound/http/search.routes.ts
- [ ] T049 [US5] Implement frontend search/filter/notification center experience in apps/frontend/src/app/adapters/http/dashboard/search-notification.component.ts
- [ ] T050 [US5] Add manual US5 search-index sync and notification validation in specs/001-design-edms-platform/quickstart.md

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, docs alignment, and production-readiness hardening across stories.

- [ ] T051 [P] Document EDMS API and gRPC contract alignment notes in specs/001-design-edms-platform/contracts/internal-grpc.md
- [ ] T052 [P] Refine accessibility and responsive UX acceptance criteria wording in specs/001-design-edms-platform/spec.md
- [ ] T053 Harden security/observability notes and operational constraints in specs/001-design-edms-platform/plan.md
- [ ] T054 Update implementation quickstart sequencing and rollback guidance in specs/001-design-edms-platform/quickstart.md
- [ ] T055 Capture release-readiness checklist and MVP cut line in specs/001-design-edms-platform/tasks.md

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 -> Phase 2 -> Phase 3/4/5/6/7 -> Phase 8
- User Story phases start only after Phase 2 completion.

### User Story Dependencies

- US1: Depends on Foundational phase only.
- US2: Depends on US1 document lifecycle completion for signature-eligible states.
- US3: Depends on Foundational phase only; can proceed in parallel with late US1 work.
- US4: Depends on US1 lifecycle and US3 authorization policy.
- US5: Depends on US1 lifecycle events and US3 access constraints; notifications can begin in parallel after core event contracts exist.

### Suggested Story Completion Order

- MVP: US1
- Then: US3
- Then: US2
- Then: US5
- Finally: US4

## Parallel Execution Examples

### User Story 1

```bash
Task: "T014 [US1] Implement Document and DocumentVersion aggregates in services/service/internal/domain/model/document.go"
Task: "T015 [US1] Implement WorkflowDefinition and WorkflowInstance aggregates in services/service/internal/domain/model/workflow.go"
```

### User Story 2

```bash
Task: "T023 [US2] Implement SignatureRequest and SignatureRecord aggregates in services/service/internal/domain/model/signature.go"
Task: "T024 [US2] Define signature provider outbound port and callback contract in services/service/internal/ports/outbound/signature_provider.go"
```

### User Story 3

```bash
Task: "T031 [US3] Implement Role and PermissionAssignment domain models in services/service/internal/domain/model/authorization.go"
Task: "T032 [US3] Implement AuditEvent aggregate and append-only constraints in services/service/internal/domain/model/audit.go"
```

### User Story 4

```bash
Task: "T038 [US4] Implement category policy model for HR/FINANCE/GENERAL in services/service/internal/domain/model/category_policy.go"
Task: "T042 [US4] Implement frontend category-aware document forms and status presentation in apps/frontend/src/app/adapters/http/dashboard/category-workflow.component.ts"
```

### User Story 5

```bash
Task: "T043 [US5] Implement SearchDocumentProjection domain model and indexing rules in services/service/internal/domain/model/search_projection.go"
Task: "T044 [US5] Implement NotificationEvent domain model and delivery status transitions in services/service/internal/domain/model/notification.go"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Deliver US1 (Phase 3) as the first deployable slice.
3. Validate with quickstart lifecycle scenario.

### Incremental Delivery

1. Add US3 for governance/compliance controls.
2. Add US2 for legally binding signing.
3. Add US5 for search + notifications.
4. Add US4 for category specialization.

### Format Check

All tasks follow the required checklist format:

- Checkbox marker (`- [ ]`)
- Sequential Task ID (`T001`..`T055`)
- Optional `[P]` parallel marker only where applicable
- Required `[USx]` label on user-story tasks
- Clear action and exact file path in every task
