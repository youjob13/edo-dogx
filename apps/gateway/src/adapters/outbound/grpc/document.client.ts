import { Client, credentials, loadPackageDefinition, type ServiceError } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import { resolveServiceProtoPath } from './proto-path.js';

export class GrpcClientError extends Error {
  public readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'GrpcClientError';
    this.code = code;
  }
}

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

export class DocumentServiceClient {
  private readonly client: Client;

  constructor(address = process.env['DOCUMENT_SERVICE_GRPC_ADDR'] ?? 'document-service:50052') {
    this.client = createClient('DocumentWorkflowService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    const method = (this.client as unknown as Record<string, GrpcMethod>)[methodName];
    if (!method) {
      return Promise.resolve({ status: 'NOT_IMPLEMENTED', method: methodName, payload });
    }

    return new Promise((resolve, reject) => {
      method(payload, (err, response) => {
        if (err) {
          reject(new GrpcClientError(err.details || err.message, err.code));
          return;
        }
        resolve(response);
      });
    });
  }

  createDraft(payload: unknown): Promise<unknown> {
    return this.call('CreateDraft', payload);
  }

  updateDraft(payload: unknown): Promise<unknown> {
    return this.call('UpdateDraft', payload);
  }

  getDocument(payload: unknown): Promise<unknown> {
    return this.call('GetDocument', payload);
  }

  getEditorControlProfile(payload: unknown): Promise<unknown> {
    return this.call('GetEditorControlProfile', payload);
  }

  updateEditorControlProfile(payload: unknown): Promise<unknown> {
    return this.call('UpdateEditorControlProfile', payload);
  }

  createExportRequest(payload: unknown): Promise<unknown> {
    return this.call('CreateExportRequest', payload);
  }

  getExportRequest(payload: unknown): Promise<unknown> {
    return this.call('GetExportRequest', payload);
  }

  downloadExportArtifact(payload: unknown): Promise<unknown> {
    return this.call('DownloadExportArtifact', payload);
  }

  searchDocuments(payload: unknown): Promise<unknown> {
    return this.call('SearchDocuments', payload);
  }

  submitWorkflow(payload: unknown): Promise<unknown> {
    return this.call('SubmitWorkflow', payload);
  }

  approveWorkflow(payload: unknown): Promise<unknown> {
    return this.call('ApproveWorkflow', payload);
  }
}
