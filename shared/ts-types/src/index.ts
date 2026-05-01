// Shared TypeScript types for the EDO monorepo.
// Types are generated or hand-authored based on OpenAPI / Proto contracts.

export interface HealthResponse {
  status: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  roles: string[];
}

export type DocumentCategory = 'HR' | 'FINANCE' | 'GENERAL';

export interface CreateDocumentRequest {
  title: string;
  category: DocumentCategory;
}

export interface DocumentResponse {
  id: string;
  title: string;
  category: DocumentCategory;
  status: string;
}

export interface SignatureSigner {
  userId: string;
  dueAt?: string;
}

export interface CreateSignatureRequest {
  signers: SignatureSigner[];
}

export interface AuditEventResponse {
  id: string;
  actionType: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILED';
  occurredAt: string;
}
