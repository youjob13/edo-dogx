# Электронный документооборот (ЭДО)

Monorepo for an Electronic Document Management System.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (SSR) |
| API Gateway (BFF) | Node.js · Fastify · TypeScript |
| Microservices | Go |
| Inter-service communication | gRPC |
| Auth | Keycloak 24 |
| Database | PostgreSQL 16 |
| Session store | Redis 7 |
| Orchestration | Docker Compose |
| Node package manager | pnpm (workspaces) |
| Go workspace | go.work |
| CI | GitHub Actions |

## Repository Structure

```
edo/
├── apps/
│   ├── frontend/               # Angular 21 SSR
│   │   └── src/app/
│   │       ├── domain/         # Entities, value objects
│   │       ├── application/    # Use cases
│   │       ├── ports/          # Inbound / outbound interfaces
│   │       └── adapters/       # HTTP client, UI components
│   └── gateway/                # Node.js BFF (Fastify)
│       └── src/
│           ├── domain/
│           ├── application/
│           ├── ports/
│           └── adapters/
│               ├── inbound/http/    # HTTP routes
│               └── outbound/
│                   ├── grpc/        # gRPC clients to microservices
│                   └── redis/       # Session store
├── services/
│   └── service/                # Go microservice (placeholder)
│       ├── cmd/server/         # Entrypoint
│       └── internal/
│           ├── domain/
│           │   ├── model/      # Aggregates, entities, value objects
│           │   └── repository/ # Repository interfaces (outbound ports)
│           ├── application/service/  # Use cases
│           ├── ports/
│           │   ├── inbound/    # Driving port interfaces
│           │   └── outbound/   # Driven port interfaces
│           └── adapters/
│               ├── inbound/grpc/       # gRPC server
│               └── outbound/
│                   ├── postgres/       # PostgreSQL adapter
│                   └── redis/          # Redis adapter
├── shared/
│   ├── proto/                  # Protobuf contracts (source of truth)
│   ├── openapi/                # OpenAPI spec (BFF public API)
│   └── ts-types/               # Shared TypeScript types (@edo/ts-types)
├── infra/
│   ├── keycloak/               # Realm export for auto-import
│   └── postgres/               # DB initialisation SQL
├── .github/workflows/          # GitHub Actions CI
├── docker-compose.yml
├── go.work                     # Go workspace (all services)
├── pnpm-workspace.yaml
└── .env.example
```

## Hexagonal Architecture (Ports & Adapters)

Each application and service follows the same layered structure:

```
          ┌─────────────────────────────────┐
          │            Domain               │  ← Pure business logic, no deps
          │   (Entities · Value Objects)    │
          └─────────────────────────────────┘
                         ↑
          ┌─────────────────────────────────┐
          │          Application            │  ← Use cases / orchestration
          │   (Services · Commands/Queries) │
          └─────────────────────────────────┘
          ↑  Inbound ports          Outbound ports  ↓
┌──────────────────┐            ┌──────────────────────┐
│ Inbound Adapters │            │  Outbound Adapters   │
│ (gRPC / HTTP)    │            │  (Postgres / Redis)  │
└──────────────────┘            └──────────────────────┘
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js ≥ 22, pnpm ≥ 9 (for local dev without Docker)
- Go 1.23 (for local dev without Docker)

### Run with Docker Compose

```bash
cp .env.example .env
# Fill in secrets in .env
docker compose up -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost:4000 |
| API Gateway | http://localhost:3000 |
| Keycloak Admin | http://localhost:8080 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Local Development

```bash
# Install Node dependencies
pnpm install

# Start gateway in watch mode
pnpm dev:gateway

# Start frontend dev server
pnpm dev:frontend

# Start Go service
cd services/service && go run ./cmd/server
```

### Proto code generation

```bash
# Install protoc + plugins first, then:
protoc --go_out=. --go-grpc_out=. shared/proto/service.proto
```

## Adding a New Microservice

1. Create `services/<name>/` with the same hexagonal structure as `services/service/`.
2. Add the module to `go.work`: `use ./services/<name>`.
3. Add the service to `docker-compose.yml`.
4. Add a proto contract in `shared/proto/`.
5. Add a CI workflow in `.github/workflows/`.
