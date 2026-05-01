# Data Model: Service Decomposition and Migration Control

## Entity: Microservice
- Description: A deployable Go service that owns a cohesive EDMS capability set.
- Fields:
  - id (string, slug, unique)
  - name (string, required)
  - ownedCapabilities (set<CapabilityBoundary>, required)
  - ownerTeam (string, required)
  - runtimeStatus (enum: DRAFT, ACTIVE, DRAINING, RETIRED)
  - deploymentTarget (string, required)
  - createdAt (timestamp, required)
  - updatedAt (timestamp, required)
- Validation rules:
  - `ownedCapabilities` must not be empty
  - capability ownership must be exclusive across ACTIVE services

## Entity: CapabilityBoundary
- Description: A business function currently implemented in draft service and assigned to one microservice.
- Fields:
  - id (string, unique)
  - capabilityName (string, required)
  - sourceComponent (string, required)
  - targetMicroserviceId (string, required)
  - dependencyRisk (enum: LOW, MEDIUM, HIGH)
  - migrationStatus (enum: PLANNED, IN_PROGRESS, VALIDATED, ROLLED_BACK)
- Validation rules:
  - every in-scope capability maps to exactly one target service
  - `sourceComponent` must reference an existing draft-service module/use case

## Entity: MigrationWave
- Description: A controlled migration slice containing one or more capabilities moved together.
- Fields:
  - id (string, unique)
  - sequence (integer, required, > 0)
  - includedCapabilities (set<CapabilityBoundary>, required)
  - entryCriteria (array<string>, required)
  - validationCriteria (array<string>, required)
  - rollbackCriteria (array<string>, required)
  - exitCriteria (array<string>, required)
  - state (enum: PLANNED, READY, EXECUTING, VALIDATING, COMPLETE, ROLLED_BACK)
  - owner (string, required)
  - metricWindowStartAt (timestamp, optional)
  - metricWindowEndAt (timestamp, optional)
  - rollbackExecutedAt (timestamp, optional)
  - startedAt (timestamp, optional)
  - completedAt (timestamp, optional)
- Validation rules:
  - sequence numbers are unique and strictly increasing
  - a wave cannot move to COMPLETE without validation criteria evidence
  - rollback criteria must be defined before EXECUTING

## Entity: MigrationWaveExecution
- Description: Runtime execution audit for a single wave attempt.
- Fields:
  - id (string, unique)
  - migrationWaveId (string, required)
  - attempt (integer, required, > 0)
  - providerBefore (string, required)
  - providerAfter (string, required)
  - cutoverAt (timestamp, required)
  - validationOutcome (enum: PASS, FAIL, PENDING)
  - rollbackOutcome (enum: NOT_REQUIRED, SUCCESS, FAILED)
  - notes (string, optional)
- Validation rules:
  - each `(migrationWaveId, attempt)` pair is unique
  - rollbackOutcome `SUCCESS|FAILED` requires validationOutcome `FAIL`

## Entity: ServiceContract
- Description: Interaction agreement for gateway-to-service and service-to-service behavior.
- Fields:
  - id (string, unique)
  - contractType (enum: GATEWAY_ROUTE, INTERNAL_GRPC)
  - producerServiceId (string, required)
  - consumer (string, required)
  - version (string, required)
  - compatibilityMode (enum: ADDITIVE, BREAKING, DEPRECATED)
  - status (enum: DRAFT, ACTIVE, SUNSET)
  - updatedAt (timestamp, required)
- Validation rules:
  - BREAKING contracts require migration sequencing and approval
  - all ACTIVE contracts must have an owning producer service

## Entity: ConsumerDependency
- Description: Upstream/downstream integration depending on the draft or target services.
- Fields:
  - id (string, unique)
  - consumerName (string, required)
  - interfaceType (enum: HTTP, GRPC, EVENT)
  - currentProvider (string, required)
  - targetProvider (string, required)
  - migrationWaveId (string, required)
  - migrationState (enum: NOT_STARTED, MIGRATING, CUTOVER, COMPLETE)
  - cutoverAt (timestamp, optional)
  - rollbackAt (timestamp, optional)
- Validation rules:
  - every active dependency must be assigned to a migration wave
  - dependencies must be COMPLETE before draft service decommission
  - rollbackAt is allowed only when migrationState transitions from CUTOVER to MIGRATING

## Entity: DecommissionGate
- Description: Control record proving readiness to retire draft `services/service`.
- Fields:
  - id (string, unique)
  - gateName (string, required)
  - criteria (array<string>, required)
  - evidenceLinks (array<string>, required)
  - approvedBy (array<string>, required)
  - approvalMatrix (array<object>, required)
  - gateOutcome (enum: NOT_EVALUATED, PASSED, FAILED, WAIVED)
  - gateStatus (enum: OPEN, PASSED, FAILED)
  - evaluatedAt (timestamp, required)
- Validation rules:
  - all mandatory gates must be PASSED before RETIRED state
  - evidence links must be present for PASSED status
  - approvalMatrix entries must include role, approver, decision, and decisionAt

## Entity: DecommissionOutcome
- Description: Final retirement evidence for draft service decommission.
- Fields:
  - id (string, unique)
  - draftServiceRuntimeStatus (enum: ACTIVE, DRAINING, RETIRED)
  - zeroTrafficWindowDays (integer, required)
  - dependencyClosureStatus (enum: OPEN, COMPLETE)
  - retirementApprovedBy (array<string>, required)
  - finalizedAt (timestamp, required)
- Validation rules:
  - `draftServiceRuntimeStatus` can be `RETIRED` only if dependencyClosureStatus is `COMPLETE`
  - `zeroTrafficWindowDays` must be >= 30 for final retirement

## Relationships
- Microservice 1 -> N CapabilityBoundary
- MigrationWave N <-> N CapabilityBoundary
- MigrationWave 1 -> N MigrationWaveExecution
- Microservice 1 -> N ServiceContract (as producer)
- MigrationWave 1 -> N ConsumerDependency
- DecommissionGate references many MigrationWave and ConsumerDependency outcomes
- DecommissionOutcome references many DecommissionGate records as retirement evidence

## State Transitions
- Microservice.runtimeStatus:
  - DRAFT -> ACTIVE
  - ACTIVE -> DRAINING
  - DRAINING -> RETIRED
- CapabilityBoundary.migrationStatus:
  - PLANNED -> IN_PROGRESS -> VALIDATED
  - IN_PROGRESS -> ROLLED_BACK
  - ROLLED_BACK -> IN_PROGRESS (retry)
- MigrationWave.state:
  - PLANNED -> READY -> EXECUTING -> VALIDATING -> COMPLETE
  - EXECUTING|VALIDATING -> ROLLED_BACK
  - ROLLED_BACK -> READY
- ConsumerDependency.migrationState:
  - NOT_STARTED -> MIGRATING -> CUTOVER -> COMPLETE
  - CUTOVER -> MIGRATING (rollback)
- ServiceContract.status:
  - DRAFT -> ACTIVE -> SUNSET
- DecommissionGate.gateStatus:
  - OPEN -> PASSED
  - OPEN -> FAILED -> OPEN
- DecommissionOutcome.draftServiceRuntimeStatus:
  - ACTIVE -> DRAINING -> RETIRED
