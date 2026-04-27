# Dashboard Implementation Plan

## Progress Status
- Phase 1: Design System Expansion - completed
- Phase 2: Routing and Page Structure - completed
- Phase 3: Dashboard Domain + Mock API - completed
- Phase 4: Dashboard Home Implementation (Template Fidelity) - completed
- Phase 5: Dark Mode Feature - completed
- Phase 6: Accessibility and UX Quality - completed
- Phase 7: Testing Strategy - omitted by request (tests disabled)
- Phase 8: Implementation Order (Execution Backlog) - completed

## Goal
Build a production-grade Angular Dashboard page that strictly follows the layout and interaction model from the provided dashboard template, composed from design-system components first, with mocked data flows and fully interactive controls.

## Decisions Locked
1. Icons: migrate icon usage into the design system; keep Material Symbols only when no close equivalent exists.
2. Dark mode: implement first-class dark mode.
3. Routing: use real routes/pages; non-dashboard sections can be dummy components for route validation.
4. Row actions: implement preview, edit, download.
5. Data UX: implement filtering, sorting, and pagination.

## Non-Functional Constraints
- Angular 21 standalone components only.
- SSR-safe code (no direct browser-only APIs without guards).
- Russian is default for all user-facing text.
- i18n markers included for all visible strings.
- Reuse existing design-system components where possible; add reusable UI-kit components for missing building blocks.

## Target Architecture

### Feature slice
- domain/dashboard
- application/dashboard
- ports/inbound/dashboard.routes.ts
- ports/outbound/dashboard-api.port.ts
- adapters/outbound/dashboard-mock-http.adapter.ts
- adapters/http/dashboard/** (pages)
- design-system/ui-kit/** (expanded reusable kit)

### Data flow
- UI pages -> Dashboard use-cases -> Dashboard outbound port -> mock adapter.
- All list state driven by signals + computed selectors.
- URL query params synced for filters/sort/page to make state shareable and restorable.

## Phase 1: Design System Expansion

### 1.1 Icon system
Create reusable icon primitives in UI-kit:
- `edo-dogx-icon` wrapper with type-safe name input.
- `edo-dogx-icon-button` for actionable icon controls.
- `edo-dogx-nav-item` for sidebar entries with icon + label + active states.
- `edo-dogx-topbar-action` for notification/history/account controls.

Implementation notes:
- Add icon registry map (logical names -> material symbol names).
- Fallback strategy: when no internal mapping exists, allow direct Material Symbols name via safe escape hatch input.
- Enforce consistent icon size, tone, focus style from tokens.

### 1.2 Core layout primitives
Add reusable shell components:
- `edo-dogx-app-shell` (sidebar + topbar + content layout)
- `edo-dogx-sidebar`
- `edo-dogx-topbar`
- `edo-dogx-page-section`

### 1.3 Dashboard-specific reusable UI-kit primitives
- `edo-dogx-metric-card`
- `edo-dogx-bar-mini-chart` (weekly volume)
- `edo-dogx-activity-feed`
- `edo-dogx-progress-meter`
- `edo-dogx-toolbar-search`
- `edo-dogx-table-toolbar` (filters + sort + pagination controls)
- `edo-dogx-dropdown-menu` (row and account actions)
- `edo-dogx-drawer` (preview/details panel)
- `edo-dogx-modal` (edit form)

### 1.4 Existing component upgrades
- Input: leading icon slot + compact mode.
- Data table: sortable headers, custom cell template hooks, row action slot, empty/loading states.
- Button: tertiary and icon-only variants.
- Status chip: domain tones mapped to document statuses (finalized/review/archived/pending).

### 1.5 Theming and dark mode tokens
Extend UI tokens to support semantic aliases:
- Surface, panel, border, text-primary, text-muted, interactive-hover, focus-ring, danger, success, warning.
- Add dark token set with class-based switch (`theme-dark` on root shell).
- Ensure AA contrast and visible focus states in both themes.

## Phase 2: Routing and Page Structure

### 2.1 Real routes
Update app routes:
- `/dashboard` -> dashboard feature route tree.
- child pages (real but minimal):
  - `/dashboard/home`
  - `/dashboard/documents`
  - `/dashboard/tasks`
  - `/dashboard/archive`
  - `/dashboard/settings`

### 2.2 Dummy pages for route validation
Create standalone dummy components for non-home pages using shared shell and heading cards.
- Purpose: verify sidebar navigation, active state, and lazy loading work now.

### 2.3 Redirects
- `/dashboard` redirects to `/dashboard/home`.
- Keep wildcard behavior explicit and stable.

## Phase 3: Dashboard Domain + Mock API

### 3.1 Domain models
Create typed models for:
- `DashboardSummary`
- `WeeklyVolumePoint`
- `DocumentItem`
- `ActivityItem`
- `StorageUsage`
- `DashboardQuery` (search/filter/sort/page/pageSize)
- `PaginatedResult<T>`

### 3.2 Outbound port
Define API contract methods:
- `getDashboardSummary(query)`
- `getDocuments(query)`
- `getActivity(query)`
- `getStorageUsage()`
- `previewDocument(id)`
- `downloadDocument(id)`
- `updateDocument(id, payload)`

### 3.3 Mock adapter
Implement in-memory dataset + deterministic fixtures:
- realistic statuses/types/timestamps.
- artificial latency and optional error toggles.
- server-like filter/sort/paginate behavior.

## Phase 4: Dashboard Home Implementation (Template Fidelity)

### 4.1 Layout mapping from template
Implement exact sections:
- left fixed sidebar
- sticky top bar
- summary bento cards
- weekly mini chart
- recent documents panel
- activity feed panel
- storage usage block

### 4.2 Interaction mapping (all actionable)
Sidebar:
- all items navigate to real routes.

Top bar:
- search input filters document list.
- upload action opens mock flow.
- notifications/history/account open menus/drawers.

Metric cards:
- click applies quick filters to documents.

Weekly chart:
- hover tooltip and click-to-filter by day bucket.

Documents table:
- sortable columns.
- filter toolbar (status, type, text).
- pagination controls.
- row actions:
  - Preview -> right drawer with details.
  - Edit -> modal form (save updates mock store).
  - Download -> mocked file action with toast feedback.

Activity feed:
- clickable items route to related context (or open details mock).

Storage usage:
- interactive details (expand/collapse or modal breakdown).

### 4.3 State management
Use signals/computed for:
- `query`
- `documentsPage`
- `summary`
- `activity`
- `selectedDocument`
- `isPreviewOpen`
- `isEditOpen`
- `themeMode`

Sync query to URL params:
- `q`, `status`, `type`, `sort`, `dir`, `page`, `size`.

## Phase 5: Dark Mode Feature

### 5.1 User control
Add theme toggle in top bar account/actions area.

### 5.2 Persistence
Store preference in `localStorage` (guarded for SSR).
Fallback order:
1. saved preference
2. system preference
3. light mode default

### 5.3 Rendering strategy
- Apply theme class at shell/root container.
- All UI-kit components consume semantic tokens only (no hardcoded light colors).

## Phase 6: Accessibility and UX Quality
- Keyboard navigation for all controls, menus, dialogs, table actions.
- ARIA labels and roles for nav, toolbar, dialogs, table sort states, pagination.
- Focus trap in modal/drawer.
- Escape closes overlays.
- Reduced motion support.

## Phase 7: Testing Strategy

### 7.1 Component tests
- New UI-kit components input/output behavior.
- Theme class behavior (light/dark).
- Table sorting/filtering/pagination outputs.

### 7.2 Feature integration tests
- route navigation across dashboard pages.
- query-param persistence and restoration.
- preview/edit/download actions.
- filter + sort + pagination end-to-end behavior against mock adapter.

### 7.3 Build validation
- run frontend build after implementation.
- fix any lint/type issues from component API expansion.

## Phase 8: Implementation Order (Execution Backlog)
1. Extend UI-kit tokens and icon system.
2. Build shell/topbar/sidebar reusable components.
3. Upgrade existing input/button/data-table/status-chip APIs.
4. Add dashboard domain models + outbound port + mock adapter.
5. Create dashboard routes and dummy pages.
6. Implement dashboard home composition with template parity.
7. Wire interactions: preview/edit/download + table controls.
8. Add dark mode toggle + persistence.
9. Run final build (tests omitted by policy).

## Acceptance Criteria
- Dashboard closely matches provided template layout and density.
- App page composed from design-system components (including newly added reusable ones).
- Icons handled via design-system icon abstraction; Material Symbols used only as fallback.
- Dark mode available and persistent.
- Real dashboard child routes work with dummy pages.
- Documents table supports filtering, sorting, pagination.
- Row actions implemented: preview, edit, download.
- All buttons/controls are interactive and produce visible behavior.
- Russian default user-facing text and i18n markers included.

## Risks and Mitigations
- Risk: template parity drifts due to direct feature coding.
  - Mitigation: finish shell and UI-kit primitives first, then compose page.
- Risk: table complexity inflates component API.
  - Mitigation: keep table base generic, move feature controls into toolbar component.
- Risk: dark mode inconsistencies.
  - Mitigation: semantic tokens only, no raw colors in feature components.

## Out of Scope for this iteration
- Real backend integration.
- Auth/permissions enforcement for dashboard actions.
- Server-side pagination.
