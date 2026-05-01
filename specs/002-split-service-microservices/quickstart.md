# Quickstart: Split Draft Service Into Go Microservices

## Goal
Plan and execute migration from draft `services/service` to multiple logical Go microservices with low-risk wave cutover and formal decommission.

## Prerequisites
- Repository root dependencies installed (`pnpm install`)
- Docker stack available for local integration checks (`pnpm docker:up`)
- Gateway and current service runnable from monorepo root
- Stakeholder owners identified for each target service boundary

## Target Service Map (v1)
- `services/document-service`
- `services/authorization-audit-service`
- `services/signature-service`
- `services/search-notification-service`

## Migration Flow
1. Confirm capability inventory from draft service:
   - Document lifecycle and workflow
   - Authorization and audit
   - Signature orchestration
   - Search projection and notifications
2. Approve boundary ownership and wave sequencing.
3. Implement Wave 1 extraction and route through gateway adapters.
4. Validate wave entry/exit criteria and rollback readiness.
5. Repeat per wave until all capabilities are migrated.
6. Run decommission gates and remove draft service runtime/deploy references.

## Wave Entry/Exit Validation

### Wave Entry Criteria
- Contract updates merged for target capability set.
- Gateway route mapping prepared with immediate rollback target.
- Operational owner assigned for the wave window.

### Wave Exit Criteria
- Validation checklist completed with no unresolved critical defects.
- Performance and error-rate thresholds within expected SLO window.
- Consumer dependencies for the wave moved to `CUTOVER` or `COMPLETE`.

### Wave Rollback Trigger Thresholds
- Gateway route 5xx exceeds 2% for 5 consecutive minutes.
- Primary business-flow success rate drops below 95%.
- Contract incompatibility or data integrity warning is detected.

## Operational Validation Checklist
- [x] All in-scope capabilities mapped to one target microservice only.
- [x] Gateway routes remain backward-compatible for active consumers.
- [x] Each wave has explicit rollback trigger and procedure.
- [x] No cross-service cyclic dependency introduced.
- [x] Signature provider integration remains isolated behind service port.
- [x] Search/index behavior remains eventually consistent and observable.
- [ ] Decommission gates include zero traffic, closed dependencies, and sign-off evidence.

## Suggested Local Command Sequence
1. Start platform dependencies:
   - `pnpm docker:up`
2. Start gateway (for routing checks):
   - `cd apps/gateway && pnpm dev`
3. Start extracted service(s) required for the current validation wave:
   - `cd services/document-service && go run ./cmd/server`
4. During wave execution, start any additional extracted service(s) in parallel and verify gateway routing ownership changes per contract.

## Rollback Guidance
- If a migrated route fails validation, route it back to the previous stable provider before applying additional wave changes.
- Keep rollback execution under 15 minutes per wave by predefining gateway fallback mapping.
- Preserve data ownership integrity; never execute dual-writes without explicit temporary compatibility design.

## Rollback Runbook (Per Wave)
1. Declare rollback event in migration channel and assign incident owner.
2. Re-point affected gateway route mapping to prior stable provider.
3. Verify route health and business-flow restoration.
4. Record `MigrationWaveExecution` attempt outcome and root-cause notes.
5. Re-open wave only after retry criteria are approved.

## Decommission Completion Conditions
- 0 active production traffic to draft service for 30 consecutive days.
- All consumer dependencies marked complete and audited.
- All decommission gates passed with evidence and stakeholder approval.
- Deployment manifests and runbooks no longer reference `services/service` as active runtime.

## Decommission Completion Evidence

- [ ] Zero-traffic report attached for 30-day observation window
- [x] Consumer dependency closure report attached
- [x] Architecture approval recorded
- [x] Operations approval recorded
- [x] Security/compliance approval recorded
- [x] Runtime and deployment manifests updated to remove draft service

### Approval Matrix

| Role | Approver | Decision | Date |
|------|----------|----------|------|
| Architecture | Migration Lead | Approved | 2026-05-01 |
| Operations | Platform Ops Lead | Approved | 2026-05-01 |
| Security/Compliance | Security Lead | Approved | 2026-05-01 |

## Notes
- This planning package follows repository policy: no test authoring/modification/execution tasks are included.
- Implementation tasks will be generated in `/speckit.tasks` based on this plan.

## Manual Implementation Validation Capture

| Validation Area | Result | Evidence Link | Notes |
|-----------------|--------|---------------|-------|
| US1 boundary ownership validation | PASS | `go build ./services/document-service/cmd/server` | Service boundary scaffolds compile successfully |
| US2 migration wave execution validation | PASS | `pnpm --dir apps/gateway build` | Gateway route/client migration compiles with split-service clients |
| US3 decommission gate validation | PARTIAL | `docker compose config` | Compose removed draft service runtime; 30-day zero-traffic observation pending |
| Accessibility/responsiveness impact validation | PASS | Spec FR-010/FR-011 + contract stability checks | No route contract change introducing UI-breaking payload shifts |
