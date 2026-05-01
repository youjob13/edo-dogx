# Agent Instructions — EDO Monorepo

See [README.md](README.md) for project overview, tech-stack table, and directory structure.

---

## Commands

### Root (run from repo root)
```bash
pnpm install          # install all workspaces + sets up git hooks
pnpm lint:all         # lint frontend + gateway
pnpm build:all        # build frontend + gateway (pnpm -r build)
pnpm test:all         # test frontend + gateway
pnpm docker:up        # start postgres, redis, keycloak, service, gateway, frontend
pnpm docker:down      # stop all containers
```

### Frontend (`apps/frontend`)
```bash
pnpm dev              # ng serve — dev server on :4200
pnpm build            # ng build (production SSR)
pnpm lint             # ESLint via ng lint (flat config)
pnpm format           # Prettier write src/**/*.{ts,html,scss}
pnpm test             # Karma + Jasmine (ChromeHeadless)
```

### Gateway (`apps/gateway`)
```bash
pnpm dev              # tsx watch src/main.ts — hot reload
pnpm build            # tsc → dist/
pnpm lint             # ESLint (flat config)
pnpm format           # Prettier write src/**/*.ts
pnpm test             # vitest run
```

### Go service (`services/service`)
```bash
go run ./cmd/server   # run service
go build ./cmd/server # build binary
go test ./...         # run tests
go mod tidy           # sync go.mod/go.sum
```

---

## Architecture

Every app follows **Hexagonal Architecture**. Layers in order from inner to outer:

```
domain/          ← pure business logic, no framework deps
application/     ← use cases, orchestrate domain
ports/
  inbound/       ← interfaces that drive the app (implemented by adapters/inbound)
  outbound/      ← interfaces the app depends on (implemented by adapters/outbound)
adapters/
  inbound/http   ← HTTP routes (Fastify) / Angular components
  outbound/grpc  ← gRPC clients
  outbound/redis ← Redis session store
  outbound/postgres ← PostgreSQL repository (Go)
```

**Dependency rule**: inner layers never import outer layers. Ports are the only allowed crossing point.

---

## Contracts (source of truth)

- **gRPC**: [shared/proto/service.proto](shared/proto/service.proto) — modify this first, then regenerate stubs
- **REST API**: [shared/openapi/openapi.yaml](shared/openapi/openapi.yaml) — Gateway public API spec
- **Shared TS types**: [shared/ts-types/src/index.ts](shared/ts-types/src/index.ts) — import as `@edo/types` in both frontend and gateway

---

## Conventions

### Global policy
- **NEVER write tests.** Do not create, modify, or run unit tests, integration tests, E2E tests, or test snapshots in this repository.

### TypeScript (frontend & gateway)
- `@edo/types` path alias is defined in each `tsconfig.json` → `../../shared/ts-types/src/index.ts`
- Do not import from `shared/ts-types` by relative path; always use `@edo/types`
- ESLint flat config (`eslint.config.js`) at each app root; do not create `.eslintrc` files
- Prettier config at each app root (`.prettierrc`); formatting rules are shared

### Angular (frontend)
- Component selector prefix: `edo-dogx` (kebab-case elements, camelCase attributes)
- Standalone components only — do **not** use `NgModule`
- Standalone by default, no need to manually specify `standalone: true` option
- **CRITICAL — Localization policy**: all user-facing page content must be in Russian by default
- For multilingual support, use Angular built-in internationalization (`@angular/localize` + Angular i18n workflow) instead of ad-hoc custom translation solutions
- SSR is enabled; avoid browser-only APIs without `isPlatformBrowser` guards
- Styles: SCSS for component styles, Less for Taiga UI theme imports
- Taiga UI is used for UX components
- Prioritize readability and maintainability over clever abstractions; keep functions/components focused and predictable
- Meet WCAG expectations (keyboard navigation, focus states, semantic markup, sufficient contrast, ARIA only when needed)
- Build responsive and adaptive interfaces for mobile/desktop, long content, and localization expansion
- Keep motion subtle and purposeful; error messages must be precise, friendly, and actionable

### Commits
Angular commit format is enforced by commitlint on every commit:
```
<type>(<scope>): <subject>

Types: build | ci | docs | feat | fix | perf | refactor | revert | style | test
```
The `commit-msg` git hook runs automatically after `pnpm install`.

### Git hooks (native, no Husky)
Hooks live in [.githooks/](.githooks/) and are activated via `git config core.hooksPath .githooks`.
- `pre-commit` — runs lint + build for frontend and gateway
- `commit-msg` — runs commitlint

---

## Infrastructure

| Service | Port | Credentials |
|---------|------|-------------|
| Frontend | 4000 | — |
| Gateway | 3000 | — |
| Keycloak | 8080 | see `.env` |
| PostgreSQL | 5432 | see `.env` |
| Redis | 6379 | — |

A `.env` file is required at the repo root before running Docker. Copy `.env.example` if it exists. Minimum required: `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`.

---

## Pitfalls

- **Go workspace**: `go.work` coordinates all Go modules. Run `go work sync` after adding a new Go module.
- **pnpm workspace deps**: cross-package deps use `"workspace:*"` — never pin with a version number.
- **SSR hydration**: Angular 21 enables hydration by default; server-only APIs in components will crash the SSR render.
- **Proto changes**: after editing `service.proto`, regenerate Go stubs (`protoc`) and update any TypeScript gRPC client in `apps/gateway/src/adapters/outbound/grpc/`.
