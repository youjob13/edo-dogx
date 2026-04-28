# Dashboard Plan Remaining Items

Source plan: DASHBOARD.md
Last updated: 2026-04-28

## Open Items

- [ ] Phase 3.3 Mock adapter: add optional error toggles for deterministic failure scenarios.
  - Current state: adapter has latency and not-found errors only, but no configurable toggle mechanism.
  - Evidence: apps/frontend/src/app/adapters/outbound/dashboard-mock-http.adapter.ts

- [ ] Phase 4.2 Home page documents panel: implement full filter toolbar and pagination controls directly in home context, as defined in the interaction mapping.
  - Current state: home uses table sorting and row actions, but status/type filter toolbar and pagination are implemented on Documents page instead.
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/home/dashboard-home.component.html
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-documents.component.html

- [ ] Phase 4.2 Weekly chart: add hover tooltip behavior in addition to click-to-filter.
  - Current state: click interaction exists; explicit tooltip behavior is not implemented in chart component.
  - Evidence: apps/frontend/src/app/design-system/ui-kit/bar-mini-chart/bar-mini-chart.component.ts

- [ ] Phase 4.3 URL sync for dashboard state: ensure home-level state is fully synced to query params (q, status, type, sort, dir, page, size).
  - Current state: home reads q from URL but does not synchronize full dashboard query state.
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/home/dashboard-home.component.ts
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-documents.component.ts

- [ ] Phase 6 Accessibility ARIA roles: add explicit semantic roles for navigation and toolbar containers.
  - Current state: sidebar and topbar wrappers do not expose explicit navigation/toolbar roles.
  - Evidence: apps/frontend/src/app/design-system/ui-kit/sidebar/sidebar.component.ts
  - Evidence: apps/frontend/src/app/design-system/ui-kit/topbar/topbar.component.ts

- [ ] Non-functional constraint: add Angular i18n markers for visible dashboard strings.
  - Current state: Russian default text is present, but dashboard templates do not include i18n attributes for extraction workflow.
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/dashboard-layout.component.html
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/home/dashboard-home.component.html
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-documents.component.html

## Closed Clarifications (Not Open)

- Reduced motion support exists globally.
  - Evidence: apps/frontend/src/styles.scss
- Dark mode persistence and SSR guard are implemented.
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/dashboard-layout.component.ts
- Preview, edit, download row actions are implemented.
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/home/dashboard-home.component.ts
  - Evidence: apps/frontend/src/app/adapters/http/dashboard/documents/dashboard-documents.component.ts
