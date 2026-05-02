# Implementation Plan: Full Document Create/Edit Flow

**Branch**: `[003-before-specify-hook]` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-document-create-edit-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Deliver the complete draft document create/edit journey across frontend, gateway, Go services, and PostgreSQL with contract-first updates, role-aware access control, optimistic locking conflict handling, and auditable change recording. The implementation reuses the monorepo hexagonal architecture and introduces no test authoring/execution tasks under current repository policy.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend + gateway), Go 1.23 (microservices), SQL (PostgreSQL)  
**Primary Dependencies**: Angular 21 standalone + signals + reactive forms, Fastify, gRPC (`google.golang.org/grpc`), shared proto/OpenAPI contracts, Taiga UI + project design system  
**Storage**: PostgreSQL (documents, document versions, audit events), optional Redis adjunct remains unchanged  
**Testing**: Current policy: do not create/modify/run tests unless explicitly requested and governance is amended  
**Target Platform**: Linux containers via Docker Compose locally; browser clients via Angular SSR frontend  
**Project Type**: Web application with BFF gateway and domain-split Go microservices  
**Performance Goals**: p95 create/edit API under 300ms at gateway edge (excluding network), conflict detection on every stale update attempt, zero silent overwrite  
**Constraints**: Preserve hexagonal boundaries, maintain backward compatibility of existing document routes, Russian-first user-facing content, WCAG-aligned interactions, no test tasks  
**Scale/Scope**: One end-to-end feature slice for create/edit draft lifecycle including persistence, conflict handling, and audit trace

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Clarity over cleverness: PASS. Feature split by bounded layers and explicit contracts.
- Consistency: PASS. Existing ports/adapters patterns are reused in frontend, gateway, and services.
- Design for change: PASS. Contract-first sequencing isolates future API evolution.
- Quality bar: PASS. Includes validation, conflict handling, rollback-safe migration approach.
- Accessibility: PASS. Plan includes keyboard/focus/semantics/contrast validation for new UI forms.
- Responsive/adaptive behavior: PASS. Plan includes mobile/desktop and long-content handling for create/edit forms.
- Policy check: PASS. No test authoring/execution work is introduced.

## Project Structure

### Documentation (this feature)

```text
specs/003-document-create-edit-flow/
├── plan.md
├── spec.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
├── frontend/
│   └── src/app/
│       ├── adapters/http/dashboard/documents/
│       ├── adapters/outbound/
│       ├── application/dashboard/
│       ├── domain/dashboard/
│       ├── guards/
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

infra/
└── postgres/

shared/
├── openapi/
├── proto/
└── ts-types/
```

**Structure Decision**: Keep the existing monorepo layout and implement create/edit as a vertical slice across shared contracts, gateway HTTP+gRPC adapters, Go service application/domain/adapters, and Angular dashboard document flows.

## Complexity Tracking

No constitution violations require exceptions.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
