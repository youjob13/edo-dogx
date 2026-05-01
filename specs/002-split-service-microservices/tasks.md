# Tasks: Split Service Into Logical Go Microservices

**Input**: Design documents from `/specs/002-split-service-microservices/`
**Prerequisites**: `plan.md` (required), `spec.md` (required), `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Validation**: Use manual acceptance validation, lint/build checks, and quickstart execution steps. Do not add automated test authoring/execution tasks under current governance.

**Organization**: Tasks are grouped by user story to enable independent implementation and validation of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare repository structure and baseline runtime wiring for new Go microservices.

- [X] T001 Add target microservice decomposition overview and ownership table in specs/002-split-service-microservices/plan.md
- [X] T002 Create document service module scaffold in services/document-service/go.mod
- [X] T003 [P] Create authorization-audit service module scaffold in services/authorization-audit-service/go.mod
- [X] T004 [P] Create signature service module scaffold in services/signature-service/go.mod
- [X] T005 [P] Create search-notification service module scaffold in services/search-notification-service/go.mod
- [X] T006 Register new service modules in workspace configuration in go.work
- [X] T007 Add container definitions for new services and internal network wiring in docker-compose.yml

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared contracts, migration controls, and gateway abstraction that block all user story work.

**CRITICAL**: Complete this phase before implementing user stories.

- [X] T008 Extend internal split contracts for all target services in shared/proto/service.proto
- [X] T009 Align public gateway routes and compatibility notes for migration waves in shared/openapi/openapi.yaml
- [X] T010 [P] Add gateway gRPC client bootstrap for document service in apps/gateway/src/adapters/outbound/grpc/document.client.ts
- [X] T011 [P] Add gateway gRPC client bootstrap for authorization-audit service in apps/gateway/src/adapters/outbound/grpc/authorization_audit.client.ts
- [X] T012 [P] Add gateway gRPC client bootstrap for signature service in apps/gateway/src/adapters/outbound/grpc/signature.client.ts
- [X] T013 [P] Add gateway gRPC client bootstrap for search-notification service in apps/gateway/src/adapters/outbound/grpc/search_notification.client.ts
- [X] T014 Implement migration wave tracking schema and status transitions in specs/002-split-service-microservices/data-model.md
- [X] T015 Define route cutover and rollback decision protocol in specs/002-split-service-microservices/contracts/gateway-routing.md

**Checkpoint**: Foundation ready. User story implementation can begin.

## Phase 3: User Story 1 - Establish Domain Microservices (Priority: P1) 🎯 MVP

**Goal**: Create the first production-ready service boundaries and capability ownership map from the draft service.

**Independent Validation**: Each in-scope draft capability is assigned to exactly one target microservice with runnable service scaffolds and contract ownership.

### Validation for User Story 1

- [X] T016 [P] [US1] Validate capability-to-service boundary map against draft service components in specs/002-split-service-microservices/spec.md
- [X] T017 [P] [US1] Validate ownership and dependency-risk annotations for each capability in specs/002-split-service-microservices/data-model.md

### Implementation for User Story 1

- [X] T018 [US1] Implement document workflow inbound gRPC server bootstrap in services/document-service/internal/adapters/inbound/grpc/server.go
- [X] T019 [P] [US1] Implement document workflow application use case skeletons in services/document-service/internal/application/service/document_lifecycle.go
- [X] T020 [P] [US1] Implement document workflow domain model skeletons in services/document-service/internal/domain/model/document.go
- [X] T021 [US1] Implement authorization-audit inbound gRPC server bootstrap in services/authorization-audit-service/internal/adapters/inbound/grpc/server.go
- [X] T022 [P] [US1] Implement authorization and audit domain model skeletons in services/authorization-audit-service/internal/domain/model/authorization_audit.go
- [X] T023 [US1] Implement signature inbound gRPC server bootstrap in services/signature-service/internal/adapters/inbound/grpc/server.go
- [X] T024 [P] [US1] Implement signature flow domain/application skeletons in services/signature-service/internal/application/service/signature_flow.go
- [X] T025 [US1] Implement search-notification inbound gRPC server bootstrap in services/search-notification-service/internal/adapters/inbound/grpc/server.go
- [X] T026 [P] [US1] Implement search projection and notification dispatcher skeletons in services/search-notification-service/internal/application/service/search_notification.go
- [X] T027 [US1] Document finalized service boundary ownership and producer contract mapping in specs/002-split-service-microservices/contracts/internal-grpc-split.md

**Checkpoint**: User Story 1 is independently complete and verifiable.

## Phase 4: User Story 2 - Migrate Business Flows Safely (Priority: P2)

**Goal**: Execute wave-based cutover through gateway adapters while preserving flow continuity and rollback readiness.

**Independent Validation**: Core flows are routed to target services wave-by-wave with explicit fallback and compatibility behavior.

### Validation for User Story 2

- [X] T028 [P] [US2] Validate migration wave entry/exit criteria for document and workflow flow cutover in specs/002-split-service-microservices/quickstart.md
- [X] T029 [P] [US2] Validate rollback trigger thresholds and rollback execution sequence in specs/002-split-service-microservices/contracts/gateway-routing.md

### Implementation for User Story 2

- [X] T030 [US2] Implement gateway document/workflow route mapping to document service client in apps/gateway/src/adapters/inbound/http/documents.routes.ts
- [X] T031 [US2] Implement gateway authorization and audit route mapping to authorization-audit client in apps/gateway/src/adapters/inbound/http/audit.routes.ts
- [X] T032 [US2] Implement gateway signature route mapping to signature client in apps/gateway/src/adapters/inbound/http/signatures.routes.ts
- [X] T033 [US2] Implement gateway search and notification route mapping to search-notification client in apps/gateway/src/adapters/inbound/http/search.routes.ts
- [X] T034 [P] [US2] Implement service-side compatibility behavior for additive contract evolution in services/document-service/internal/adapters/inbound/grpc/document_handler.go
- [X] T035 [P] [US2] Implement service-side compatibility behavior for signature callback transitions in services/signature-service/internal/adapters/inbound/grpc/signature_handler.go
- [X] T036 [US2] Implement migration wave state updates and consumer dependency progression tracking in specs/002-split-service-microservices/data-model.md
- [X] T037 [US2] Update operational migration flow and rollback runbook steps per completed waves in specs/002-split-service-microservices/quickstart.md

**Checkpoint**: User Story 2 is independently complete and verifiable.

## Phase 5: User Story 3 - Decommission Draft Service (Priority: P3)

**Goal**: Retire draft `services/service` after objective decommission gates are satisfied.

**Independent Validation**: No active route, deployment, or dependency requires the draft service, and decommission evidence is recorded.

### Validation for User Story 3

- [X] T038 [P] [US3] Validate zero-traffic and dependency-closure gate criteria in specs/002-split-service-microservices/spec.md
- [X] T039 [P] [US3] Validate decommission evidence and approval matrix completeness in specs/002-split-service-microservices/data-model.md

### Implementation for User Story 3

- [X] T040 [US3] Remove gateway fallback references to draft service clients after final wave cutover in apps/gateway/src/adapters/outbound/grpc/edms.client.ts
- [X] T041 [US3] Remove draft service container from active runtime stack after gate approval in docker-compose.yml
- [X] T042 [US3] Mark draft service runtime status as RETIRED and document gate outcomes in specs/002-split-service-microservices/data-model.md
- [X] T043 [US3] Add decommission completion section with evidence checklist and approvals in specs/002-split-service-microservices/quickstart.md
- [X] T044 [US3] Remove draft service migration references from planning summary and declare retirement status in specs/002-split-service-microservices/plan.md

**Checkpoint**: User Story 3 is independently complete and verifiable.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cross-story consistency, hardening notes, and release readiness alignment.

- [X] T045 [P] Consolidate final route-to-service ownership matrix in specs/002-split-service-microservices/contracts/gateway-routing.md
- [X] T046 [P] Consolidate final gRPC service ownership and versioning rules in specs/002-split-service-microservices/contracts/internal-grpc-split.md
- [X] T047 Update performance, reliability, and rollback SLO notes after full migration in specs/002-split-service-microservices/plan.md
- [X] T048 Update stakeholder migration status reporting template and cadence in specs/002-split-service-microservices/spec.md
- [X] T049 Run full manual implementation validation checklist and capture results in specs/002-split-service-microservices/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies.
- **Phase 2 (Foundational)**: Depends on Phase 1 and blocks all user stories.
- **Phase 3 (US1)**: Depends on Phase 2 completion.
- **Phase 4 (US2)**: Depends on Phase 2 and core service boundaries from US1.
- **Phase 5 (US3)**: Depends on US2 migration completion and validated decommission gates.
- **Phase 6 (Polish)**: Depends on all user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational phase. No dependency on US2 or US3.
- **US2 (P2)**: Depends on US1 service boundaries and contracts being established.
- **US3 (P3)**: Depends on US2 route migration completion and consumer dependency closure.

### Within Each User Story

- Validation tasks run before sign-off.
- Service boundary and model tasks precede route cutover tasks.
- Route cutover tasks precede decommission tasks.

---

## Parallel Execution Examples

### User Story 1

```bash
Task: "T019 [US1] Implement document workflow application use case skeletons in services/document-service/internal/application/service/document_lifecycle.go"
Task: "T020 [US1] Implement document workflow domain model skeletons in services/document-service/internal/domain/model/document.go"
Task: "T022 [US1] Implement authorization and audit domain model skeletons in services/authorization-audit-service/internal/domain/model/authorization_audit.go"
Task: "T024 [US1] Implement signature flow domain/application skeletons in services/signature-service/internal/application/service/signature_flow.go"
```

### User Story 2

```bash
Task: "T034 [US2] Implement service-side compatibility behavior for additive contract evolution in services/document-service/internal/adapters/inbound/grpc/document_handler.go"
Task: "T035 [US2] Implement service-side compatibility behavior for signature callback transitions in services/signature-service/internal/adapters/inbound/grpc/signature_handler.go"
Task: "T028 [US2] Validate migration wave entry/exit criteria for document and workflow flow cutover in specs/002-split-service-microservices/quickstart.md"
```

### User Story 3

```bash
Task: "T038 [US3] Validate zero-traffic and dependency-closure gate criteria in specs/002-split-service-microservices/spec.md"
Task: "T039 [US3] Validate decommission evidence and approval matrix completeness in specs/002-split-service-microservices/data-model.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 (US1) to establish target microservice boundaries.
3. Validate US1 independently using boundary ownership and contract checks.
4. Pause for architecture sign-off before migration waves.

### Incremental Delivery

1. Deliver US1 service boundaries and ownership map.
2. Deliver US2 migration waves with safe cutover and rollback.
3. Deliver US3 decommission gates and retirement of draft service.
4. Finish polish tasks and finalize release readiness evidence.

### Parallel Team Strategy

1. Team A: service scaffolds and domain/application skeletons (US1).
2. Team B: gateway route migration and compatibility routing (US2).
3. Team C: decommission evidence and operational readiness tracking (US3).

---

## Format Validation

- Total tasks: 49
- User Story task counts:
  - US1: 12 tasks (`T016`-`T027`)
  - US2: 10 tasks (`T028`-`T037`)
  - US3: 7 tasks (`T038`-`T044`)
- Parallel opportunities identified in Setup, Foundational, and all user story phases via `[P]` labels.
- All tasks follow required checklist format: checkbox, Task ID, optional `[P]`, required `[USx]` in story phases, and explicit file path.
