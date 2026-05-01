# Gateway Routing Contract for Service Split

## Purpose
Define route ownership and compatibility behavior while moving traffic from draft `services/service` to target microservices.

## Public Entry Point Rule
- `apps/gateway` remains the only public ingress.
- Clients do not call internal microservices directly.
- Routing changes are performed behind gateway adapters in wave order.

## Route Ownership Map (Target)
- Document and workflow operations -> `document-service`
- Authorization checks and audit trail operations -> `authorization-audit-service`
- Signature initiation/callback/status -> `signature-service`
- Search/query projection and notification center operations -> `search-notification-service`

### Final Route-to-Service Ownership Matrix

| Gateway Route Family | Provider Service | Wave | Rollback Target |
|----------------------|------------------|------|-----------------|
| `/api/documents*` lifecycle/workflow | `document-service` | Wave 1 | Previous stable mapping within split services |
| `/api/documents/*/audit-events` | `authorization-audit-service` | Wave 2 | Previous stable mapping within split services |
| `/api/documents/*/signatures*` | `signature-service` | Wave 3 | Previous stable mapping within split services |
| `/api/search/documents` and `/api/search/notifications/center` | `search-notification-service` | Wave 4 | Previous stable mapping within split services |

## Compatibility Requirements
- Existing external routes and payload semantics remain stable during migration waves.
- Any behavioral change requires consumer sequencing and explicit deprecation notice.
- Gateway error mapping remains consistent regardless of target service provider.

## Cutover Rules
1. A route can cut over only when migration wave entry criteria are passed.
2. Gateway must support immediate fallback to prior provider during a wave.
3. A route is marked migrated only after validation criteria evidence is recorded.

## Cutover Decision Protocol
1. Confirm route eligibility and expected provider mapping for the current migration wave.
2. Capture baseline latency/error metrics for the route before changing provider target.
3. Execute gateway provider switch behind the same external route contract.
4. Validate functional and SLO checks in the validation window.
5. Mark route state as `CUTOVER` only after validation succeeds.

## Rollback Rules
- Rollback trigger examples:
  - Elevated 5xx rate above 2% for 5 consecutive minutes
  - Transaction completion drops below 95% success threshold
  - Contract violations detected by gateway adapter checks
- Rollback action:
  - Re-point route ownership to previous stable provider.
  - Preserve data integrity and idempotency semantics.

## Rollback Decision Protocol
1. Detect rollback trigger from SLO breach, contract mismatch, or critical business-flow failure.
2. Approve rollback by wave owner and on-call operations owner.
3. Execute provider re-point in gateway and verify route health recovers.
4. Mark migration wave execution as `ROLLED_BACK` and record evidence links.
5. Re-open wave only after root-cause notes and retry criteria are documented.

## Decommission Dependency Rule
All gateway routes must point to target microservices (or approved replacements) before draft service retirement is approved.
