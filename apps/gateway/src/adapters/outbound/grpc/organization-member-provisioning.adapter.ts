import { TaskOrchestrationServiceClient } from './task.client.js';
import type {
  OrganizationMemberProvisioningPayload,
  OrganizationMemberProvisioningPort,
} from '../../../ports/outbound/organization-member-provisioning.port.js';

const DEFAULT_ORGANIZATION_ID = 'org-main';

export class OrganizationMemberProvisioningAdapter implements OrganizationMemberProvisioningPort {
  constructor(private readonly grpcClient: TaskOrchestrationServiceClient) {}

  async ensureMemberExists(payload: OrganizationMemberProvisioningPayload): Promise<void> {
    await this.grpcClient.createOrganizationMember({
      actor_user_id: payload.userId,
      organization_id: DEFAULT_ORGANIZATION_ID,
      user_id: payload.userId,
      full_name: payload.fullName,
      department: payload.department,
      email: payload.email,
      roles: payload.roles,
    });
  }
}
