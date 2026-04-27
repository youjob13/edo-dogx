export interface SignInRequest {
  readonly email: string;
  readonly password: string;
}

export interface SignUpRequest {
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
  readonly acceptedTerms: boolean;
}