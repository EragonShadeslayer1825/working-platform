import { v4 as uuidv4 } from 'uuid';
import { BaseAdapter } from '../base.js';
import {
  CreatePresentationRequestParams,
  EvaluateResultParams,
  IVerifierAdapter,
  PresentationRequestResult,
} from '../../types/adapters.js';
import { AuthoritativeVerificationEvidence } from '../../types/domain.js';

export class MockVerifierAdapter extends BaseAdapter implements IVerifierAdapter {
  public readonly id = 'mock-openid4vp';
  public readonly name = 'Mock OpenID4VP Reference Verifier';
  public readonly isMock = true;

  public async createPresentationRequest(
    params: CreatePresentationRequestParams
  ): Promise<PresentationRequestResult> {
    const startTime = Date.now();
    const nonce = uuidv4();
    const clientId = 'https://mock-verifier.playground.local/rp';

    const presentationDefinition = {
      id: `pres-def-${uuidv4()}`,
      input_descriptors: [
        {
          id: 'identity_credential',
          name: 'Identity Verification Requirement',
          purpose: 'Verify holder identity for playground interoperability assessment',
          schema: [
            {
              uri: 'https://schema.org/IdentityCredential',
            },
          ],
          constraints: {
            fields: [
              {
                path: ['$.credentialSubject.fullName'],
                filter: { type: 'string' },
              },
            ],
          },
        },
      ],
    };

    const requestUri = `openid4vp://?client_id=${encodeURIComponent(
      clientId
    )}&response_uri=${encodeURIComponent(params.callbackUrl)}&nonce=${nonce}`;

    const event = this.buildEvent(
      'PRESENTATION_REQUEST',
      'OPENID4VP',
      'VERIFIER',
      'WALLET',
      'AUTH_REQUEST_CREATED',
      `Mock OpenID4VP Verifier created presentation request for format: ${params.format}`,
      {
        client_id: clientId,
        presentation_definition: presentationDefinition,
        request_uri: requestUri,
        nonce,
      },
      200,
      Date.now() - startTime
    );

    return {
      requestUri,
      presentationDefinition,
      nonce,
      clientId,
      protocolEvents: [event],
    };
  }

  public async evaluateAuthoritativeResult(
    params: EvaluateResultParams
  ): Promise<AuthoritativeVerificationEvidence> {
    const startTime = Date.now();
    const vp = params.vpToken as Record<string, unknown>;
    const credentials = (vp?.verifiableCredential as Array<Record<string, unknown>>) || [];
    const firstCred = credentials[0] || {};
    const proof = (firstCred?.proof as Record<string, unknown>) || {};
    const proofValue = String(proof?.proofValue || proof?.jws || '');

    // Cryptographic inspection
    const isCorrupted = proofValue.includes('CORRUPTED') || proofValue === '';
    const expDate = firstCred?.expirationDate ? new Date(firstCred.expirationDate as string) : null;
    const isExpired = expDate ? expDate.getTime() < Date.now() : false;
    const issuer = String((firstCred?.issuer as Record<string, unknown>)?.id || firstCred?.issuer || '');
    const isIssuerTrusted = issuer.includes('did:key') || issuer.includes('did:mosip');

    let overallStatus: AuthoritativeVerificationEvidence['overallStatus'] = 'VALID';
    if (isCorrupted) {
      overallStatus = 'INVALID';
    } else if (isExpired) {
      overallStatus = 'EXPIRED';
    } else if (!isIssuerTrusted) {
      overallStatus = 'UNTRUSTED_ISSUER';
    }

    const rawResponse = {
      verification_status: overallStatus,
      cryptographic_validity: !isCorrupted,
      expiration_validity: !isExpired,
      trust_chain_validity: isIssuerTrusted,
      checked_at: new Date().toISOString(),
      nonce_match: true,
    };

    return {
      verifiedAt: new Date().toISOString(),
      verifierComponentId: this.id,
      overallStatus,
      isSignatureValid: !isCorrupted,
      isExpired,
      isRevoked: false,
      isIssuerTrusted,
      claimsValidated: (firstCred.credentialSubject as Record<string, unknown>) || {},
      verifierRawResponse: rawResponse,
    };
  }
}
