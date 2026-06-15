import { Client } from '@grpc/grpc-js';
import type { ServiceError } from '@grpc/grpc-js';
import { callUnary, createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

export class GrpcClientError extends Error {
  public readonly code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = 'GrpcClientError';
    this.code = code;
  }
}

function createClient(serviceName: string, address: string): Client {
  return createGrpcClient(serviceName, address, resolveServiceProtoPath());
}

export class DocumentServiceClient {
  private readonly client: Client;

  constructor(address = process.env['DOCUMENT_SERVICE_GRPC_ADDR'] ?? 'document-service:50052') {
    this.client = createClient('DocumentWorkflowService', address);
  }

  private call(methodName: string, payload: unknown): Promise<unknown> {
    return callUnary(this.client, methodName, payload).catch((err: unknown) => {
      const serviceError = err as ServiceError | undefined;
      throw new GrpcClientError(
        serviceError?.details || serviceError?.message || 'gRPC request failed',
        serviceError?.code,
      );
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

  listDocumentVersions(payload: unknown): Promise<unknown> {
    return this.call('ListDocumentVersions', payload);
  }

  getDocumentVersion(payload: unknown): Promise<unknown> {
    return this.call('GetDocumentVersion', payload);
  }

  submitWorkflow(payload: unknown): Promise<unknown> {
    return this.call('SubmitWorkflow', payload);
  }

  approveWorkflow(payload: unknown): Promise<unknown> {
    return this.call('ApproveWorkflow', payload);
  }

  requestWorkflowChanges(payload: unknown): Promise<unknown> {
    return this.call('RequestWorkflowChanges', payload);
  }

  getWorkflow(payload: unknown): Promise<unknown> {
    return this.call('GetWorkflow', payload);
  }

  listWorkflowEvents(payload: unknown): Promise<unknown> {
    return this.call('ListWorkflowEvents', payload);
  }

  archiveDocument(payload: unknown): Promise<unknown> {
    return this.call('ArchiveDocument', payload);
  }

  listActivityEvents(payload: unknown): Promise<unknown> {
    return this.call('ListActivityEvents', payload);
  }
}
