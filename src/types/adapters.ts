import {
  AuthoritativeVerificationEvidence,
  CredentialFormat,
  ProofType,
  ProtocolEvent,
} from './domain.js';

export interface InitiateIssuanceParams {
  runId: string;
  format: CredentialFormat;
  proofType?: ProofType;
  holderBindingDid?: string;
  claimsPayload?: Record<string, unknown>;
}

export interface IssuanceOfferResult {
  offerUri: string;
  preAuthorizedCode?: string;
  issuerEndpoint: string;
  metadata: Record<string, unknown>;
  protocolEvents: Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'>[];
}

export interface DeliverCredentialParams {
  runId: string;
  accessToken: string;
  format: CredentialFormat;
}

export interface DeliverCredentialResult {
  credential: Record<string, unknown> | string;
  format: CredentialFormat;
  protocolEvents: Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'>[];
}

export interface IIssuerAdapter {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  initiateIssuance(params: InitiateIssuanceParams): Promise<IssuanceOfferResult>;
  deliverCredential(params: DeliverCredentialParams): Promise<DeliverCredentialResult>;
}

export interface WalletAcceptOfferParams {
  runId: string;
  offerResult?: IssuanceOfferResult;
  offerUri?: string;
  preAuthorizedCode?: string;
  userPin?: string;
  format: CredentialFormat;
  issuedCredential?: Record<string, unknown> | string;
  issuer?: IIssuerAdapter;
}

export interface WalletHoldingResult {
  storedCredentialId: string;
  credentialPayload: Record<string, unknown> | string;
  protocolEvents: Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'>[];
}

export interface WalletGeneratePresentationParams {
  runId: string;
  presentationRequestUri: string;
  presentationDefinition: Record<string, unknown>;
  tamper?: {
    corruptSignature?: boolean;
    forceExpired?: boolean;
    alterClaims?: boolean;
  };
}

export interface PresentationSubmissionResult {
  vpToken: string | Record<string, unknown>;
  presentationSubmission: Record<string, unknown>;
  submittedToUrl: string;
  protocolEvents: Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'>[];
}

export interface IWalletAdapter {
  readonly id: string;
  readonly name: string;
  readonly isInteractive: boolean;
  acceptOffer(params: WalletAcceptOfferParams): Promise<WalletHoldingResult>;
  generatePresentation(params: WalletGeneratePresentationParams): Promise<PresentationSubmissionResult>;
}

export interface CreatePresentationRequestParams {
  runId: string;
  format: CredentialFormat;
  requiredClaims?: string[];
  callbackUrl: string;
}

export interface PresentationRequestResult {
  requestUri: string;
  presentationDefinition: Record<string, unknown>;
  nonce: string;
  clientId: string;
  protocolEvents: Omit<ProtocolEvent, 'eventId' | 'runId' | 'timestamp'>[];
}

export interface EvaluateResultParams {
  runId: string;
  vpToken: string | Record<string, unknown>;
  presentationSubmission: Record<string, unknown>;
  nonce: string;
}

export interface IVerifierAdapter {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;
  createPresentationRequest(params: CreatePresentationRequestParams): Promise<PresentationRequestResult>;
  evaluateAuthoritativeResult(params: EvaluateResultParams): Promise<AuthoritativeVerificationEvidence>;
}
