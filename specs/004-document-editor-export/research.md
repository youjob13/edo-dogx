# Research: Configurable Document Editor and Export

## Decision 1: Rich editor foundation
- Decision: Use a mature, plugin-based rich text editor library with schema-driven extensions and toolbar configurability.
- Rationale: Satisfies requirement for many configurable controls without custom editor implementation.
- Alternatives considered:
  - Building custom editor logic: rejected due to high complexity and maintenance burden.
  - Minimal textarea + markdown: rejected because control richness and WYSIWYG expectations are not met.

## Decision 2: Control profile management
- Decision: Persist control profiles per document context (category/template) and resolve effective control set at editor session start.
- Rationale: Ensures deterministic editor behavior and easy governance for admin-managed controls.
- Alternatives considered:
  - Hardcoded controls by page: rejected due to poor flexibility.
  - Client-only profile config: rejected due to policy and audit concerns.

## Decision 3: Export architecture
- Decision: Use external libraries for PDF and DOCX generation and run export from saved document state.
- Rationale: Produces reliable output while preserving data integrity and avoiding unsaved-state ambiguity.
- Alternatives considered:
  - Browser-only export for all files: rejected due to inconsistent output and large-document constraints.
  - Manual template rendering engine from scratch: rejected due to delivery and maintenance cost.

## Decision 4: Failure handling
- Decision: Treat export as retriable operation with explicit status and user-facing recovery guidance.
- Rationale: External libraries and conversion pipelines may fail transiently; users need clear, non-destructive recovery.
- Alternatives considered:
  - Silent retries only: rejected due to poor user transparency.
  - Fail-fast with no retry path: rejected due to productivity impact.

## Decision 5: Security and compliance
- Decision: Enforce role checks for edit/configure/export operations and emit audit events for create/edit/export outcomes.
- Rationale: Aligns with governance and existing EDMS compliance expectations.
- Alternatives considered:
  - Coarse global permission: rejected due to insufficient control granularity.

## Decision 6: Unknowns resolved
- Chosen implementation style: external ready-made libraries only for editor/export core behavior.
- Export scope: PDF and DOCX only for initial release.
- Delivery surface: frontend editor + gateway/API orchestration + backend persistence/export pipeline.

## Decision 7: Concrete library shortlist and licensing
- Rich editor (frontend): TipTap v2 (`@tiptap/core`, `@tiptap/starter-kit`, table/link/image extensions), MIT license.
- PDF generation (backend): `github.com/jung-kurt/gofpdf`, permissive open-source license suitable for internal export generation.
- DOCX generation (backend): library selection remains adapter-scoped and is finalized during export adapter implementation with legal/security review checkpoint.
- Licensing rule: keep all external libraries isolated in adapter boundaries to allow replacement without domain/application refactors.
