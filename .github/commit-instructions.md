# Commit Message Instructions

Follow the [Angular commit message format](https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md). Every commit message must follow this structure:

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## Type

Must be one of:

| Type | When to use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `refactor` | Code change that is neither a fix nor a feature |
| `perf` | Performance improvement |
| `style` | Formatting, whitespace — no logic change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `revert` | Reverts a previous commit |

## Scope

Optional. Identifies the area of the codebase affected. Use the app or layer name, for example:

- `frontend`, `gateway`, `service`
- `auth`, `session`, `grpc`, `proto`, `docker`
- `domain`, `application`, `adapters`

## Subject

- Lowercase, imperative mood ("add feature" not "added feature")
- No period at the end
- Max 72 characters on the first line

## Breaking Changes

Add `BREAKING CHANGE:` in the footer body, or append `!` after the type/scope:

```
feat(gateway)!: remove legacy session endpoint

BREAKING CHANGE: /api/v1/session is no longer available
```
