# Research: Split Draft Go Service Into Logical Microservices

## Decision 1: Decompose by bounded capability, not by technical layer
- Decision: Split the draft `services/service` into domain-aligned services: `document-service`, `authorization-audit-service`, `signature-service`, and `search-notification-service`.
- Rationale: Existing code already clusters by business capability (`document_lifecycle`, `authorization_policy`, `signature_flow`, `search_projection_sync`, `notification_dispatcher`), enabling clear ownership and independent scaling.
- Alternatives considered:
  - Keep one service with internal packages only: rejected because it preserves deployment coupling and weak ownership boundaries.
  - Split into too many tiny services (one per use case): rejected due to high operational overhead and excessive cross-service chatter.

## Decision 2: Keep gateway as the sole public API entrypoint during migration
- Decision: Route all client-facing traffic through `apps/gateway` and migrate backend targets behind gateway adapters.
- Rationale: Preserves external API compatibility while allowing internal service movement and wave-based cutovers.
- Alternatives considered:
  - Expose new microservices directly: rejected due to security duplication and consumer migration complexity.
  - Big-bang endpoint swap: rejected due to high cutover risk.

## Decision 3: Use strangler migration with explicit wave-level rollback
- Decision: Migrate capabilities in waves, each with entry/exit validation and rollback guardrails.
- Rationale: Reduces blast radius and allows partial progress while maintaining service continuity.
- Alternatives considered:
  - Full rewrite + single cutover: rejected due to unacceptable regression and rollback risk.
  - Per-request runtime fan-out from monolith to all new services immediately: rejected because it obscures ownership and debugging.

## Decision 4: Define data ownership per service and forbid shared-write ambiguity
- Decision: Assign each aggregate to a single service owner; other services consume through contracts/events/query APIs.
- Rationale: Prevents split-brain updates and keeps consistency model understandable.
- Alternatives considered:
  - Shared database writes by multiple services: rejected due to coupling and data integrity risk.
  - Separate database per service from day one with mandatory dual-write: rejected initially due to migration complexity; can be phased later.

## Decision 5: Keep gRPC as internal contract protocol
- Decision: Continue internal service communication over gRPC and update `shared/proto/service.proto` with service-specific contracts.
- Rationale: Aligns with current architecture and existing adapters, minimizing protocol churn during decomposition.
- Alternatives considered:
  - Switch internal communication to REST: rejected because it adds migration cost without direct benefit in this phase.
  - Use async-only messaging for all interactions: rejected because command/query flows still need synchronous semantics.

## Decision 6: Preserve signature provider isolation behind outbound port
- Decision: Move signature orchestration to `signature-service` while retaining provider-specific logic behind `ports/outbound/signature_provider.go`.
- Rationale: External provider behavior remains volatile and must not leak into core domain contracts.
- Alternatives considered:
  - Embed provider SDK directly into gateway: rejected due to boundary violations.
  - Keep signature logic in draft service until final wave: rejected because signature flow is a distinct bounded context.

## Decision 7: Search and notification remain eventually consistent capabilities
- Decision: Place projection sync and notification dispatch in `search-notification-service` with explicit eventual consistency behavior.
- Rationale: These flows are asynchronous by nature and benefit from independent scaling/retry policy.
- Alternatives considered:
  - Keep them tightly coupled to document commands: rejected due to latency and failure propagation.
  - Split search and notification into separate services immediately: deferred to avoid premature operational fragmentation.

## Decision 8: Decommission is gated by objective operational checks
- Decision: Retire `services/service` only after zero-traffic verification, closed dependencies, and stakeholder sign-off.
- Rationale: Formal gates prevent accidental production reliance on deprecated runtime paths.
- Alternatives considered:
  - Remove draft service once new services are deployed: rejected due to hidden dependencies risk.
  - Keep draft service indefinitely as fallback: rejected because it undermines architectural completion.
