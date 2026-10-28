# Integration Baseline

Fill in a row only after checking the selected release’s official docs/config and, where possible, a real run. Never commit secrets.

| Component | Repository | Exact tag/commit | Environment | Endpoint/config source | Checked by | Status |
|---|---|---|---|---|---|---|
| Issuer — Inji Certify | https://github.com/inji/inji-certify | TBD | TBD | TBD | Manay | Not checked |
| Wallet — Inji Web or Mobile | https://github.com/inji/inji-web or https://github.com/inji/inji-wallet | TBD | TBD | TBD | Anav + Manay | First wallet: Inji Web.
First smoke-test environment: MOSIP Collab, if team access is available.
Fallback: Inji Mobile if the Web issuance flow is blocked.
Reproducible deliverable: local Compose setup after the flow is proven. |
| Wallet backend — Mimoto | https://github.com/inji/mimoto | TBD | TBD | TBD | Manay | Not checked |
| Verifier — Inji Verify | https://github.com/inji/inji-verify | TBD | TBD | TBD | Dhyan + Manay | Not checked |

## Flow checks

- First credential format: W3C VC 1.1 JSON-LD, pending compatibility confirmation.
- Issuance flow: TBD after checking the selected Certify and wallet releases.
- Presentation flow: OpenID4VP, exact version TBD.
- Verification result route and schema: TBD from the selected Inji Verify release.
- Environment used for each successful run: record in the run report.