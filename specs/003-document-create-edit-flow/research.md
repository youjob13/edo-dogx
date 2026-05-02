# Research Notes: Full Document Create/Edit Flow

## Error Semantics Matrix

| Layer | Validation Error | Auth Error | Permission Error | Not Found | Conflict | Downstream/Infra |
|-------|------------------|------------|------------------|----------|----------|------------------|
| Frontend | Show field-level guidance | Redirect/login prompt | Action blocked message | Inline not-found message | Conflict banner with reload | Retry prompt |
| Gateway HTTP | 400 | 401 | 403 | 404 | 409 | 503 |
| gRPC boundary | INVALID_ARGUMENT | UNAUTHENTICATED | PERMISSION_DENIED | NOT_FOUND | ABORTED / FAILED_PRECONDITION | UNAVAILABLE |

## Conflict Handling

- Use optimistic locking with `expectedVersion` from the current loaded document.
- Reject stale updates without partial write.
- Return current document version for user recovery flow.

## Accessibility and Responsive Notes

- Form labels must be explicit and associated with controls.
- Save-state and error messages use polite announcement area.
- Create/edit layout should remain usable on mobile widths.

## Runtime Validation Commands

- `pnpm lint:all`
- `pnpm build:all`
- `go build ./cmd/server` in changed Go services
