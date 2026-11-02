import { BaseAdapter } from '../base.js';
import {
  IWalletAdapter,
  PresentationSubmissionResult,
  WalletAcceptOfferParams,
  WalletGeneratePresentationParams,
  WalletHoldingResult,
} from '../../types/adapters.js';

/**
 * Inji Mobile Wallet Adapter
 * Represents the interactive React Native Inji Wallet with QR scan and deep link lifecycle.
 * In automated pipelines, this adapter requires interactiveMode = true and pauses for user action.
 */
export class InjiMobileWalletAdapter extends BaseAdapter implements IWalletAdapter {
  public readonly id = 'inji-wallet-mobile';
  public readonly name = 'Inji Wallet Mobile (Interactive QR / Deep Link)';
  public readonly isInteractive = true;

  public async acceptOffer(params: WalletAcceptOfferParams): Promise<WalletHoldingResult> {
    const startTime = Date.now();
    const offerUri = params.offerResult?.offerUri || params.offerUri || '';
    const deepLinkUri = offerUri.startsWith('openid-credential-offer://')
      ? offerUri
      : `openid-credential-offer://?credential_offer_uri=${encodeURIComponent(offerUri)}`;

    const event = this.buildEvent(
      'WALLET_STORAGE',
      'OPENID4VCI',
      'WALLET',
      'WALLET',
      'MOBILE_CREDENTIAL_OFFER_RECEIVED',
      `Mobile wallet received credential offer; awaiting user QR scan / authorization`,
      {
        offer_uri: offerUri,
        deep_link_uri: deepLinkUri,
        format: params.format,
        interactive: true,
      },
      undefined,
      Date.now() - startTime
    );

    return {
      storedCredentialId: `mobile-pending-${params.runId}`,
      credentialPayload: {
        status: 'AWAITING_USER_SCAN',
        deepLinkUri,
        format: params.format,
      },
      protocolEvents: [event],
    };
  }

  public async generatePresentation(
    params: WalletGeneratePresentationParams
  ): Promise<PresentationSubmissionResult> {
    const startTime = Date.now();
    const deepLinkUri = params.presentationRequestUri.startsWith('openid4vp://')
      ? params.presentationRequestUri
      : `openid4vp://?request_uri=${encodeURIComponent(params.presentationRequestUri)}`;

    const event = this.buildEvent(
      'PRESENTATION_SUBMISSION',
      'OPENID4VP',
      'WALLET',
      'VERIFIER',
      'MOBILE_PRESENTATION_REQUEST_AWAITING_SCAN',
      `Mobile wallet presentation request rendered for user biometric authorization`,
      {
        presentation_request_uri: params.presentationRequestUri,
        deep_link_uri: deepLinkUri,
        interactive: true,
      },
      undefined,
      Date.now() - startTime
    );

    return {
      vpToken: {
        type: 'InteractivePendingVP',
        deepLinkUri,
        message: 'Awaiting mobile device biometric authorization and submission via OpenID4VP',
      },
      presentationSubmission: {
        definition_id: (params.presentationDefinition?.id as string) || 'mobile_flow',
        descriptor_map: [],
      },
      submittedToUrl: params.presentationRequestUri,
      protocolEvents: [event],
    };
  }
}
