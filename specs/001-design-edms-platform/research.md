# Research: Scalable EDMS Platform

## Decision 1: Frontend architecture uses Angular SSR with minimal external UI/runtime dependencies
- Decision: Keep Angular SSR as the primary frontend model and avoid introducing additional state-management or heavy UI frameworks.
- Rationale: Matches current repository conventions, lowers integration risk, and supports maintainability/KISS.
- Alternatives considered:
  - Introduce additional frontend framework layers: rejected due to unnecessary complexity.
  - Client-only SPA mode: rejected because SSR is already a platform requirement.

## Decision 2: Gateway remains the sole public entrypoint (BFF pattern)
- Decision: Route all user-facing API calls through `apps/gateway` and keep microservices private over gRPC.
- Rationale: Centralized auth/session enforcement, consistent API shape for frontend, easier policy enforcement.
- Alternatives considered:
  - Frontend calling microservices directly: rejected for security and coupling concerns.
  - Expose each microservice publicly: rejected due to duplicated auth/policy logic.

## Decision 3: Authentication and sessions use Keycloak + Redis via gateway adapters
- Decision: Use Keycloak as identity provider and Redis for session/token context at the BFF layer.
- Rationale: Aligns with existing infrastructure and keeps auth volatility isolated in outbound adapters.
- Alternatives considered:
  - Stateless JWT-only flow with no session storage: rejected due to weaker centralized session control for this workflow-heavy product.
  - Build custom identity provider: rejected as unnecessary and high risk.

## Decision 4: Main business logic stays in Go microservices with gRPC contracts
- Decision: Implement core EDMS domains (workflow, documents, signatures, search orchestration) in Go services behind gRPC ports.
- Rationale: Aligns with architecture mandate and supports independent scaling per domain.
- Alternatives considered:
  - Move core logic into gateway: rejected because it breaks service boundary intent and scalability.
  - REST for all internal service communication: rejected; gRPC is an explicit requirement.

## Decision 5: Data persistence uses PostgreSQL as source of truth + object storage for binaries
- Decision: Store transactional metadata/state in PostgreSQL and store archives/images in S3-compatible object storage (MinIO for self-hosted baseline).
- Rationale: Separates large binary storage from relational workflow data; MinIO offers modern S3 API compatibility and deployment flexibility.
- Alternatives considered:
  - Store files directly in PostgreSQL BLOB columns: rejected for operational overhead and poorer scalability.
  - Network file system only: rejected due to weaker API standardization and portability.

## Decision 6: E-signature integration remains provider-agnostic behind an outbound port
- Decision: Define a signature-provider port with adapter implementations to support legally binding signing vendors.
- Rationale: Legal/compliance vendor selection may vary; a stable port avoids domain coupling.
- Alternatives considered:
  - Hard-code a single vendor SDK inside core services: rejected due to lock-in and change risk.
  - Build custom cryptographic signing stack: rejected due to legal certification complexity.

## Decision 7: Search strategy uses Elasticsearch as a dedicated search engine from day one
- Decision: Implement search on Elasticsearch 8.x immediately, with PostgreSQL remaining the source of truth and asynchronous indexing pipelines for searchable projections.
- Rationale: EDMS requires fast, flexible multi-filter search across metadata and text content; Elasticsearch provides relevance tuning, pagination performance, and future-ready analyzers with lower product risk than stretching relational search.
- Alternatives considered:
  - PostgreSQL metadata-first only: rejected due to weaker full-text relevance and scalability for complex filtering.
  - Full text search only in object storage: rejected due to weak filtering/governance controls.

## Decision 8: Notifications use event-driven dispatch from workflow state transitions
- Decision: Emit domain events from core workflow transitions and process notifications asynchronously.
- Rationale: Improves responsiveness of user actions and isolates notification channel failures.
- Alternatives considered:
  - Synchronous notification in request path: rejected due to latency and reliability risk.
  - Polling-only approach: rejected for delayed user awareness.
