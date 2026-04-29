# Plan: BFF Gateway — Auth via Authorization Code + PKCE

## TL;DR
Implement the gateway as a proper OAuth2 BFF. The browser is redirected to Keycloak (which
owns the login/register UI), Keycloak redirects back with an authorization code, and the BFF
exchanges it for tokens using PKCE — storing them in a Redis-backed server-side session behind
an HttpOnly cookie. The existing Angular login form is adapted to trigger a browser navigation
instead of a POST.

---

## Decisions
- **Auth flow**: Authorization Code + PKCE. Direct Access Grants stay disabled in Keycloak.
- **Session storage**: Redis-backed `@fastify/session` with HttpOnly, SameSite=lax cookie.
- **Registration**: Keycloak self-registration page; BFF only redirects to it.
- **Protected routes**: Fastify `authenticate` decorator on all future proxy routes.
- **PKCE state**: Stored in the pre-redirect session, cleared after callback.
- **Token refresh / Social login**: Out of scope for this plan.
- **New dependency**: `openid-client@^5` (PKCE + OIDC discovery, CJS-compatible).

---

## Phase 1 — Shared contracts *(parallel)*

1. `shared/ts-types/src/index.ts` — add `UserProfile { userId, email, roles }` export
2. `shared/openapi/openapi.yaml` — add `auth` tag + five paths:
   - `GET /api/auth/login` → 302 (initiates PKCE)
   - `GET /api/auth/callback` → 302 (exchanges code, sets cookie)
   - `GET /api/auth/logout` → 302 (clears session + Keycloak logout)
   - `GET /api/auth/me` → 200 UserProfile | 401
   - `GET /api/auth/register` → 302 (to Keycloak registration page)

---

## Phase 2 — Domain & Ports (gateway) *(parallel with Phase 1)*

3. `apps/gateway/src/domain/auth.ts`
   - `AuthSession { userId, email, roles, accessToken, refreshToken, idToken, expiresAt }`
   - `PkceState { codeVerifier, state, redirectTo? }` (stored in session pre-redirect)
4. `apps/gateway/src/ports/outbound/session-store.port.ts`
   - `SessionStorePort<T>`: `save(id, data, ttlSeconds)`, `get(id)`, `delete(id)`
5. `apps/gateway/src/ports/outbound/oidc-client.port.ts`
   - `OidcClientPort`: `buildAuthUrl(pkceState)`, `exchangeCode(callbackUrl, pkceState)`, `buildLogoutUrl(idToken)`, `buildRegisterUrl()`
6. `apps/gateway/src/ports/inbound/auth.port.ts`
   - `AuthPort` with the five operations the route adapter calls

---

## Phase 3 — Outbound Adapters *(parallel, depends on Phase 2)*

7. `apps/gateway/src/adapters/outbound/redis/session-store.adapter.ts`
   - Implements `SessionStorePort` via `ioredis`; also implements callback-style store
     interface expected by `@fastify/session` (`get/set/destroy`)
8. `apps/gateway/src/adapters/outbound/oidc/keycloak.adapter.ts`
   - Implements `OidcClientPort` via `openid-client@5`
   - Discovers issuer at startup: `Issuer.discover(KEYCLOAK_URL/realms/REALM)`
   - Uses `generators.codeVerifier/codeChallenge/state` for PKCE
   - Token exchange via `client.oauthCallback()`

---

## Phase 4 — Application Layer *(depends on Phases 2–3)*

9. `apps/gateway/src/application/auth.service.ts`
   - `initiateLogin()` → `buildAuthUrl()` → returns `{ authUrl, pkceState }`
   - `handleCallback(callbackUrl, pkceState)` → `exchangeCode()` → maps claims to `AuthSession` → `SessionStorePort.save()`
   - `logout(sessionId, idToken)` → `SessionStorePort.delete()` + `buildLogoutUrl()`
   - `getCurrentUser(sessionId)` → `SessionStorePort.get()` → maps to `UserProfile`

---

## Phase 5 — Inbound HTTP Routes *(depends on Phase 4)*

10. `apps/gateway/src/adapters/inbound/http/auth/auth.routes.ts` — Fastify plugin at `/api/auth`:
    - `GET /login` → store `pkceState` in `request.session.pkce` → redirect to Keycloak
    - `GET /callback` → verify state → `handleCallback()` → store `AuthSession` in session → redirect `/dashboard`
    - `GET /logout` → `logout()` → `session.destroy()` → redirect to Keycloak logout URL
    - `GET /me` → return `UserProfile` from session or 401
    - `GET /register` → redirect to Keycloak registration URL
    - All routes have Fastify JSON Schema for response serialization

---

## Phase 6 — Bootstrap *(depends on Phase 5)*

11. `apps/gateway/package.json` — add `"openid-client": "^5.7.0"`
12. `apps/gateway/src/adapters/inbound/http/app.ts`
    - Accept injected `AuthService` as parameter
    - Register `@fastify/cookie`
    - Register `@fastify/session` with Redis store, cookie options from env
    - Add `authenticate` decorator (checks `request.session.auth`)
    - Register `auth.routes.ts` plugin
13. `apps/gateway/src/main.ts` — full bootstrap:
    - Load env vars (`PORT`, `SESSION_SECRET`, `REDIS_*`, `KEYCLOAK_*`)
    - Construct `RedisSessionAdapter` + `KeycloakAdapter`
    - Construct `AuthService`
    - Call `buildApp({ authService })`
    - `app.listen({ port, host: '0.0.0.0' })`

---

## Phase 7 — Frontend alignment *(parallel with Phase 6)*

14. `apps/frontend/src/app/ports/outbound/auth-api.port.ts`
    - Change `signIn` to `signIn(loginHint?: string): void`
    - Change `signUp` to `signUp(): void` (no Observable — it's a navigation)
15. `apps/frontend/src/app/adapters/outbound/auth-http.adapter.ts`
    - Replace HTTP POST with `window.location.href = '/api/auth/login?login_hint=...'`
    - `signUp()` → `window.location.href = '/api/auth/register'`
16. `apps/frontend/src/app/application/auth/auth.use-cases.ts`
    - Pass `payload.email` as `loginHint` to `signIn()`
17. Sign-in component — form submit calls `authUseCases.signIn(form.email)` (client-side validation still runs)
18. Sign-up component — submit calls `authUseCases.signUp()`

---

## Relevant Files

| File | Role |
|------|------|
| `apps/gateway/src/main.ts` | Bootstrap stub with TODOs |
| `apps/gateway/src/adapters/inbound/http/app.ts` | Fastify factory (only /health) |
| `apps/gateway/package.json` | Missing `openid-client` |
| `apps/frontend/src/app/adapters/outbound/auth-http.adapter.ts` | Currently POSTs to BFF |
| `apps/frontend/src/app/ports/outbound/auth-api.port.ts` | Observable-based signatures |
| `apps/frontend/src/app/application/auth/auth.use-cases.ts` | Passes full form payloads |
| `shared/ts-types/src/index.ts` | Only exports `HealthResponse` |
| `shared/openapi/openapi.yaml` | Only `/health` documented |
| `.env.example` | Has all required env var keys |

---

## Verification

1. `pnpm --filter gateway dev` starts without errors
2. `GET localhost:3000/health` → `{ status: 'ok' }`
3. `GET localhost:3000/api/auth/login` → 302 to Keycloak with `code_challenge` + `state` in URL
4. Complete Keycloak login → browser lands on `/dashboard`; `GET /api/auth/me` → `{ userId, email, roles }`
5. `GET /api/auth/logout` → session cleared, redirected to Keycloak logout
6. `GET /api/auth/me` after logout → 401
7. `pnpm --filter frontend build` passes with no type errors