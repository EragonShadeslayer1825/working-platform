import { BaseAdapter } from '../base.js';
import {
  CreatePresentationRequestParams,
  EvaluateResultParams,
  IVerifierAdapter,
  PresentationRequestResult,
} from '../../types/adapters.js';
import { AuthoritativeVerificationEvidence } from '../../types/domain.js';
import { config } from '../../config/env.js';

export class InjiVerifyAdapter extends BaseAdapter implements IVerifierAdapter {
  public readonly id = 'inji-verify';
  public readonly name = 'Inji Verify (MOSIP OpenID4VP)';
  public readonly isMock = false;

  private baseUrl: string;

  constructor(baseUrl = config.injiVerifyBaseUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  public async createPresentationRequest(
    params: CreatePresentationRequestParams
  ): Promise<PresentationRequestResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/v1/presentation-request`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format: params.format,
          callback_url: params.callbackUrl,
          required_claims: params.requiredClaims || ['fullName', 'country'],
        }),
      });

      const responseBody = (await response.json()) as Record<string, unknown>;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'PRESENTATION_REQUEST',
        'OPENID4VP',
        'VERIFIER',
        'WALLET',
        'INJI_VERIFY_REQUEST_CREATED',
        `Inji Verify generated presentation request (status ${response.status})`,
        { response: responseBody },
        response.status,
        durationMs
      );

      if (!response.ok) {
        throw new Error(`Inji Verify returned HTTP status ${response.status}`);
      }

      return {
        requestUri: (responseBody.request_uri as string) || (responseBody.authorization_request as string),
        presentationDefinition: (responseBody.presentation_definition as Record<string, unknown>) || {},
        nonce: (responseBody.nonce as string) || 'inji-nonce',
        clientId: (responseBody.client_id as string) || this.baseUrl,
        protocolEvents: [event],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Verify presentation request failed: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    }
  }

  public async evaluateAuthoritativeResult(
    params: EvaluateResultParams
  ): Promise<AuthoritativeVerificationEvidence> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/v1/verify`;

    try {
      // Inji Verify evaluates cryptographic proof and revocation
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vp_token: params.vpToken,
          presentation_submission: params.presentationSubmission,
          nonce: params.nonce,
        }),
      });

      const raw = (await response.json()) as Record<string, unknown>;
      const isOk = response.ok;
      const statusStr = String(raw.verificationStatus || raw.status || (isOk ? 'VALID' : 'INVALID')).toUpperCase();

      let overallStatus: AuthoritativeVerificationEvidence['overallStatus'] = 'VALID';
      if (statusStr.includes('EXPIRED')) {
        overallStatus = 'EXPIRED';
      } else if (statusStr.includes('REVOKED')) {
        overallStatus = 'REVOKED';
      } else if (statusStr.includes('UNTRUSTED') || statusStr.includes('UNKNOWN_ISSUER')) {
        overallStatus = 'UNTRUSTED_ISSUER';
      } else if (!isOk || statusStr.includes('INVALID') || statusStr.includes('FAILED')) {
        overallStatus = 'INVALID';
      }

      return {
        verifiedAt: new Date().toISOString(),
        verifierComponentId: this.id,
        overallStatus,
        isSignatureValid: overallStatus === 'VALID',
        isExpired: overallStatus === 'EXPIRED',
        isRevoked: overallStatus === 'REVOKED',
        isIssuerTrusted: overallStatus !== 'UNTRUSTED_ISSUER',
        claimsValidated: (raw.claims as Record<string, unknown>) || {},
        verifierRawResponse: raw,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Verify authoritative evaluation error: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    }
  }
}
