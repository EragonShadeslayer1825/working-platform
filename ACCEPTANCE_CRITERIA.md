# Acceptance Criteria

## A run passes when
- A real credential is issued by the selected issuer and held in the selected wallet.
- The wallet presents it through the selected OpenID4VP flow.
- Inji Verify returns an authoritative result for that presentation.
- The expected credential type matches the verifier request.
- The UI shows the result and a sanitized timeline of real exchanges.

## A run does not pass when
- Only an HTTP 200, redirect, QR scan, or VP-received transaction ID is available.
- The verifier result is missing, pending, or cannot be tied to this run.
- A transport error is presented as a credential failure or success.

## Every report records
- Issuer, wallet, verifier, exact versions, environment, and credential format.
- Final outcome: PASS, INVALID, EXPIRED, PENDING, or ERROR.
- Relevant request/response evidence and error details, with secrets and personal data removed.
- Untested combinations and confirmed compatibility blockers.

## Format coverage
The target is two credential formats. Prove one complete flow first; report the second format as tested or blocked with evidence.