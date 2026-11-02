import { v4 as uuidv4 } from 'uuid';
import { BaseAdapter } from '../base.js';
import {
  IWalletAdapter,
  PresentationSubmissionResult,
  WalletAcceptOfferParams,
  WalletGeneratePresentationParams,
  WalletHoldingResult,
} from '../../types/adapters.js';

interface StoredCredentialEntry {
  storedCredentialId: string;
  format: string;
  credential: Record<string, unknown> | string;
  metadata?: Record<string, unknown>;
}

export class SimulatedWalletAdapter extends BaseAdapter implements IWalletAdapter {
  public readonly id = 'simulated-wallet';
  public readonly name = 'Simulated Automated Holder (Simulated Crypto)';
  public readonly isInteractive = false;

  private heldCredentials: Map<string, StoredCredentialEntry> = new Map();

  /**
   * Diagnostic helper for tests to verify credential preservation across stages.
   */
  public getHeldCredential(runId: string): StoredCredentialEntry | undefined {
    return this.heldCredentials.get(runId);
  }

  public async acceptOffer(params: WalletAcceptOfferParams): Promise<WalletHoldingResult> {
    const startTime = Date.now();
    const storedCredentialId = `cred-${uuidv4()}`;

    // Obtain the exact credential from issuer if not directly supplied
    let credentialPayload = params.issuedCredential;
    if (!credentialPayload && params.issuer) {
      const delivered = await params.issuer.deliverCredential({
        runId: params.runId,
        accessToken: params.offerResult?.preAuthorizedCode || params.preAuthorizedCode || 'simulated-token',
        format: params.format,
      });
      credentialPayload = delivered.credential;
    }

    if (!credentialPayload) {
      throw new Error(`Simulated wallet did not receive a credential from the issuer for run ${params.runId}`);
    }

    // Emulate wallet exchanging pre-authorized code and storing the EXACT credential
    const tokenEvent = this.buildEvent(
      'WALLET_STORAGE',
      'OPENID4VCI',
      'WALLET',
      'ISSUER',
      'TOKEN_REQUEST',
      'Simulated wallet exchanged pre-authorized code for issuance access token (Simulated)',
      {
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code: params.offerResult?.preAuthorizedCode || params.preAuthorizedCode || 'simulated-preauth-code',
      },
      200,
      25,
      { grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code' },
      { access_token: '[SIMULATED_TOKEN]', token_type: 'Bearer' }
    );

    const storeEvent = this.buildEvent(
      'WALLET_STORAGE',
      'INTERNAL',
      'WALLET',
      'WALLET',
      'CREDENTIAL_STORED',
      `Simulated wallet parsed and stored exact issued credential for format: ${params.format}`,
      {
        storedCredentialId,
        format: params.format,
        credential: credentialPayload,
      },
      undefined,
      Date.now() - startTime
    );

    // Store the exact credential in the wallet
    this.heldCredentials.set(params.runId, {
      storedCredentialId,
      format: params.format,
      credential: credentialPayload,
      metadata: params.offerResult?.metadata || {},
    });

    return {
      storedCredentialId,
      credentialPayload,
      protocolEvents: [tokenEvent, storeEvent],
    };
  }

  public async generatePresentation(
    params: WalletGeneratePresentationParams
  ): Promise<PresentationSubmissionResult> {
    const startTime = Date.now();
    const held = this.heldCredentials.get(params.runId);

    if (!held) {
      throw new Error(`Simulated wallet has no stored credential for run ${params.runId}`);
    }

    const isCorrupted = params.tamper?.corruptSignature ?? false;
    const isExpired = params.tamper?.forceExpired ?? false;
    const isClaimsAltered = params.tamper?.alterClaims ?? false;

    // Clone the exact stored credential so tampering is isolated to this presentation
    let presentedCredential: Record<string, unknown> | string;
    if (typeof held.credential === 'string') {
      presentedCredential = held.credential;
      if (isCorrupted) {
        presentedCredential = presentedCredential + '_CORRUPTED_SIGNATURE_BYTES';
      }
      if (isExpired) {
        presentedCredential = presentedCredential + '~EXPIRED';
      }
      if (isClaimsAltered) {
        presentedCredential = presentedCredential.replace('Alice', 'Tampered Name');
      }
    } else {
      presentedCredential = JSON.parse(JSON.stringify(held.credential)) as Record<string, unknown>;

      if (isCorrupted) {
        const proof = (presentedCredential.proof as Record<string, unknown>) || {};
        proof.proofValue = 'CORRUPTED_SIGNATURE_BYTES';
        proof.jws = 'CORRUPTED_SIGNATURE_BYTES';
        presentedCredential.proof = proof;
      }

      if (isExpired) {
        presentedCredential.expirationDate = new Date(Date.now() - 86400000).toISOString();
      }

      if (isClaimsAltered) {
        const subject = (presentedCredential.credentialSubject as Record<string, unknown>) || {};
        subject.fullName = 'Tampered Name';
        presentedCredential.credentialSubject = subject;
      }
    }

    // Wrap the exact credential in a Verifiable Presentation
    let vpToken: Record<string, unknown> | string;
    if (typeof presentedCredential === 'string') {
      vpToken = presentedCredential;
    } else {
      vpToken = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [presentedCredential],
      };
    }

    const presentationSubmission = {
      id: `submission-${uuidv4()}`,
      definition_id: (params.presentationDefinition?.id as string) || 'identity_verification',
      descriptor_map: [
        {
          id: 'identity_input',
          format: held.format === 'sd_jwt_vc' ? 'vc+sd-jwt' : 'ldp_vc',
          path: held.format === 'sd_jwt_vc' ? '$' : '$.verifiableCredential[0]',
        },
      ],
    };

    const submissionEvent = this.buildEvent(
      'PRESENTATION_SUBMISSION',
      'OPENID4VP',
      'WALLET',
      'VERIFIER',
      'VP_TOKEN_SUBMITTED',
      `Simulated wallet submitted VP token using exact stored credential (Tampered: ${isCorrupted || isExpired || isClaimsAltered})`,
      {
        vp_token: vpToken,
        presentation_submission: presentationSubmission,
        submission_target: params.presentationRequestUri,
        simulated: true,
      },
      200,
      Date.now() - startTime,
      { presentation_definition: params.presentationDefinition },
      { vp_token: vpToken, presentation_submission: presentationSubmission }
    );

    return {
      vpToken,
      presentationSubmission,
      submittedToUrl: params.presentationRequestUri,
      protocolEvents: [submissionEvent],
    };
  }
}
