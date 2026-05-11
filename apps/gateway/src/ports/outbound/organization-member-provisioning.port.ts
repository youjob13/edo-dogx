export interface OrganizationMemberProvisioningPayload {
  readonly userId: string;
  readonly fullName: string;
  readonly department: string;
  readonly email: string;
}

export interface OrganizationMemberProvisioningPort {
  ensureMemberExists(payload: OrganizationMemberProvisioningPayload): Promise<void>;
}
