import { credentials, Client } from '@grpc/grpc-js';
import { loadPackageDefinition } from '@grpc/grpc-js';
import { loadSync } from '@grpc/proto-loader';
import path from 'node:path';

interface EdmsGrpcClients {
  documentService: Client;
  workflowService: Client;
  signatureService: Client;
  authorizationService: Client;
  auditService: Client;
  notificationService: Client;
}

export class EdmsGrpcClientBootstrap {
  private readonly address: string;

  constructor(address = process.env['SERVICE_GRPC_ADDR'] ?? 'service:50051') {
    this.address = address;
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
      documentService: new ns['DocumentService'](this.address, creds),
      workflowService: new ns['WorkflowService'](this.address, creds),
      signatureService: new ns['SignatureService'](this.address, creds),
      authorizationService: new ns['AuthorizationService'](this.address, creds),
      auditService: new ns['AuditService'](this.address, creds),
      notificationService: new ns['NotificationService'](this.address, creds),
    };
  }
}
