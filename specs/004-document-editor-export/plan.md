# Implementation Plan: Configurable Document Editor and Export

**Branch**: `[004-before-specify-hook]` | **Date**: 2026-05-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-document-editor-export/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver a configurable rich document editor using ready-made external libraries,
persist authored drafts, and provide reliable export/download in PDF and DOCX.
The feature introduces control profiles by context, export request lifecycle
tracking, and explicit failure recovery, while preserving existing architecture,
security boundaries, accessibility expectations, and no-tests policy.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x (frontend + gateway), Go 1.23 (backend services), SQL (PostgreSQL)  
**Primary Dependencies**: Angular 21 (standalone + reactive forms), Fastify gateway, gRPC contracts, external rich-text editor library, external PDF export library, external DOCX export library  
**Storage**: PostgreSQL for document drafts, control profiles, export request state, and export artifacts metadata  
**Testing**: [Current policy: do not create/modify/run tests unless explicitly requested and governance is amended]  
**Target Platform**: Linux containers via Docker Compose for backend; browser clients (SSR-enabled Angular frontend)  
**Project Type**: Web application (frontend + BFF gateway + microservices)  
**Performance Goals**: 95% of successful exports complete in under 10 seconds; create/save/edit interactions remain responsive under normal business-hour load  
**Constraints**: Use external ready-made libraries for editor and export; preserve role-based access and auditability; avoid custom editor core implementation; no automated test authoring/execution tasks  
**Scale/Scope**: Initial rollout for PDF and DOCX export only, with control profiles by category/template context

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Clarity over cleverness: PASS. External editor/export integrations are isolated behind explicit adapter boundaries.
- Consistency: PASS. Existing monorepo contracts, route patterns, and hexagonal layering remain intact.
- Design for change: PASS. Library-specific behavior is planned behind stable ports and profile/config abstractions.
- Quality bar: PASS. Export state machine, error semantics, retries, and audit trails are explicitly designed.
- Accessibility: PASS. Editor and control surfaces include keyboard/focus/semantics obligations.
- Responsive/adaptive behavior: PASS. Long content and mobile/desktop editor behavior are included in scope.
- Policy check: PASS. Plan excludes automated test creation/modification/execution tasks.

## Project Structure

### Documentation (this feature)

```text
specs/004-document-editor-export/
├── plan.md
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── gateway-editor-export-api.md
│   └── internal-editor-export-workflow.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
apps/
├── frontend/
│   └── src/app/
│       ├── adapters/http/dashboard/documents/
│       ├── adapters/outbound/
│       ├── application/
│       ├── domain/
│       └── ports/
└── gateway/
  └── src/
    ├── adapters/inbound/http/
    ├── adapters/outbound/grpc/
    ├── application/
    ├── domain/
    └── ports/

services/
├── document-service/
│   └── internal/
│       ├── adapters/
│       ├── application/
│       └── domain/
└── authorization-audit-service/
  └── internal/
    ├── adapters/
    ├── application/
    └── domain/

shared/
├── openapi/
├── proto/
└── ts-types/
```

**Structure Decision**: Use the existing monorepo web-application structure.
Implement editor and export as a vertical slice spanning frontend experience,
gateway contracts, backend persistence/export workflow orchestration, and shared
API contracts.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Post-Design Constitution Check

Post-Phase-1 Gate Result: PASS

- Research resolves external-library strategy without violating maintainability requirements.
- Data model formalizes document/editor-profile/export lifecycle and failure semantics.
- Contracts define explicit gateway and internal boundaries for editor configuration and export operations.
- Quickstart captures manual validation and rollback flow aligned with no-tests governance.
