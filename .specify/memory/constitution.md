<!--
Sync Impact Report
- Version change: template-placeholder-version -> 1.0.0
- Modified principles:
	- template-principle-1 -> I. Clarity Over Cleverness
	- template-principle-2 -> II. Consistency by Default
	- template-principle-3 -> III. Design for Change
	- template-principle-4 -> IV. Pragmatic Quality Gates (No Test Authoring for Now)
	- template-principle-5 -> V. Accessibility and Friendly UX
	- added-principle -> VI. Polish Through Purposeful Design
	- added-principle -> VII. Responsive and Adaptive Delivery
- Added sections:
	- Operational Constraints and Quality Bar
	- Delivery Workflow and Review Expectations
- Removed sections:
	- None
- Templates requiring updates:
	- .specify/templates/plan-template.md: ✅ updated
	- .specify/templates/spec-template.md: ✅ updated
	- .specify/templates/tasks-template.md: ✅ updated
	- .specify/templates/commands/*.md: ⚠ pending (directory not present)
	- AGENTS.md: ✅ updated
- Follow-up TODOs:
	- None
-->

# EDO Constitution

## Core Principles

### I. Clarity Over Cleverness
All production code MUST optimize for readability and future maintainers.
Names MUST be explicit, functions SHOULD be small and single-purpose, and module
structure MUST be predictable. Clever shortcuts that reduce clarity are disallowed.
Rationale: maintainability and lower onboarding cost are primary long-term
drivers of delivery speed and reliability.

### II. Consistency by Default
Changes MUST follow established project conventions for architecture, linting,
formatting, naming, and component patterns. Existing shared utilities and UI
components MUST be preferred over introducing near-duplicate abstractions.
Rationale: consistency reduces defects, improves review quality, and keeps the
monorepo cohesive.

### III. Design for Change
Modules MUST be loosely coupled and highly cohesive. Volatile dependencies such
as external APIs, feature flags, and experiments MUST be encapsulated behind
stable ports/interfaces. Cross-layer dependency rules MUST be preserved.
Rationale: this protects core business logic from churn and enables safe
incremental evolution.

### IV. Pragmatic Quality Gates (No Test Authoring for Now)
Software MUST remain reliable, secure, and performant through strict design and
review quality gates. In this repository, contributors MUST NOT create, modify,
or run automated tests unless this constitution is amended or a feature request
explicitly changes that policy.
Rationale: the current team policy prioritizes implementation flow; quality is
enforced via architecture, static checks, validation steps, and disciplined
reviews.

### V. Accessibility and Friendly UX
User-facing work MUST meet WCAG expectations for keyboard navigation, focus
management, contrast, semantic markup, and ARIA only when needed. Copy MUST be
clear, labels MUST be descriptive, and error states MUST provide kind, precise
guidance with actionable next steps.
Rationale: accessibility and clarity are baseline product quality requirements,
not optional enhancements.

### VI. Polish Through Purposeful Design
Visual and interaction design MUST be modern, friendly, and restrained.
Spacing, typography, and motion MUST be consistent and purposeful; gimmicks are
disallowed. Performance and perceived stability (including minimized layout
shift) MUST be preserved while polishing UX.
Rationale: thoughtful polish increases trust and usability without sacrificing
speed or maintainability.

### VII. Responsive and Adaptive Delivery
Features MUST work well on mobile and desktop and adapt to varied viewport
sizes, content length, and localization expansion. Components MUST handle long
text and changing language content without breaking layout or interaction.
Rationale: resilient, adaptive interfaces prevent regressions and improve user
satisfaction across devices and locales.

## Operational Constraints and Quality Bar

- Favor clear, simple solutions that scale over speculative abstractions.
- Security is mandatory: input validation, least-privilege access, and safe
error handling MUST be applied in all layers.
- Performance is mandatory: avoid unnecessary re-renders, blocking operations,
and expensive cross-service calls on critical paths.
- Existing platform constraints remain in force, including:
	- Hexagonal architecture dependency boundaries.
	- Angular SSR safety for browser-only APIs.
	- Russian-first user-facing copy unless explicitly scoped otherwise.

## Delivery Workflow and Review Expectations

- Plans, specs, and task lists MUST include explicit checks for clarity,
consistency, change isolation, accessibility, and responsiveness.
- Every implementation PR/review MUST document compliance with the Core
Principles and capture trade-offs for any added complexity.
- When constraints conflict, reviewers MUST prefer maintainability and user
accessibility while preserving security and performance baselines.
- Testing tasks are excluded by default under current policy and may only be
introduced if governance policy is amended.

## Governance

This constitution supersedes conflicting workflow habits and template defaults.
Amendments require: (1) documented rationale, (2) update of dependent templates
and guidance files, and (3) explicit version bump according to semantic rules.

Versioning policy:
- MAJOR: incompatible governance or principle removal/redefinition.
- MINOR: new principle/section or materially expanded guidance.
- PATCH: clarifications, wording refinements, and non-semantic edits.

Compliance review expectations:
- Each feature plan MUST pass a constitution check before implementation.
- Each specification MUST include accessibility and responsive requirements.
- Each task plan MUST reflect current no-tests policy unless explicitly changed
through governance.

**Version**: 1.0.0 | **Ratified**: 2026-05-01 | **Last Amended**: 2026-05-01
