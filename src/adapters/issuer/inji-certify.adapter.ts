import { BaseAdapter } from '../base.js';
import {
  DeliverCredentialParams,
  DeliverCredentialResult,
  IIssuerAdapter,
  InitiateIssuanceParams,
  IssuanceOfferResult,
} from '../../types/adapters.js';
import { config } from '../../config/env.js';

export class InjiCertifyAdapter extends BaseAdapter implements IIssuerAdapter {
  public readonly id = 'inji-certify';
  public readonly name = 'Inji Certify (MOSIP OpenID4VCI)';
  public readonly isMock = false;

  private baseUrl: string;

  constructor(baseUrl = config.injiCertifyBaseUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  public async initiateIssuance(params: InitiateIssuanceParams): Promise<IssuanceOfferResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/issuance/credential-offer`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          credential_configuration_id: params.format,
          holder_did: params.holderBindingDid,
          claims: params.claimsPayload,
        }),
      });

      const responseBody = (await response.json()) as Record<string, unknown>;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'OFFER_ISSUANCE',
        'OPENID4VCI',
        'ISSUER',
        'WALLET',
        'INJI_CERTIFY_OFFER_INITIATED',
        `Inji Certify HTTP ${response.status} credential offer response`,
        {
          endpoint,
          requestFormat: params.format,
          response: responseBody,
        },
        response.status,
        durationMs
      );

      if (!response.ok) {
        throw new Error(
          `Inji Certify returned error status ${response.status}: ${JSON.stringify(responseBody)}`
        );
      }

      return {
        offerUri: (responseBody.credential_offer_uri as string) || (responseBody.offer_uri as string),
        preAuthorizedCode: responseBody.pre_authorized_code as string | undefined,
        issuerEndpoint: this.baseUrl,
        metadata: responseBody,
        protocolEvents: [event],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'OFFER_ISSUANCE',
        'OPENID4VCI',
        'ISSUER',
        'ORCHESTRATOR',
        'INJI_CERTIFY_CONNECT_ERROR',
        `Failed to reach Inji Certify at ${endpoint}: ${errorMsg}`,
        { endpoint, error: errorMsg },
        502,
        durationMs
      );

      // Re-throw with clear message for the engine to mark inconclusive / infra failure
      throw Object.assign(new Error(`Inji Certify connection error: ${errorMsg}`), {
        protocolEvents: [event],
        isAuthoritativeFailure: false,
      });
    }
  }

  public async deliverCredential(params: DeliverCredentialParams): Promise<DeliverCredentialResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/issuance/credential`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.accessToken}`,
        },
        body: JSON.stringify({
          format: params.format,
        }),
      });

      const responseBody = (await response.json()) as Record<string, unknown>;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'OFFER_ISSUANCE',
        'OPENID4VCI',
        'ISSUER',
        'WALLET',
        'INJI_CERTIFY_CREDENTIAL_RESPONSE',
        `Inji Certify delivered credential with status ${response.status}`,
        { response: responseBody },
        response.status,
        durationMs
      );

      if (!response.ok) {
        throw new Error(`Inji Certify credential endpoint returned ${response.status}`);
      }

      return {
        credential: (responseBody.credential as Record<string, unknown>) || responseBody,
        format: params.format,
        protocolEvents: [event],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Certify credential delivery failed: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    }
  }
}
