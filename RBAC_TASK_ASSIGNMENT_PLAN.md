# RBAC and Task Assignment Implementation Plan

## Objective

Complete resource-level RBAC and connect task assignment to a real, persisted API.

Authorization must be enforced by the service that owns tasks. The Gateway remains responsible for authentication and coarse route-level permissions, while `document-service` makes organization, board, task, and transition decisions.

## Target Policy

| Actor | Permissions |
|---|---|
| `edms.admin` | Organization-wide board and task management |
| Board `OWNER` | Manage board members, create tasks, assign and reassign tasks |
| Board `MANAGER` | Manage members and tasks within the board |
| Board `MEMBER` | View the board, create tasks, and act on assigned tasks |
| Task assignee | Move an assigned task from `PENDING` to `IN_REVIEW` |
| Task approver with `edms.approver` | Approve or decline an approval task |
| Task creator | View and edit task metadata, but cannot approve unless designated as approver |

Existing HR and Finance category roles continue to control document access.

## Phase 1: Identity and Membership

1. Add a `roles TEXT[]` column to `organization_members`.
2. Add a `role VARCHAR(16)` column to `task_board_members`.
3. Support board roles `OWNER`, `MANAGER`, and `MEMBER`.
4. Extend organization-member provisioning to upsert:
   - user ID
   - full name
   - department
   - email
   - Keycloak roles
5. Include roles in `CreateOrganizationMemberRequest`.
6. Provision authenticated users even when their department claim is empty.
7. Automatically add the board creator as its first `OWNER`.
8. Resolve display names from membership records instead of storing user IDs as names.

Primary files:

- `shared/proto/service.proto`
- `infra/postgres/init.sql`
- `services/document-service/migrations/001_document_create_edit.sql`
- `services/document-service/internal/domain/model/task.go`
- `services/document-service/internal/ports/outbound/task_repository.go`
- `services/document-service/internal/adapters/outbound/postgres/task_repository.go`
- `apps/gateway/src/adapters/outbound/grpc/organization-member-provisioning.adapter.ts`

## Phase 2: Central Authorization Policy

1. Add a task authorization policy to the `document-service` application or domain layer.
2. Resolve organization and board membership from PostgreSQL.
3. Never trust organization IDs, board roles, names, or roles supplied in public request bodies.
4. Implement explicit authorization checks for:
   - board read
   - board creation
   - board member management
   - task creation
   - task metadata editing
   - task assignment
   - task status transitions
   - task approval and decline
   - task attachment access
5. Apply authorization to list endpoints to prevent enumeration of other organizations.
6. Replace the hardcoded `CanEdit: true` response.
7. Return explicit task capabilities:
   - `canEdit`
   - `canAssign`
   - `canMoveToReview`
   - `canApprove`
   - `canComment`
8. Return `PermissionDenied` from gRPC and HTTP `403` from the Gateway for denied operations.

The Gateway `edmsRbacGuard` remains a coarse first check. Service authorization is authoritative.

## Phase 3: Real Task Assignment API

### gRPC contract

Add:

```proto
rpc UpdateTaskAssignee(UpdateTaskAssigneeRequest)
    returns (UpdateTaskAssigneeResponse);

message UpdateTaskAssigneeRequest {
  string actor_user_id = 1;
  string task_id = 2;
  string assignee_user_id = 3;
}

message UpdateTaskAssigneeResponse {
  Task task = 1;
}
```

### REST contract

Use a specific assignment endpoint:

```http
PATCH /api/tasks/{taskId}/assignee
Content-Type: application/json

{
  "assigneeId": "user-id"
}
```

Do not use the currently implied, ambiguous `PATCH /api/tasks/{taskId}` operation.

### Service behavior

1. Load and lock the task.
2. Resolve its board and organization.
3. Authorize the actor to assign the task.
4. Verify that the new assignee is an active board member.
5. Resolve the assignee's current display name from membership data.
6. Update assignee ID and name atomically.
7. Store the updating actor and timestamp.
8. Return the complete updated task.
9. Record previous and new assignee IDs in activity metadata.
10. Synchronize the Elasticsearch task projection.
11. Create a notification for the new assignee.

Primary files:

- `shared/proto/service.proto`
- `shared/openapi/openapi.yaml`
- `shared/ts-types/src/index.ts`
- `services/document-service/internal/adapters/inbound/grpc/task_orchestration_handler.go`
- `services/document-service/internal/adapters/outbound/postgres/task_repository.go`
- `apps/gateway/src/adapters/outbound/grpc/task.client.ts`
- `apps/gateway/src/adapters/inbound/http/tasks.routes.ts`
- `apps/frontend/src/app/adapters/outbound/task-boards.http.adapter.ts`

## Phase 4: Status and Decision Enforcement

1. Persist `decision` and `decision_comment` during task status updates.
2. Allow approval or decline only for approval tasks in `IN_REVIEW`.
3. Remove direct `PENDING -> APPROVED` and `PENDING -> DECLINED` transitions.
4. Require a comment when declining a task.
5. Allow only the designated approver to approve or decline.
6. Require the designated approver to hold `edms.approver`, unless the actor is `edms.admin`.
7. Prevent assignee and approver from being the same user unless an explicit admin policy permits it.
8. Keep final states immutable unless a future reopen operation is defined.

Recommended state machine:

```text
PENDING -> IN_REVIEW
IN_REVIEW -> PENDING
IN_REVIEW -> APPROVED
IN_REVIEW -> DECLINED
APPROVED -> final
DECLINED -> final
```

## Phase 5: Gateway Integration

1. Add coarse task actions to `edmsRbacGuard`.
2. Build an authenticated actor context from the session.
3. Forward only trusted session identity to gRPC.
4. Map gRPC errors consistently:
   - `InvalidArgument` -> `400`
   - `Unauthenticated` -> `401`
   - `PermissionDenied` -> `403`
   - `NotFound` -> `404`
   - `FailedPrecondition` -> `409`
5. Return task responses through a consistent `{ task }` envelope.
6. Remove duplicated client-side and Gateway transition rules that conflict with service policy.

## Phase 6: Frontend Integration

1. Change assignment calls to `PATCH /api/tasks/:taskId/assignee`.
2. Consume server-provided capability flags.
3. Remove the literal `current-user-id`.
4. Stop reconstructing authorization from board membership in Angular.
5. Disable or hide each control based on its specific capability.
6. Remove hardcoded organization options that the authenticated user cannot access.
7. Show actionable Russian messages for:
   - forbidden operation
   - invalid assignee
   - invalid transition
   - task changed concurrently
8. Reload or replace the task after a successful assignment.
9. Keep assignment controls accessible by keyboard and expose disabled reasons where practical.

## Contract and Documentation Cleanup

1. Add the assignment endpoint to OpenAPI.
2. Add task capability fields to shared TypeScript and OpenAPI types.
3. Remove unused `GetTask`, `ListTasks`, or attachment client calls if no matching RPC exists.
4. Document the authoritative permission matrix.
5. Replace `org-main` defaults with organization context derived from authenticated membership.

## Acceptance Criteria

- Cross-organization board access returns `403`.
- Users cannot enumerate boards or members outside their organizations.
- A board member cannot manage membership unless they are an owner, manager, or admin.
- Owners and managers can assign tasks only to active board members.
- Assignment is persisted and survives reload and service restart.
- Assignment updates activity history, search projection, and notifications.
- Only the designated approver can approve an approval task.
- A decline without a comment is rejected.
- Final task states cannot be changed through the generic status API.
- Frontend controls reflect backend capabilities but do not replace backend enforcement.
- No frontend permission decision can grant access that the backend denies.

## Delivery Order

1. Database and identity contract changes.
2. Membership repository changes.
3. Authorization policy.
4. Assignment gRPC operation.
5. Assignment REST operation.
6. Status and decision enforcement.
7. Frontend capability integration.
8. Contract and documentation cleanup.

