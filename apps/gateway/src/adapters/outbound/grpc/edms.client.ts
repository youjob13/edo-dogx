import { Client } from '@grpc/grpc-js';
import { createGrpcClient } from './grpc-client.util.js';
import { resolveServiceProtoPath } from './proto-path.js';

interface EdmsGrpcClients {
  documentService: Client;
  documentWorkflowService: Client;
  signatureService: Client;
  authorizationAuditService: Client;
  searchNotificationService: Client;
}

export class EdmsGrpcClientBootstrap {
  private readonly documentAddress: string;
  private readonly authAuditAddress: string;
  private readonly signatureAddress: string;
  private readonly searchNotificationAddress: string;

  constructor() {
    this.documentAddress =
      process.env['DOCUMENT_SERVICE_GRPC_ADDR'] ?? 'document-service:50052';
    this.authAuditAddress =
      process.env['AUTH_AUDIT_SERVICE_GRPC_ADDR'] ??
      'authorization-audit-service:50053';
    this.signatureAddress =
      process.env['SIGNATURE_SERVICE_GRPC_ADDR'] ?? 'signature-service:50054';
    this.searchNotificationAddress =
      process.env['SEARCH_NOTIFICATION_SERVICE_GRPC_ADDR'] ??
      'search-notification-service:50055';
  }

  build(): EdmsGrpcClients {
    const protoPath = resolveServiceProtoPath();

    return {
      documentService: createGrpcClient('DocumentService', this.documentAddress, protoPath),
      documentWorkflowService: createGrpcClient(
        'DocumentWorkflowService',
        this.documentAddress,
        protoPath,
      ),
      signatureService: createGrpcClient('SignatureService', this.signatureAddress, protoPath),
      authorizationAuditService: createGrpcClient(
        'AuthorizationAuditService',
        this.authAuditAddress,
        protoPath,
      ),
      searchNotificationService: createGrpcClient(
        'SearchNotificationService',
        this.searchNotificationAddress,
        protoPath,
      ),
    };
  }
}
