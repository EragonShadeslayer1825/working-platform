import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SimulatedWalletAdapter } from '../src/adapters/wallet/simulated-wallet.adapter.js';
import { MockIssuerAdapter } from '../src/adapters/issuer/mock-issuer.adapter.js';
import { MockVerifierAdapter } from '../src/adapters/verifier/mock-verifier.adapter.js';
import { CredentialFormat } from '../src/types/domain.js';

describe('SimulatedWalletAdapter Exact Credential Data Flow', () => {
  it('stores the exact issued credential and presents it in the verifiable presentation', async () => {
    const runId = 'test-flow-exact-run';
    const format: CredentialFormat = 'w3c_vc_jsonld';

    const issuer = new MockIssuerAdapter();
    const wallet = new SimulatedWalletAdapter();
    const verifier = new MockVerifierAdapter();

    // 1. Issuer produces credential offer & credential
    const offerResult = await issuer.initiateIssuance({
      runId,
      format,
    });
    const deliverResult = await issuer.deliverCredential({
      runId,
      format,
      accessToken: offerResult.preAuthorizedCode || 'simulated-token',
    });

    const issuedCredential = deliverResult.credential as Record<string, unknown>;
    assert.ok(issuedCredential, 'Issuer must return a credential');
    const issuedCredentialId = issuedCredential.id;
    assert.ok(issuedCredentialId, 'Issued credential must have an id');

    // 2. Wallet accepts offer and stores the EXACT credential
    await wallet.acceptOffer({
      runId,
      format,
      offerResult,
      issuedCredential,
      issuer,
    });

    // Verify stored credential matches
    const held = wallet.getHeldCredential(runId);
    assert.ok(held, 'Wallet must hold the stored credential');
    const heldCred = held.credential as Record<string, unknown>;
    assert.equal(heldCred.id, issuedCredentialId, 'Held credential ID must match issued credential ID');
    assert.deepEqual(heldCred, issuedCredential, 'Held credential must be identical to issued credential');

    // 3. Verifier generates presentation request
    const presReq = await verifier.createPresentationRequest({
      runId,
      format,
      callbackUrl: 'http://localhost:4000/api/v1/callbacks/verifier/' + runId,
    });

    // 4. Wallet creates presentation using the stored credential
    const presSubmission = await wallet.generatePresentation({
      runId,
      presentationRequestUri: presReq.requestUri,
      presentationDefinition: presReq.presentationDefinition,
    });

    // 5. Authoritative verification evaluates the presentation containing the stored credential
    const verifyResult = await verifier.evaluateAuthoritativeResult({
      runId,
      vpToken: presSubmission.vpToken,
      presentationSubmission: presSubmission.presentationSubmission,
      nonce: presReq.nonce,
    });

    assert.equal(verifyResult.overallStatus, 'VALID', 'Presentation of genuine issued credential must be VALID');
    assert.equal(verifyResult.isSignatureValid, true, 'Signature of genuine issued credential must be valid');
    assert.equal(verifyResult.isIssuerTrusted, true, 'Issuer must be trusted');
    assert.equal(verifyResult.isExpired, false, 'Credential must not be expired');
    assert.equal(verifyResult.credentialType, 'IdentityCredential', 'Credential type must match issued credential');
  });

  it('applies signature corruption directly to the stored credential', async () => {
    const runId = 'test-flow-tamper-sig';
    const format: CredentialFormat = 'w3c_vc_jsonld';

    const issuer = new MockIssuerAdapter();
    const wallet = new SimulatedWalletAdapter();
    const verifier = new MockVerifierAdapter();

    const offerResult = await issuer.initiateIssuance({ runId, format });
    const deliverResult = await issuer.deliverCredential({
      runId,
      format,
      accessToken: offerResult.preAuthorizedCode || 'simulated-token',
    });

    await wallet.acceptOffer({
      runId,
      format,
      offerResult,
      issuedCredential: deliverResult.credential as Record<string, unknown>,
      issuer,
    });

    const presReq = await verifier.createPresentationRequest({
      runId,
      format,
      callbackUrl: 'http://localhost:4000/callback',
    });
    const presSubmission = await wallet.generatePresentation({
      runId,
      presentationRequestUri: presReq.requestUri,
      presentationDefinition: presReq.presentationDefinition,
      tamper: { corruptSignature: true },
    });

    const verifyResult = await verifier.evaluateAuthoritativeResult({
      runId,
      vpToken: presSubmission.vpToken,
      presentationSubmission: presSubmission.presentationSubmission,
      nonce: presReq.nonce,
    });

    assert.equal(verifyResult.overallStatus, 'INVALID');
    assert.equal(verifyResult.isSignatureValid, false, 'Tampered signature must be invalid');
  });

  it('applies expiration tampering directly to the stored credential', async () => {
    const runId = 'test-flow-tamper-exp';
    const format: CredentialFormat = 'w3c_vc_jsonld';

    const issuer = new MockIssuerAdapter();
    const wallet = new SimulatedWalletAdapter();
    const verifier = new MockVerifierAdapter();

    const offerResult = await issuer.initiateIssuance({ runId, format });
    const deliverResult = await issuer.deliverCredential({
      runId,
      format,
      accessToken: offerResult.preAuthorizedCode || 'simulated-token',
    });

    await wallet.acceptOffer({
      runId,
      format,
      offerResult,
      issuedCredential: deliverResult.credential as Record<string, unknown>,
      issuer,
    });

    const presReq = await verifier.createPresentationRequest({
      runId,
      format,
      callbackUrl: 'http://localhost:4000/callback',
    });
    const presSubmission = await wallet.generatePresentation({
      runId,
      presentationRequestUri: presReq.requestUri,
      presentationDefinition: presReq.presentationDefinition,
      tamper: { forceExpired: true },
    });

    const verifyResult = await verifier.evaluateAuthoritativeResult({
      runId,
      vpToken: presSubmission.vpToken,
      presentationSubmission: presSubmission.presentationSubmission,
      nonce: presReq.nonce,
    });

    assert.equal(verifyResult.overallStatus, 'EXPIRED');
    assert.equal(verifyResult.isExpired, true, 'Credential must be expired');
  });
});
