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

export class SignatureServiceClient {
  private readonly client: Client;

  constructor(address = process.env['SIGNATURE_SERVICE_GRPC_ADDR'] ?? 'signature-service:50054') {
    this.client = createClient('SignatureService', address);
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

  startSignature(payload: unknown): Promise<unknown> {
    return this.call('StartSignature', payload);
  }

  getSignatureStatus(payload: unknown): Promise<unknown> {
    return this.call('GetSignatureStatus', payload);
  }

  recordSignatureCallback(payload: unknown): Promise<unknown> {
    return this.call('RecordSignatureCallback', payload);
  }
}
