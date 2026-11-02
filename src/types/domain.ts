export type CredentialFormat = 'w3c_vc_jsonld' | 'sd_jwt_vc' | 'mso_mdoc';

export type ProofType = 'Ed25519Signature2020' | 'JsonWebSignature2020' | 'ES256' | 'RSA';

export type ComponentRole = 'issuer' | 'wallet' | 'verifier';

export type ComponentStatus = 'ready' | 'degraded' | 'unconfigured' | 'offline';

export interface ComponentMetadata {
  id: string;
  name: string;
  role: ComponentRole;
  isMock: boolean;
  version: string;
  supportedFormats: CredentialFormat[];
  supportedProtocols: string[];
  status: ComponentStatus;
  description: string;
  endpointUrl?: string;
}

export type StageId =
  | 'DISCOVERY_AND_CONFIG'
  | 'OFFER_ISSUANCE'
  | 'WALLET_STORAGE'
  | 'PRESENTATION_REQUEST'
  | 'PRESENTATION_SUBMISSION'
  | 'AUTHORITATIVE_VERIFICATION'
  | 'REPORT_GENERATION';

export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface StageResult {
  id: StageId;
  name: string;
  status: StageStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: StageError;
  data?: Record<string, unknown>;
}

export interface StageError {
  code: string;
  message: string;
  details?: unknown;
  isRecoverable: boolean;
  isAuthoritativeFailure: boolean; // true = protocol/crypto violation; false = timeout/network infra
}

export type ProtocolType = 'OPENID4VCI' | 'OPENID4VP' | 'INTERNAL';

export type ProtocolParty = 'ISSUER' | 'WALLET' | 'VERIFIER' | 'ORCHESTRATOR';

export interface ProtocolEvent {
  eventId: string;
  runId: string;
  timestamp: string;
  stage: StageId;
  protocol: ProtocolType;
  source: ProtocolParty;
  destination: ProtocolParty;
  action: string;
  payloadSummary: string;
  rawPayload: Record<string, unknown>;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  httpStatus?: number;
  durationMs?: number;
}

export type RunStatus =
  | 'PENDING'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'AWAITING_WALLET_ACTION'
  | 'COMPLETED'
  | 'FAILED'
  | 'ABORTED';

export type Verdict = 'PASSED' | 'FAILED' | 'INCONCLUSIVE' | 'UNTESTED';

export interface AuthoritativeVerificationEvidence {
  verifiedAt: string;
  verifierComponentId: string;
  overallStatus: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED' | 'UNTRUSTED_ISSUER' | 'UNPARSEABLE';
  isSignatureValid: boolean;
  isExpired: boolean;
  isRevoked: boolean;
  isIssuerTrusted: boolean;
  credentialType?: string;
  claimsValidated: Record<string, unknown>;
  verifierRawResponse: Record<string, unknown>;
}

export interface TestReport {
  runId: string;
  verdict: Verdict;
  summary: string;
  evaluatedAt: string;
  issuerId: string;
  walletId: string;
  verifierId: string;
  format: CredentialFormat;
  proofType?: ProofType;
  authoritativeEvidence?: AuthoritativeVerificationEvidence;
  inconclusiveReason?: string;
  failureReason?: string;
  totalDurationMs: number;
}

export interface TestRunConfig {
  issuerId: string;
  walletId: string;
  verifierId: string;
  format: CredentialFormat;
  proofType?: ProofType;
  interactiveMode?: boolean; // If true, pauses for manual wallet action (QR scan/deep link)
  mockTamper?: {
    corruptSignature?: boolean;
    forceExpired?: boolean;
    alterClaims?: boolean;
  };
}

export interface TestRun {
  runId: string;
  config: TestRunConfig;
  status: RunStatus;
  currentStage: StageId;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stages: Record<StageId, StageResult>;
  events: ProtocolEvent[];
  qrPayload?: {
    type: 'credential_offer_uri' | 'presentation_request_uri';
    uri: string;
  };
  report?: TestReport;
}
