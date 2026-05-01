# Implementation Plan: Scalable EDMS Platform

**Branch**: `001-design-edms-platform` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-design-edms-platform/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Build a scalable EDMS that digitizes internal approval workflows, supports
legally binding e-signatures, enforces RBAC with complete auditability, and
provides archival search and lifecycle notifications. The solution uses Angular
SSR frontend, a BFF gateway for authentication/session orchestration, and
Go-based microservices over gRPC with PostgreSQL as system-of-record,
Elasticsearch as the dedicated search engine, and S3-compatible object storage
for archives and images.

## Technical Context

**Language/Version**: TypeScript 5.x (Angular 21 SSR frontend + Node.js 22 gateway), Go 1.23 (microservices)  
**Primary Dependencies**: Angular SSR, Fastify BFF, Keycloak OIDC integration, Redis session store, gRPC tooling, PostgreSQL drivers, Elasticsearch 8.x client, S3-compatible object storage SDK  
**Storage**: PostgreSQL 16 (transactional data), Redis 7 (sessions/cache), Elasticsearch 8.x (search index), S3-compatible object storage (archive files and images)  
**Testing**: [Current policy: do not create/modify/run tests unless explicitly requested and governance is amended]  
**Target Platform**: Linux containers via Docker Compose (local) and container orchestration-ready environments (staging/production)
**Project Type**: Web application + BFF + distributed microservices architecture  
**Performance Goals**: p95 read/search response <2s for standard queries, p95 workflow transition API <500ms (excluding external signature provider latency), notification dispatch within 60s  
**Constraints**: Hexagonal architecture boundaries, minimal external libraries in frontend, SSR-safe browser API usage, no test authoring/execution tasks under current governance, Russian-first end-user copy by default  
**Scale/Scope**: Initial rollout for internal users and approved external signers; designed for departmental growth (HR + Finance) with horizontal service scaling

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Clarity over cleverness: design and naming are understandable for future maintainers.
- Consistency: existing conventions/utilities/components are reused where appropriate.
- Design for change: volatile dependencies are isolated behind stable interfaces/ports.
- Quality bar: reliability, security, and performance risks are identified and mitigated.
- Accessibility: keyboard/focus/semantics/contrast requirements are covered.
- Responsive/adaptive behavior: mobile/desktop, long content, and localization are addressed.
- Policy check: no test authoring/execution tasks are included unless explicitly requested.

## Project Structure

### Documentation (this feature)

```text
specs/001-design-edms-platform/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
apps/
├── frontend/
│   └── src/app/
│       ├── domain/
│       ├── application/
│       ├── ports/
│       └── adapters/
└── gateway/
  └── src/
    ├── domain/
    ├── application/
    ├── ports/
    └── adapters/
      ├── inbound/http/
      └── outbound/
        ├── grpc/
        ├── oidc/
        └── redis/

services/
└── service/
  └── internal/
    ├── domain/
    ├── application/
    ├── ports/
    └── adapters/
      ├── inbound/grpc/
      └── outbound/
        ├── postgres/
        ├── redis/
        ├── elasticsearch/
        └── objectstorage/

shared/
├── proto/
├── openapi/
└── ts-types/
```

**Structure Decision**: Use the existing monorepo web + BFF + Go microservice
layout and extend it with EDMS bounded contexts. No new top-level applications
are required; feature-specific modules are added inside the established
hexagonal layers, including a dedicated Elasticsearch outbound adapter for
search indexing and querying.

## Complexity Tracking

No constitution violations require exception handling at this stage.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|


## Post-Design Constitution Check

Post-Phase-1 Gate Result: PASS
- Research decisions prefer simple/scalable defaults and isolate volatile dependencies.
- Data model reflects cohesive modules and explicit authorization/audit boundaries.
- Contracts separate external API concerns (BFF) from internal gRPC contracts.
- Quickstart includes accessibility/responsiveness validation expectations and avoids testing mandates.
