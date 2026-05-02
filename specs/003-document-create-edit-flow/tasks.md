# Tasks: Full Document Create/Edit Flow

**Input**: Design documents from `/specs/003-document-create-edit-flow/`
**Prerequisites**: plan.md, spec.md

**Validation**: Use implementation validation tasks (manual, lint/build/static checks). Do not add test authoring/execution tasks unless governance explicitly changes.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared scaffolding and feature documentation anchors.

- [X] T001 Create service migration directories for document and authorization-audit services in services/document-service/migrations/ and services/authorization-audit-service/migrations/
- [X] T002 Create migration runbook for local and container environments in specs/003-document-create-edit-flow/quickstart.md
- [X] T003 [P] Capture create/edit error semantics matrix for frontend, gateway, and gRPC mapping in specs/003-document-create-edit-flow/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core contracts and persistence foundations that MUST complete before user story work.

**CRITICAL**: No user story implementation begins until this phase is complete.

- [X] T004 Update REST contract for document update endpoint and conflict responses in shared/openapi/openapi.yaml
- [X] T005 Update shared TypeScript DTOs for create/edit payloads and conflict envelopes in shared/ts-types/src/index.ts
- [X] T006 Add document service persistence schema migration for documents and immutable document_versions in services/document-service/migrations/001_document_create_edit.sql
- [X] T007 Add audit service persistence schema migration for append-only audit_events in services/authorization-audit-service/migrations/001_audit_events.sql
- [X] T008 [P] Add PostgreSQL repository ports for document persistence and revision writes in services/document-service/internal/ports/outbound/
- [X] T009 [P] Add PostgreSQL repository ports for audit event append and document audit retrieval in services/authorization-audit-service/internal/ports/outbound/
- [X] T010 Implement document-service outbound postgres adapters and transaction boundaries in services/document-service/internal/adapters/outbound/postgres/
- [X] T011 Implement authorization-audit-service outbound postgres adapters in services/authorization-audit-service/internal/adapters/outbound/postgres/

**Checkpoint**: Foundation ready for independent user story implementation.

---

## Phase 3: User Story 1 - Create a New Document Draft (Priority: P1) 🎯 MVP

**Goal**: Allow authorized users to create a new draft with required metadata and receive a persisted result.

**Independent Validation**: User opens create form, submits valid data, receives created draft ID, and can fetch the draft afterward.

### Validation for User Story 1

- [ ] T012 [P] [US1] Validate draft create scenarios and required-field failures manually from frontend through gateway in specs/003-document-create-edit-flow/quickstart.md
- [ ] T013 [P] [US1] Validate create-form accessibility and responsive behavior in apps/frontend/src/app/adapters/http/dashboard/documents/

### Implementation for User Story 1

- [X] T014 [P] [US1] Extend frontend create draft models and command payloads in apps/frontend/src/app/domain/dashboard/dashboard.models.ts
- [X] T015 [P] [US1] Extend frontend dashboard outbound port with createDraft operation in apps/frontend/src/app/ports/outbound/dashboard-api.port.ts
- [X] T016 [US1] Implement frontend createDraft use case orchestration in apps/frontend/src/app/application/dashboard/dashboard.use-cases.ts
- [X] T017 [US1] Implement gateway create draft request validation and response typing alignment in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T018 [US1] Implement document-service CreateDraft use case with persistence and default draft state in services/document-service/internal/application/service/document_lifecycle.go
- [X] T019 [US1] Implement document-service gRPC CreateDraft handler mapping to application use case in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T020 [US1] Implement audit append for draft creation events in services/authorization-audit-service/internal/application/
- [X] T021 [US1] Add routed create page entry and navigation wiring in apps/frontend/src/app/ports/inbound/dashboard.routes.ts
- [X] T022 [US1] Implement create document page with field-level validation and Russian-first UX text in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.ts
- [X] T023 [US1] Wire frontend create API adapter to POST /api/documents in apps/frontend/src/app/adapters/outbound/dashboard-mock-http.adapter.ts

**Checkpoint**: User Story 1 is functional and independently validatable.

---

## Phase 4: User Story 2 - Edit Existing Draft Document (Priority: P1)

**Goal**: Allow authorized users to edit draft metadata/content and persist intended changes safely.

**Independent Validation**: User opens existing draft, updates fields, saves, reloads, and sees only intended updates persisted.

### Validation for User Story 2

- [ ] T024 [P] [US2] Validate edit save and validation-failure scenarios manually in specs/003-document-create-edit-flow/quickstart.md
- [ ] T025 [P] [US2] Validate unsaved-changes warning behavior on route leave in apps/frontend/src/app/guards/

### Implementation for User Story 2

- [X] T026 [P] [US2] Add edit request and expectedVersion frontend model contract in apps/frontend/src/app/domain/dashboard/dashboard.models.ts
- [X] T027 [US2] Extend frontend outbound port and use case for updateDraft operation in apps/frontend/src/app/ports/outbound/dashboard-api.port.ts
- [X] T028 [US2] Add PATCH document endpoint with RBAC edit guard in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T029 [US2] Add documents.edit role mapping and category checks in apps/gateway/src/adapters/inbound/http/middleware/edms-rbac.guard.ts
- [X] T030 [US2] Add UpdateDraft gRPC client method in apps/gateway/src/adapters/outbound/grpc/document.client.ts
- [X] T031 [US2] Implement document-service UpdateDraft application logic for editable-state validation in services/document-service/internal/application/service/document_lifecycle.go
- [X] T032 [US2] Implement document-service UpdateDraft gRPC inbound mapping in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T033 [US2] Implement dedicated edit route and form component wiring in apps/frontend/src/app/ports/inbound/dashboard.routes.ts
- [X] T034 [US2] Implement draft edit page with actionable field errors in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts
- [X] T035 [US2] Add unsaved-changes CanDeactivate guard for edit route in apps/frontend/src/app/guards/unsaved-changes.guard.ts

**Checkpoint**: User Stories 1 and 2 both function independently.

---

## Phase 5: User Story 3 - Preserve Integrity During Concurrent Editing (Priority: P2)

**Goal**: Reject stale updates using optimistic locking and provide clear conflict resolution UX.

**Independent Validation**: Two sessions edit same draft; stale save receives conflict and no silent overwrite occurs.

### Validation for User Story 3

- [ ] T036 [P] [US3] Validate two-session conflict scenario and non-overwrite behavior manually in specs/003-document-create-edit-flow/quickstart.md
- [ ] T037 [P] [US3] Validate conflict message accessibility announcement and focus handling in apps/frontend/src/app/adapters/http/dashboard/documents/

### Implementation for User Story 3

- [X] T038 [P] [US3] Add domain conflict and stale-version errors in services/document-service/internal/domain/model/document.go
- [X] T039 [US3] Enforce expectedVersion optimistic lock in document update transaction in services/document-service/internal/adapters/outbound/postgres/
- [X] T040 [US3] Map domain conflict errors to gRPC and HTTP 409 responses in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T041 [US3] Map gRPC conflict responses to gateway HTTP conflict payloads in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T042 [US3] Add conflict response models and UI state handling in apps/frontend/src/app/application/dashboard/dashboard.use-cases.ts
- [X] T043 [US3] Implement conflict resolution UX with reload path in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts
- [X] T044 [US3] Append conflict-detected audit events with version metadata in services/authorization-audit-service/internal/application/

**Checkpoint**: User Stories 1-3 function independently with concurrency safety.

---

## Phase 6: User Story 4 - Recover Work and Continue (Priority: P3)

**Goal**: Users can return to saved drafts and continue editing from latest persisted state.

**Independent Validation**: User creates and edits draft, leaves session, reopens later, and resumes from latest saved data.

### Validation for User Story 4

- [ ] T045 [P] [US4] Validate reopen-and-continue workflow across new session manually in specs/003-document-create-edit-flow/quickstart.md
- [ ] T046 [P] [US4] Validate long-content and mobile layout behavior on reopen/edit screens in apps/frontend/src/app/adapters/http/dashboard/documents/

### Implementation for User Story 4

- [X] T047 [P] [US4] Implement document retrieval query path in document-service application layer in services/document-service/internal/application/service/document_lifecycle.go
- [X] T048 [US4] Implement GetDocument gRPC handler path and mapping in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T049 [US4] Add gateway get-by-id document route for draft reopen in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T050 [US4] Extend frontend API port and use case for getDocumentById in apps/frontend/src/app/ports/outbound/dashboard-api.port.ts
- [X] T051 [US4] Add frontend route-driven reopen flow in document list and edit entry points in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-documents.component.ts
- [X] T052 [US4] Implement restore-latest-state behavior on edit screen initialization in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts

**Checkpoint**: All user stories are independently functional and validatable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening across user stories.

- [X] T053 [P] Update feature documentation and implementation notes in specs/003-document-create-edit-flow/research.md
- [X] T054 [P] Run repository lint and build validation without tests from repository root in package.json
- [ ] T055 Validate end-to-end manual quickstart scenarios and capture outcomes in specs/003-document-create-edit-flow/quickstart.md
- [ ] T056 Perform accessibility and responsive polish pass across create/edit views in apps/frontend/src/app/adapters/http/dashboard/documents/
- [X] T057 Confirm migration rollback instructions and failure handling notes in specs/003-document-create-edit-flow/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): No dependencies, starts immediately.
- Foundational (Phase 2): Depends on Setup completion; blocks all user stories.
- User Stories (Phases 3-6): Depend on Foundational completion.
- Polish (Phase 7): Depends on completion of targeted user stories.

### User Story Dependencies

- US1 (P1): Starts after Phase 2 and serves as MVP.
- US2 (P1): Starts after Phase 2; relies on US1 create path availability for practical validation.
- US3 (P2): Starts after US2 update path exists.
- US4 (P3): Starts after US1 and US2 persistence/read paths are stable.

### Within Each User Story

- Validation tasks complete before sign-off.
- Model and contracts before adapters and handlers.
- Backend persistence and API paths before frontend final wiring.
- Story checkpoint must pass before moving to next priority in sequential delivery.

### Parallel Opportunities

- Phase 1: T003 can run in parallel with T001-T002.
- Phase 2: T008 and T009 parallel; T010 and T011 parallel after their ports.
- US1: T014 and T015 parallel; frontend route/page tasks parallel with backend create implementation after contracts.
- US2: T026 parallel with T028-T030 once foundational contracts are ready.
- US3: T036 and T037 parallel validation; T038 parallel with frontend conflict model preparation.
- US4: T047 parallel with frontend get-by-id model extension T050.
- Phase 7: T053 and T054 parallel, followed by T055-T057.

---

## Notes

- All tasks follow checklist format with exact IDs and file paths.
- [P] tasks are parallel-safe and avoid same-file dependency conflicts.
- Story labels map directly to user stories in spec.md.
- No test authoring or execution tasks are included by repository policy.
- Recommended MVP scope: Phase 3 (US1) after foundational completion.
