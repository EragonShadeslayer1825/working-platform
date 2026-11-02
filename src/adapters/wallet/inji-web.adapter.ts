import { BaseAdapter } from '../base.js';
import {
  IWalletAdapter,
  PresentationSubmissionResult,
  WalletAcceptOfferParams,
  WalletGeneratePresentationParams,
  WalletHoldingResult,
} from '../../types/adapters.js';
import { config } from '../../config/env.js';

export class InjiWebAdapter extends BaseAdapter implements IWalletAdapter {
  public readonly id = 'inji-web';
  public readonly name = 'Inji Web (Browser Holder)';
  public readonly isInteractive = false;

  private baseUrl: string;

  constructor(baseUrl = config.mimotoWalletBaseUrl) {
    super();
    this.baseUrl = baseUrl;
  }

  public async acceptOffer(params: WalletAcceptOfferParams): Promise<WalletHoldingResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/wallet/credentials/download`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credential_offer_uri: params.offerResult?.offerUri || params.offerUri || '',
          format: params.format,
        }),
      });

      const responseBody = (await response.json()) as Record<string, unknown>;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'WALLET_STORAGE',
        'OPENID4VCI',
        'WALLET',
        'ISSUER',
        'MIMOTO_DOWNLOAD_CREDENTIAL',
        `Inji Web (Mimoto) handled credential download with status ${response.status}`,
        { response: responseBody },
        response.status,
        durationMs
      );

      if (!response.ok) {
        throw new Error(`Mimoto wallet returned status ${response.status}`);
      }

      return {
        storedCredentialId: (responseBody.credentialId as string) || 'inji-web-cred',
        credentialPayload: responseBody,
        protocolEvents: [event],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Web wallet error: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    }
  }

  public async generatePresentation(
    params: WalletGeneratePresentationParams
  ): Promise<PresentationSubmissionResult> {
    const startTime = Date.now();
    const endpoint = `${this.baseUrl}/wallet/presentation/submit`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          presentation_request_uri: params.presentationRequestUri,
          presentation_definition: params.presentationDefinition,
        }),
      });

      const responseBody = (await response.json()) as Record<string, unknown>;
      const durationMs = Date.now() - startTime;

      const event = this.buildEvent(
        'PRESENTATION_SUBMISSION',
        'OPENID4VP',
        'WALLET',
        'VERIFIER',
        'MIMOTO_SUBMIT_PRESENTATION',
        `Inji Web (Mimoto) submitted VP with status ${response.status}`,
        { response: responseBody },
        response.status,
        durationMs
      );

      if (!response.ok) {
        throw new Error(`Mimoto presentation submission failed with status ${response.status}`);
      }

      return {
        vpToken: (responseBody.vp_token as Record<string, unknown>) || {},
        presentationSubmission: (responseBody.presentation_submission as Record<string, unknown>) || {},
        submittedToUrl: params.presentationRequestUri,
        protocolEvents: [event],
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      throw Object.assign(new Error(`Inji Web presentation failed: ${errorMsg}`), {
        isAuthoritativeFailure: false,
      });
    }
  }
}
