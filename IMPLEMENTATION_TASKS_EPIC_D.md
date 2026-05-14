# Epic D — Productization and Readiness

## D1. Replace frontend mock metrics/activity/storage endpoints
- Priority: P1
- Scope:
  - Introduce Gateway endpoints for dashboard metrics and activity feed.
  - Replace mock adapters in frontend with live calls.
- Deliverable:
  - Home dashboard shows real backend data.

## D2. Remove placeholder proto surface and dead contract paths
- Priority: P2
- Scope:
  - Remove or isolate `ExampleService` placeholder.
  - Clean up unsupported RPC methods in clients and proto where obsolete.
- Deliverable:
  - Shared proto contains only active/owned contract surface.

## D3. Fix localization consistency gaps
- Priority: P1
- Scope:
  - Replace mixed-language user-facing strings (e.g., editor placeholders) with Russian defaults.
  - Keep Angular i18n path for multilingual support.
- Deliverable:
  - Russian-default UX is consistent across dashboard/document/task flows.
