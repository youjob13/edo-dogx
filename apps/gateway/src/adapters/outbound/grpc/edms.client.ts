import { credentials, Client } from '@grpc/grpc-js';
import { loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'node:path';

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
    const packageDefinition = loadSync(
      path.resolve(process.cwd(), '../../shared/proto/service.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
      },
    );

    const pkg = loadPackageDefinition(packageDefinition) as unknown as {
      service: {
        v1: Record<string, new (address: string, creds: ReturnType<typeof credentials.createInsecure>) => Client>;
      };
    };

    const ns = pkg.service.v1;
    const creds = credentials.createInsecure();

    return {
      documentService: new ns['DocumentService'](this.documentAddress, creds),
      documentWorkflowService: new ns['DocumentWorkflowService'](
        this.documentAddress,
        creds,
      ),
      signatureService: new ns['SignatureService'](this.signatureAddress, creds),
      authorizationAuditService: new ns['AuthorizationAuditService'](
        this.authAuditAddress,
        creds,
      ),
      searchNotificationService: new ns['SearchNotificationService'](
        this.searchNotificationAddress,
        creds,
      ),
    };
  }
}
