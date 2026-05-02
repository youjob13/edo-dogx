# Tasks: Configurable Document Editor and Export

**Input**: Design documents from `/specs/004-document-editor-export/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Validation**: Use manual validation tasks plus lint/build/static checks. Do not add automated test authoring/execution tasks.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated independently.

## Format: `[ID] [P?] [Story] Description`

- [P] means task can run in parallel (different files, no dependency on incomplete task)
- [Story] appears only in user-story phases: [US1], [US2], [US3], [US4]
- Every task includes explicit file path(s)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare dependencies and shared contracts for editor/export work.

- [X] T001 Add editor/export dependency placeholders and scripts in apps/frontend/package.json and services/document-service/go.mod
- [X] T002 [P] Add feature environment keys for export timeouts and limits in .env.example and docker-compose.yml
- [X] T003 [P] Extend shared API DTOs for editor profiles and export lifecycle in shared/ts-types/src/index.ts
- [X] T004 Update OpenAPI surface for editor profile and export endpoints in shared/openapi/openapi.yaml
- [X] T005 Update internal gRPC contracts for export workflow in shared/proto/service.proto
- [X] T006 Document selected external libraries and licensing notes in specs/004-document-editor-export/research.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend/gateway/frontend plumbing required before user stories.

**⚠️ CRITICAL**: No user story implementation starts before this phase is complete.

- [X] T007 Add DB schema for editor control profiles and export entities in services/document-service/migrations/002_editor_profiles_and_exports.sql
- [X] T008 [P] Add repository port contracts for control profiles and exports in services/document-service/internal/ports/outbound/document_repository.go
- [X] T009 [P] Implement postgres repository support for control profiles and export requests in services/document-service/internal/adapters/outbound/postgres/document_repository.go
- [X] T010 Implement lifecycle service methods for control profile resolution and export request lifecycle in services/document-service/internal/application/service/document_lifecycle.go
- [X] T011 Expose gRPC handlers for profile and export operations in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T012 [P] Add gateway gRPC client methods for profile/export calls in apps/gateway/src/adapters/outbound/grpc/document.client.ts
- [X] T013 Implement gateway route registration for new endpoints in apps/gateway/src/adapters/inbound/http/app.ts and apps/gateway/src/main.ts
- [X] T014 Extend RBAC action map for documents.configure and documents.export in apps/gateway/src/adapters/inbound/http/middleware/edms-rbac.guard.ts
- [X] T015 Add frontend outbound port methods for profiles/exports in apps/frontend/src/app/ports/outbound/dashboard-api.port.ts
- [X] T016 Implement frontend adapter methods for profile/export HTTP calls in apps/frontend/src/app/adapters/outbound/dashboard-mock-http.adapter.ts

**Checkpoint**: Foundation ready. User stories can proceed.

---

## Phase 3: User Story 1 - Create a Document in a Rich Editor (Priority: P1) 🎯 MVP

**Goal**: Users can author and save rich documents with configurable toolbar controls.

**Independent Validation**: Open create/edit flow, compose with rich controls, save draft, reopen and verify persisted content and metadata.

### Validation for User Story 1

- [X] T017 [P] [US1] Validate create/edit rich-authoring journey against acceptance criteria in specs/004-document-editor-export/quickstart.md
- [X] T018 [P] [US1] Validate keyboard navigation, focus order, semantics, and contrast for editor screens in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.html and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.html

### Implementation for User Story 1

- [X] T019 [P] [US1] Add rich-content fields and editor state models in apps/frontend/src/app/domain/dashboard/dashboard.models.ts
- [X] T020 [P] [US1] Extend dashboard use-cases for rich draft create/update orchestration in apps/frontend/src/app/application/dashboard/dashboard.use-cases.ts
- [X] T021 [US1] Integrate external rich editor and toolbar container in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.ts
- [X] T022 [US1] Integrate external rich editor for editing existing drafts in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts
- [X] T023 [US1] Implement rich-editor UI controls and metadata validation states in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.html and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.html
- [X] T024 [US1] Add responsive editor layout and focus-visible styles in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.scss and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.scss
- [X] T025 [US1] Ensure save/update payload includes structured content and expectedVersion in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T026 [US1] Persist structured contentDocument and metadata validation in services/document-service/internal/domain/model/document.go and services/document-service/internal/application/service/document_lifecycle.go
- [X] T027 [US1] Emit create/edit audit metadata for rich document operations in services/authorization-audit-service/internal/application/service/audit_service.go

**Checkpoint**: US1 is independently functional and demo-ready.

---

## Phase 4: User Story 2 - Configure Editor Controls by Context (Priority: P1)

**Goal**: Authorized operators configure control profiles by category/template and users see only allowed controls.

**Independent Validation**: Update profile for a context and confirm next editor session reflects only allowed controls.

### Validation for User Story 2

- [ ] T028 [P] [US2] Validate profile update and effective control filtering flow in specs/004-document-editor-export/quickstart.md
- [ ] T029 [P] [US2] Validate admin/operator permission boundaries for profile management in apps/gateway/src/adapters/inbound/http/middleware/edms-rbac.guard.ts

### Implementation for User Story 2

- [ ] T030 [P] [US2] Add profile DTOs and context enums in shared/ts-types/src/index.ts
- [ ] T031 [US2] Implement GET/PUT editor-control-profile endpoints in apps/gateway/src/adapters/inbound/http/editor-control-profiles.routes.ts
- [ ] T032 [US2] Register editor-control-profile routes in apps/gateway/src/adapters/inbound/http/app.ts
- [ ] T033 [US2] Implement profile resolution/update methods in services/document-service/internal/application/service/document_lifecycle.go
- [X] T034 [US2] Add gRPC handling for profile retrieval/update in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [ ] T035 [US2] Apply resolved control profile to toolbar configuration in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.ts and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts
- [ ] T036 [US2] Add profile-management UI section in apps/frontend/src/app/adapters/http/dashboard/settings/dashboard-settings.component.ts and apps/frontend/src/app/adapters/http/dashboard/settings/dashboard-settings.component.html

**Checkpoint**: US2 works independently with explicit permission checks.

---

## Phase 5: User Story 3 - Export to PDF and DOCX (Priority: P1)

**Goal**: Users export saved drafts to PDF or DOCX and download generated files.

**Independent Validation**: Export one saved draft to PDF and DOCX, download both files, verify readability and core formatting.

### Validation for User Story 3

- [ ] T037 [P] [US3] Validate PDF export request-to-download flow in specs/004-document-editor-export/quickstart.md
- [ ] T038 [P] [US3] Validate DOCX export request-to-download flow in specs/004-document-editor-export/quickstart.md

### Implementation for User Story 3

- [X] T039 [P] [US3] Add export request/artifact DTOs and statuses in shared/ts-types/src/index.ts
- [X] T040 [US3] Implement export endpoints (create/status/download) in apps/gateway/src/adapters/inbound/http/exports.routes.ts
- [X] T041 [US3] Register export routes in apps/gateway/src/adapters/inbound/http/app.ts
- [X] T042 [US3] Add export initiation and status querying methods in apps/gateway/src/adapters/outbound/grpc/document.client.ts
- [X] T043 [US3] Implement export lifecycle service and external library invocation wrappers in services/document-service/internal/application/service/document_lifecycle.go
- [X] T044 [US3] Persist export request state transitions and artifact metadata in services/document-service/internal/adapters/outbound/postgres/document_repository.go
- [X] T045 [US3] Implement export action panel and download controls in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.html
- [X] T046 [US3] Add export progress/status presentation styles in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.scss
- [X] T047 [US3] Emit audit events for export requested/succeeded in services/authorization-audit-service/internal/application/service/audit_service.go

**Checkpoint**: US3 exports are independently functional for both formats.

---

## Phase 6: User Story 4 - Handle Export and Editor Failures Gracefully (Priority: P2)

**Goal**: Users receive actionable recovery guidance and do not lose authored content during failures.

**Independent Validation**: Simulate export/editor failures, verify content preservation, clear messaging, and retry flow.

### Validation for User Story 4

- [ ] T048 [P] [US4] Validate export failure messaging and retry behavior in specs/004-document-editor-export/quickstart.md
- [ ] T049 [P] [US4] Validate editor integration fallback path and unsaved-content preservation in apps/frontend/src/app/guards/unsaved-changes.guard.ts and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts

### Implementation for User Story 4

- [ ] T050 [P] [US4] Define export/editor failure error codes and mapping in shared/ts-types/src/index.ts and apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [ ] T051 [US4] Implement gateway error envelope mapping for profile/export failures in apps/gateway/src/adapters/inbound/http/exports.routes.ts and apps/gateway/src/adapters/inbound/http/editor-control-profiles.routes.ts
- [ ] T052 [US4] Implement retriable FAILED -> QUEUED export transition handling in services/document-service/internal/application/service/document_lifecycle.go
- [ ] T053 [US4] Guarantee draft immutability on export failure paths in services/document-service/internal/domain/model/document.go and services/document-service/internal/adapters/outbound/postgres/document_repository.go
- [ ] T054 [US4] Add user-facing recovery banners and retry actions in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.html and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.ts
- [ ] T055 [US4] Emit audit events for export/editor failures with metadata in services/authorization-audit-service/internal/application/service/audit_service.go and services/authorization-audit-service/internal/domain/model/authorization_audit.go

**Checkpoint**: US4 failure handling is independently reliable and non-destructive.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency, accessibility, performance, and release-readiness pass.

- [ ] T056 [P] Update operator/user documentation for editor controls and export usage in specs/004-document-editor-export/quickstart.md
- [ ] T057 [P] Reconcile OpenAPI and shared DTO alignment for all new payloads in shared/openapi/openapi.yaml and shared/ts-types/src/index.ts
- [ ] T058 Run repository lint/build validation and record outcomes in specs/004-document-editor-export/quickstart.md
- [ ] T059 [P] Perform responsive pass for mobile/desktop long-content editor and export panels in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.scss and apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.scss
- [ ] T060 [P] Perform accessibility copy/focus/ARIA final pass for new UI surfaces in apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-create.component.html, apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-document-edit.component.html, and apps/frontend/src/app/adapters/http/dashboard/settings/dashboard-settings.component.html
- [ ] T061 Confirm rollback toggles and operational notes for gateway/service routes in specs/004-document-editor-export/quickstart.md and apps/gateway/src/adapters/inbound/http/app.ts

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): no dependencies.
- Foundational (Phase 2): depends on Phase 1 and blocks all user stories.
- User Story Phases (Phase 3-6): each depends on Phase 2 completion.
- Polish (Phase 7): depends on completion of selected user stories.

### User Story Dependencies

- US1 (P1): starts after Foundational completion; no dependency on other stories.
- US2 (P1): starts after Foundational completion; integrates with US1 editor surfaces but remains independently deliverable.
- US3 (P1): starts after Foundational completion; depends on existing document persistence interfaces, not on US2 UI.
- US4 (P2): starts after Foundational completion; refines failure paths of US1-US3.

### Suggested Completion Order

1. US1 (MVP editor create/edit)
2. US3 (export value path)
3. US2 (governed control profile management)
4. US4 (robust recovery and failure semantics)

---

## Parallel Execution Examples

### User Story 1

- Run T019 and T020 in parallel (domain/use-case updates in different files).
- Run T021 and T022 in parallel (create/edit component integration).

### User Story 2

- Run T030 and T033 in parallel (shared DTOs and service logic).
- Run T031 and T034 in parallel (gateway route and gRPC handler implementation).

### User Story 3

- Run T039 and T043 in parallel (DTO extensions and export lifecycle logic).
- Run T045 and T047 in parallel (frontend export panel and audit emission updates).

### User Story 4

- Run T050 and T052 in parallel (error-contract mapping and retry transition logic).
- Run T054 and T055 in parallel (frontend recovery UX and audit failure metadata).

---

## Implementation Strategy

### MVP First (US1)

1. Complete Phase 1 and Phase 2.
2. Deliver Phase 3 (US1) end-to-end.
3. Validate US1 independently via quickstart steps.
4. Demo/deploy MVP increment.

### Incremental Delivery

1. Add US3 for immediate export business value.
2. Add US2 for context-based control governance.
3. Add US4 for resilience and user trust.
4. Finish with Phase 7 polish and validation.

### Team Parallelization

1. One stream: frontend editor and profile UX (US1/US2).
2. Second stream: gateway contract and route work (Foundational/US3/US4).
3. Third stream: document-service export pipeline and persistence.
4. Fourth stream: authorization-audit event coverage and compliance logs.

---

## Notes

- [P] tasks are parallelizable by file-level isolation and dependency boundaries.
- Story labels map every task directly to a user story for independent delivery.
- No automated test authoring or execution tasks are included by policy.
- Use specs/004-document-editor-export/quickstart.md as the primary manual validation runbook.
