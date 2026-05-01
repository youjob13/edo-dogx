# Implementation Plan: Split Service Into Logical Go Microservices

**Branch**: `[002-split-service-microservices]` | **Date**: 2026-05-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-split-service-microservices/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This implementation splits the previous draft Go EDMS service into multiple
domain-aligned microservices, migrates traffic in controlled waves through the
existing gateway, and reaches the target end-state where `services/service` is
retired after formal decommission gates. The approach uses bounded contexts,
explicit inter-service contracts, backward-compatible gateway routing, and
strangler-style cutover with fast rollback.

## Technical Context

**Language/Version**: Go 1.23 (microservices), TypeScript 5.x (gateway orchestration compatibility)  
**Primary Dependencies**: gRPC (`google.golang.org/grpc`), PostgreSQL adapters, Redis adapters, Elasticsearch Go client, existing gateway gRPC client adapters  
**Storage**: PostgreSQL as source of truth, Redis for operational/session adjunct data where applicable, Elasticsearch for search projections  
**Testing**: Current policy: do not create/modify/run tests unless explicitly requested and governance is amended  
**Target Platform**: Linux containers via Docker Compose locally; container orchestration-ready deployment targets in staging/production  
**Project Type**: Distributed backend architecture (BFF gateway + multiple Go microservices)  
**Performance Goals**: Gateway-to-service p95 < 300ms for non-search command/query calls; search p95 < 2s; rollback execution < 15 minutes per migration wave  
**Constraints**: Preserve hexagonal architecture boundaries, maintain external behavior compatibility during migration, avoid cross-service cyclic dependencies, and keep no-test policy compliance  
**Scale/Scope**: Decompose the existing draft EDMS capabilities into independently deployable services while keeping all core flows available during cutover

## Retirement Status

- Draft runtime `services/service`: RETIRED (target end-state after decommission gate completion)
- Active providers: `document-service`, `authorization-audit-service`, `signature-service`, `search-notification-service`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Clarity over cleverness: PASS. Service boundaries are named by business capability with explicit ownership maps.
- Consistency: PASS. Existing monorepo conventions (gateway as public entrypoint, hexagonal layers, shared contracts) are preserved.
- Design for change: PASS. Volatile integrations (signature provider, indexing, messaging) remain behind outbound ports.
- Quality bar: PASS. Migration waves include validation and rollback criteria before traffic expansion.
- Accessibility: PASS (N/A direct UI changes in this feature). Frontend contract stability is preserved for user-facing paths.
- Responsive/adaptive behavior: PASS (N/A direct UI layout changes). API compatibility avoids UX regressions.
- Policy check: PASS. No test authoring/execution tasks are planned.

## Project Structure

### Documentation (this feature)

```text
specs/002-split-service-microservices/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── gateway-routing.md
│   └── internal-grpc-split.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/
└── gateway/
    └── src/
        └── adapters/outbound/grpc/

services/
├── service/                         # Draft monolith to be retired
├── document-service/                # New: document lifecycle + workflow core
├── authorization-audit-service/     # New: authorization policy + audit recording
├── signature-service/               # New: signature orchestration + provider integration
└── search-notification-service/     # New: search projection + notification dispatch

shared/
└── proto/
```

**Structure Decision**: Use the existing monorepo with `apps/gateway` as the only public API entrypoint and split `services/service` into four Go microservices aligned to cohesive business domains. Keep inter-service contracts in `shared/proto` and phase out `services/service` only after migration and dependency closure.

### Target Decomposition Ownership

| Capability Cluster | Target Microservice | Primary Owner | Notes |
|--------------------|---------------------|---------------|-------|
| Document lifecycle and workflow transitions | `document-service` | Platform Workflow Team | Owns draft/update/search/archive and workflow transition guards |
| Authorization checks and audit append/read | `authorization-audit-service` | Security and Compliance Team | Owns policy decisions and immutable audit event records |
| Signature initiation, callback, and status tracking | `signature-service` | Trust Integrations Team | Owns provider integration contract and signature state machine |
| Search projection sync and notification dispatch | `search-notification-service` | Platform Experience Team | Owns eventually consistent projection and notification retry behavior |

## Migration Wave Plan (High-Level)

1. Wave 1: Extract `document-service` and route document read/write + workflow core calls through gateway with compatibility adapters.
2. Wave 2: Extract `authorization-audit-service` and move policy checks + audit writes to dedicated endpoints/contracts.
3. Wave 3: Extract `signature-service` and reroute signature start/callback/status paths.
4. Wave 4: Extract `search-notification-service` and reroute search projection + notification flows.
5. Wave 5: Execute decommission gate checks, remove residual routes/deployments for `services/service`, and complete retirement.

## Complexity Tracking

No constitution violations require exception handling at this stage.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|

## Final SLO and Reliability Notes

- Route-level migration SLOs:
    - Gateway-to-service p95 latency under 300ms for non-search flows.
    - Search projection read p95 latency under 2s.
    - Rollback completion under 15 minutes for any migration wave.
- Reliability guardrails:
    - Rollback trigger when route 5xx > 2% for 5 consecutive minutes.
    - Business-flow completion must remain >= 95% during wave execution.
    - Wave owner must record metrics and evidence links before sign-off.

## Stakeholder Reporting Cadence

- Weekly migration status report owned by migration lead.
- Report fields: current wave, completed capabilities, open risks, blocked dependencies, decommission readiness.
- Review participants: architecture, operations, security/compliance, service owners.

## Post-Design Constitution Check

Post-Phase-1 Gate Result: PASS

- Research resolves architecture unknowns with explicit decomposition and compatibility strategy.
- Data model defines migration control entities (wave, dependency, gate, contract ownership).
- Contracts document gateway routing responsibilities and internal gRPC boundaries for each service.
- Quickstart includes migration validation and rollback exercises without introducing test tasks.
