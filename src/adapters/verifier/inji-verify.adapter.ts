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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.stageTimeoutMs || 30000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          format: params.format,
          callback_url: params.callbackUrl,
          required_claims: params.requiredClaims || ['fullName', 'country'],
        }),
        signal: controller.signal,
      });

      const responseBody = (await response.json().catch(() => null)) as Record<string, unknown> | null;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'PRESENTATION_REQUEST',
        'OPENID4VP',
        'VERIFIER',
        'WALLET',
        'INJI_VERIFY_REQUEST_CREATED',
        `Inji Verify presentation request response (HTTP ${response.status})`,
        { response: responseBody || {} },
        response.status,
        durationMs,
        { format: params.format, callback_url: params.callbackUrl },
        responseBody || {}
      );

      if (!response.ok || !responseBody) {
        throw new Error(
          `Inji Verify presentation request returned HTTP ${response.status}${
            responseBody ? `: ${JSON.stringify(responseBody)}` : ''
          }`
        );
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
    } finally {
      clearTimeout(timeout);
    }
  }

  public async evaluateAuthoritativeResult(
    params: EvaluateResultParams
  ): Promise<AuthoritativeVerificationEvidence> {
    const endpoint = `${this.baseUrl}/v1/verify`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.stageTimeoutMs || 30000);

    try {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            vp_token: params.vpToken,
            presentation_submission: params.presentationSubmission,
            nonce: params.nonce,
          }),
          signal: controller.signal,
        });
      } catch (netErr: unknown) {
        const msg = netErr instanceof Error ? netErr.message : String(netErr);
        throw Object.assign(new Error(`Inji Verify transport failure: ${msg}`), {
          isAuthoritativeFailure: false,
        });
      }

      // 5xx status codes indicate service/infrastructure errors, not authoritative rejection
      if (response.status >= 500) {
        throw Object.assign(
          new Error(`Inji Verify service unavailable or failed: HTTP ${response.status}`),
          { isAuthoritativeFailure: false }
        );
      }

      let raw: Record<string, unknown>;
      try {
        const text = await response.text();
        raw = JSON.parse(text);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          throw new Error('Response is not a valid JSON object');
        }
      } catch (parseErr) {
        throw Object.assign(
          new Error(
            `Inji Verify returned unparseable body: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
          ),
          { isAuthoritativeFailure: false }
        );
      }

      // Schema verification: never default missing status to VALID
      const rawStatus = raw.verificationStatus || raw.status || raw.verification_status;
      if (!rawStatus || typeof rawStatus !== 'string') {
        return {
          verifiedAt: new Date().toISOString(),
          verifierComponentId: this.id,
          overallStatus: 'UNPARSEABLE',
          isSignatureValid: false,
          isExpired: false,
          isRevoked: false,
          isIssuerTrusted: false,
          claimsValidated: {},
          verifierRawResponse: raw,
        };
      }

      const statusUpper = rawStatus.toUpperCase().trim();
      let overallStatus: AuthoritativeVerificationEvidence['overallStatus'];

      if (statusUpper === 'VALID' || statusUpper === 'SUCCESS' || statusUpper === 'PASSED') {
        overallStatus = 'VALID';
      } else if (statusUpper.includes('EXPIRED')) {
        overallStatus = 'EXPIRED';
      } else if (statusUpper.includes('REVOKED')) {
        overallStatus = 'REVOKED';
      } else if (statusUpper.includes('UNTRUSTED') || statusUpper.includes('UNKNOWN_ISSUER')) {
        overallStatus = 'UNTRUSTED_ISSUER';
      } else if (statusUpper === 'INVALID' || statusUpper === 'FAILED') {
        overallStatus = 'INVALID';
      } else {
        overallStatus = 'UNPARSEABLE';
      }

      // Explicit field mapping without inferring signature/trust purely from overallStatus
      const isSignatureValid =
        typeof raw.isSignatureValid === 'boolean'
          ? raw.isSignatureValid
          : typeof raw.signatureValid === 'boolean'
          ? raw.signatureValid
          : overallStatus === 'VALID';

      const isExpired =
        typeof raw.isExpired === 'boolean'
          ? raw.isExpired
          : overallStatus === 'EXPIRED';

      const isRevoked =
        typeof raw.isRevoked === 'boolean'
          ? raw.isRevoked
          : overallStatus === 'REVOKED';

      const isIssuerTrusted =
        typeof raw.isIssuerTrusted === 'boolean'
          ? raw.isIssuerTrusted
          : typeof raw.issuerTrusted === 'boolean'
          ? raw.issuerTrusted
          : overallStatus === 'VALID';

      const credentialType =
        typeof raw.credentialType === 'string'
          ? (raw.credentialType as string)
          : typeof raw.type === 'string'
          ? (raw.type as string)
          : undefined;

      const claimsValidated =
        (raw.claims as Record<string, unknown>) ||
        (raw.credentialSubject as Record<string, unknown>) ||
        {};

      return {
        verifiedAt: new Date().toISOString(),
        verifierComponentId: this.id,
        overallStatus,
        isSignatureValid,
        isExpired,
        isRevoked,
        isIssuerTrusted,
        credentialType,
        claimsValidated,
        verifierRawResponse: raw,
      };
    } catch (err: unknown) {
      if ((err as { isAuthoritativeFailure?: boolean }).isAuthoritativeFailure !== undefined) {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Verify authoritative evaluation error: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
