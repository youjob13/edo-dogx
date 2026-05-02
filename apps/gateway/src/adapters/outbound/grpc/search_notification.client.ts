import { Client } from '@grpc/grpc-js';
import { callUnary, createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

function createClient(serviceName: string, address: string): Client {
  return createGrpcClient(serviceName, address, resolveServiceProtoPath());
}

export class SearchNotificationServiceClient {
  private readonly client: Client;

  constructor(address = process.env['SEARCH_NOTIFICATION_SERVICE_GRPC_ADDR'] ?? 'search-notification-service:50055') {
    this.client = createClient('SearchNotificationService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    return callUnary(this.client, methodName, payload);
  }

  searchDocuments(payload: unknown): Promise<unknown> {
    return this.call('SearchDocuments', payload);
  }

  emitNotification(payload: unknown): Promise<unknown> {
    return this.call('EmitNotification', payload);
  }

  retryFailedNotifications(payload: unknown): Promise<unknown> {
    return this.call('RetryFailedNotifications', payload);
  }
}
