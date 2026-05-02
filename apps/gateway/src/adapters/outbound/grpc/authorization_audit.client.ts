import { Client } from '@grpc/grpc-js';
import { callUnary, createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

function createClient(serviceName: string, address: string): Client {
  return createGrpcClient(serviceName, address, resolveServiceProtoPath());
}

export class AuthorizationAuditServiceClient {
  private readonly client: Client;

  constructor(address = process.env['AUTH_AUDIT_SERVICE_GRPC_ADDR'] ?? 'authorization-audit-service:50053') {
    this.client = createClient('AuthorizationAuditService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    return callUnary(this.client, methodName, payload);
  }

  checkPermission(payload: unknown): Promise<unknown> {
    return this.call('CheckPermission', payload);
  }

  appendAuditEvent(payload: unknown): Promise<unknown> {
    return this.call('AppendAuditEvent', payload);
  }

  getAuditEvents(payload: unknown): Promise<unknown> {
    return this.call('GetAuditEvents', payload);
  }
}
