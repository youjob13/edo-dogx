import { Client } from '@grpc/grpc-js';
import { callUnary, createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

function createClient(serviceName: string, address: string): Client {
  return createGrpcClient(serviceName, address, resolveServiceProtoPath());
}

export class NotificationServiceClient {
  private readonly client: Client;

  constructor(address = process.env['NOTIFICATION_SERVICE_GRPC_ADDR'] ?? 'notification-service:50056') {
    this.client = createClient('NotificationService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    return callUnary(this.client, methodName, payload);
  }

  createNotification(payload: unknown): Promise<unknown> {
    return this.call('CreateNotification', payload);
  }

  listNotifications(payload: unknown): Promise<unknown> {
    return this.call('ListNotifications', payload);
  }

  markNotificationRead(payload: unknown): Promise<unknown> {
    return this.call('MarkNotificationRead', payload);
  }

  getUnreadCount(payload: unknown): Promise<unknown> {
    return this.call('GetUnreadCount', payload);
  }
}
