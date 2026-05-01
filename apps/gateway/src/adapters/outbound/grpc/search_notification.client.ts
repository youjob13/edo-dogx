import { Client, credentials, loadPackageDefinition, type ServiceError } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolveServiceProtoPath } from './proto-path.js';

type GrpcMethod = (request: unknown, callback: (err: ServiceError | null, response: unknown) => void) => void;

function createClient(serviceName: string, address: string): Client {
  const packageDefinition = loadSync(resolveServiceProtoPath(), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const pkg = loadPackageDefinition(packageDefinition) as unknown as {
    service: { v1: Record<string, new (target: string, creds: ReturnType<typeof credentials.createInsecure>) => Client> };
  };

  const ctor = pkg.service.v1[serviceName];
  return new ctor(address, credentials.createInsecure());
}

export class SearchNotificationServiceClient {
  private readonly client: Client;

  constructor(address = process.env['SEARCH_NOTIFICATION_SERVICE_GRPC_ADDR'] ?? 'search-notification-service:50055') {
    this.client = createClient('SearchNotificationService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    const method = (this.client as unknown as Record<string, GrpcMethod>)[methodName];
    if (!method) {
      return Promise.resolve({ status: 'NOT_IMPLEMENTED', method: methodName, payload });
    }

    return new Promise((resolve, reject) => {
      method(payload, (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
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
