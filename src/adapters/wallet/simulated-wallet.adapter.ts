import { v4 as uuidv4 } from 'uuid';
import { BaseAdapter } from '../base.js';
import {
  IWalletAdapter,
  PresentationSubmissionResult,
  WalletAcceptOfferParams,
  WalletGeneratePresentationParams,
  WalletHoldingResult,
} from '../../types/adapters.js';

export class SimulatedWalletAdapter extends BaseAdapter implements IWalletAdapter {
  public readonly id = 'simulated-wallet';
  public readonly name = 'Simulated Automated Holder';
  public readonly isInteractive = false;

  private heldCredentials: Map<string, unknown> = new Map();

  public async acceptOffer(params: WalletAcceptOfferParams): Promise<WalletHoldingResult> {
    const startTime = Date.now();
    const storedCredentialId = `cred-${uuidv4()}`;

    // Emulate wallet receiving and storing credential
    const tokenEvent = this.buildEvent(
      'WALLET_STORAGE',
      'OPENID4VCI',
      'WALLET',
      'ISSUER',
      'TOKEN_REQUEST',
      'Simulated wallet exchanged pre-authorized code for issuance access token',
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code: params.offerResult.preAuthorizedCode,
      },
      200,
      25
    );

    const storeEvent = this.buildEvent(
      'WALLET_STORAGE',
      'INTERNAL',
      'WALLET',
      'WALLET',
      'CREDENTIAL_STORED',
      `Simulated wallet parsed and stored credential for format: ${params.format}`,
      {
        storedCredentialId,
        format: params.format,
      },
      undefined,
      Date.now() - startTime
    );

    this.heldCredentials.set(params.runId, {
      format: params.format,
      storedCredentialId,
      metadata: params.offerResult.metadata,
    });

    return {
      storedCredentialId,
      credentialPayload: {
        id: storedCredentialId,
        format: params.format,
        status: 'STORED',
      },
      protocolEvents: [tokenEvent, storeEvent],
    };
  }

  public async generatePresentation(
    params: WalletGeneratePresentationParams
  ): Promise<PresentationSubmissionResult> {
    const startTime = Date.now();
    const isCorrupted = params.tamper?.corruptSignature ?? false;
    const isExpired = params.tamper?.forceExpired ?? false;

    const vpToken = {
      '@context': ['https://www.w3.org/2018/credentials/v1'],
      type: ['VerifiablePresentation'],
      verifiableCredential: [
        {
          id: `urn:uuid:${uuidv4()}`,
          type: ['VerifiableCredential', 'IdentityCredential'],
          issuer: 'did:key:z6MkuV4rZ59s7TMockIssuerKey',
          expirationDate: isExpired
            ? new Date(Date.now() - 86400000).toISOString()
            : new Date(Date.now() + 86400000 * 365).toISOString(),
          credentialSubject: {
            fullName: params.tamper?.alterClaims ? 'Tampered Name' : 'Alice Developer',
            country: 'IN',
          },
          proof: {
            type: 'Ed25519Signature2020',
            proofValue: isCorrupted ? 'CORRUPTED_SIGNATURE_BYTES' : 'valid_signature_proof_base58_simulated',
          },
        },
      ],
    };

    const presentationSubmission = {
      id: `submission-${uuidv4()}`,
      definition_id: (params.presentationDefinition?.id as string) || 'identity_verification',
      descriptor_map: [
        {
          id: 'identity_input',
          format: 'ldp_vc',
          path: '$.verifiableCredential[0]',
        },
      ],
    };

    const submissionEvent = this.buildEvent(
      'PRESENTATION_SUBMISSION',
      'OPENID4VP',
      'WALLET',
      'VERIFIER',
      'VP_TOKEN_SUBMITTED',
      `Simulated wallet submitted VP token (Tampered: ${isCorrupted || isExpired})`,
      {
        vp_token: vpToken,
        presentation_submission: presentationSubmission,
        submission_target: params.presentationRequestUri,
      },
      200,
      Date.now() - startTime
    );

    return {
      vpToken,
      presentationSubmission,
      submittedToUrl: params.presentationRequestUri,
      protocolEvents: [submissionEvent],
    };
  }
}
