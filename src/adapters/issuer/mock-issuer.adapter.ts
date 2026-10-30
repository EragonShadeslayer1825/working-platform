import { v4 as uuidv4 } from 'uuid';
import { BaseAdapter } from '../base.js';
import {
  DeliverCredentialParams,
  DeliverCredentialResult,
  IIssuerAdapter,
  InitiateIssuanceParams,
  IssuanceOfferResult,
} from '../../types/adapters.js';

export class MockIssuerAdapter extends BaseAdapter implements IIssuerAdapter {
  public readonly id = 'mock-openid4vci';
  public readonly name = 'Mock OpenID4VCI Reference Issuer';
  public readonly isMock = true;

  public async initiateIssuance(params: InitiateIssuanceParams): Promise<IssuanceOfferResult> {
    const startTime = Date.now();
    const preAuthorizedCode = uuidv4();
    const credentialIssuerUrl = 'https://mock-issuer.playground.local/oauth';

    const credentialOfferPayload = {
      credential_issuer: credentialIssuerUrl,
      credential_configuration_ids: [
        params.format === 'sd_jwt_vc' ? 'sd_jwt_national_id' : 'w3c_ldp_national_id',
      ],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': preAuthorizedCode,
          user_pin_required: false,
        },
      },
    };

    const offerUri = `openid-credential-offer://?credential_offer=${encodeURIComponent(
      JSON.stringify(credentialOfferPayload)
    )}`;

    const event = this.buildEvent(
      'OFFER_ISSUANCE',
      'OPENID4VCI',
      'ISSUER',
      'WALLET',
      'CREDENTIAL_OFFER_GENERATED',
      `Mock OpenID4VCI Issuer generated credential offer for format: ${params.format}`,
      {
        credential_offer: credentialOfferPayload,
        offer_uri: offerUri,
      },
      200,
      Date.now() - startTime
    );

    return {
      offerUri,
      preAuthorizedCode,
      issuerEndpoint: credentialIssuerUrl,
      metadata: {
        protocol: 'OpenID4VCI-draft13',
        issuerDid: 'did:key:z6MkuV4rZ59s7TMockIssuerKey',
      },
      protocolEvents: [event],
    };
  }

  public async deliverCredential(params: DeliverCredentialParams): Promise<DeliverCredentialResult> {
    const startTime = Date.now();
    let credential: Record<string, unknown> | string;

    if (params.format === 'sd_jwt_vc') {
      credential =
        'eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3Nkand0In0.eyJpc3MiOiJodHRwczovL21vY2staXNzdWVyLnBsYXlncm91bmQubG9jYWwiLCJzdWIiOiJkaWQ6a2V5Ono2TWtob2xkZXIiLCJfc2QiOlsiNHFmclhKUlZZT3VlIl19.signature_simulated~WyJzYWx0IiwiZmlyc3RfbmFtZSIsIkFsaWNlIl0~';
    } else {
      credential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://schema.org',
        ],
        id: `urn:uuid:${uuidv4()}`,
        type: ['VerifiableCredential', 'IdentityCredential'],
        issuer: {
          id: 'did:key:z6MkuV4rZ59s7TMockIssuerKey',
          name: 'Playground Mock Identity Authority',
        },
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: 'did:key:z6MkHolderKeySubject123',
          fullName: 'Alice Developer',
          country: 'IN',
          documentType: 'NATIONAL_ID',
        },
        proof: {
          type: 'Ed25519Signature2020',
          created: new Date().toISOString(),
          verificationMethod: 'did:key:z6MkuV4rZ59s7TMockIssuerKey#z6MkuV4rZ59s7TMockIssuerKey',
          proofPurpose: 'assertionMethod',
          jws: 'eyJhbGciOiJFZERTQSI...proof_payload_simulated',
        },
      };
    }

    const event = this.buildEvent(
      'OFFER_ISSUANCE',
      'OPENID4VCI',
      'ISSUER',
      'WALLET',
      'CREDENTIAL_RESPONSE',
      `Mock OpenID4VCI Issuer delivered credential format: ${params.format}`,
      {
        format: params.format,
        credential,
      },
      200,
      Date.now() - startTime
    );

    return {
      credential,
      format: params.format,
      protocolEvents: [event],
    };
  }
}
