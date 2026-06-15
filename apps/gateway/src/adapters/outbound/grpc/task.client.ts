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

export class TaskOrchestrationServiceClient {
  private readonly client: Client;

  constructor(address = process.env['DOCUMENT_SERVICE_GRPC_ADDR'] ?? 'document-service:50052') {
    this.client = createClient('TaskOrchestrationService', address);
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

  createTask(payload: unknown): Promise<unknown> {
    return this.call('CreateTask', payload);
  }

  updateTaskStatus(payload: unknown): Promise<unknown> {
    return this.call('UpdateTaskStatus', payload);
  }

  updateTaskAssignee(payload: unknown): Promise<unknown> {
    return this.call('UpdateTaskAssignee', payload);
  }

  getTask(payload: unknown): Promise<unknown> {
    return this.call('GetTask', payload);
  }

  getTaskDetails(payload: unknown): Promise<unknown> {
    return this.call('GetTaskDetails', payload);
  }

  listTasks(payload: unknown): Promise<unknown> {
    return this.call('ListTasks', payload);
  }

  addTaskAttachments(payload: unknown): Promise<unknown> {
    return this.call('AddTaskAttachments', payload);
  }

  getTaskAttachments(payload: unknown): Promise<unknown> {
    return this.call('GetTaskAttachments', payload);
  }

  getTaskBoard(payload: unknown): Promise<unknown> {
    return this.call('GetTaskBoard', payload);
  }

  listTaskBoards(payload: unknown): Promise<unknown> {
    return this.call('ListTaskBoards', payload);
  }

  createTaskBoard(payload: unknown): Promise<unknown> {
    return this.call('CreateTaskBoard', payload);
  }

  listOrganizationMembers(payload: unknown): Promise<unknown> {
    return this.call('ListOrganizationMembers', payload);
  }

  addTaskBoardMember(payload: unknown): Promise<unknown> {
    return this.call('AddTaskBoardMember', payload);
  }

  createOrganizationMember(payload: unknown): Promise<unknown> {
    return this.call('CreateOrganizationMember', payload);
  }

  getAvailableApprovers(payload: unknown): Promise<unknown> {
    return this.call('GetAvailableApprovers', payload);
  }

  getAvailableDocuments(payload: unknown): Promise<unknown> {
    return this.call('GetAvailableDocuments', payload);
  }
}
