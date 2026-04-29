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
