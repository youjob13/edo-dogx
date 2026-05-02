import { Client } from '@grpc/grpc-js';
import { callUnary, createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

function createClient(serviceName: string, address: string): Client {
  return createGrpcClient(serviceName, address, resolveServiceProtoPath());
}

export class SignatureServiceClient {
  private readonly client: Client;

  constructor(address = process.env['SIGNATURE_SERVICE_GRPC_ADDR'] ?? 'signature-service:50054') {
    this.client = createClient('SignatureService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    return callUnary(this.client, methodName, payload);
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
