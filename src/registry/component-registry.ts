import {
  ComponentMetadata,
  CredentialFormat,
} from '../types/domain.js';
import { MatrixCell } from '../types/api.js';
import { config } from '../config/env.js';

export class ComponentRegistry {
  private static issuers: Map<string, ComponentMetadata> = new Map([
    [
      'inji-certify',
      {
        id: 'inji-certify',
        name: 'Inji Certify (MOSIP OpenID4VCI)',
        role: 'issuer',
        isMock: false,
        version: '0.10.x',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc', 'mso_mdoc'],
        supportedProtocols: ['OpenID4VCI-draft13'],
        status: 'ready',
        description: 'MOSIP Inji Certify credential issuance service with configurable plugins.',
        endpointUrl: config.injiCertifyBaseUrl,
      },
    ],
    [
      'mock-openid4vci',
      {
        id: 'mock-openid4vci',
        name: 'Mock OpenID4VCI Reference Issuer',
        role: 'issuer',
        isMock: true,
        version: '1.0.0',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc'],
        supportedProtocols: ['OpenID4VCI-draft13'],
        status: 'ready',
        description: 'Lightweight standards-compliant OpenID4VCI issuer simulator for rapid baseline testing.',
      },
    ],
  ]);

  private static wallets: Map<string, ComponentMetadata> = new Map([
    [
      'inji-web',
      {
        id: 'inji-web',
        name: 'Inji Web (Browser Holder)',
        role: 'wallet',
        isMock: false,
        version: '0.10.x',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc'],
        supportedProtocols: ['OpenID4VCI-draft13', 'OpenID4VP-draft21'],
        status: 'ready',
        description: 'Browser-based Inji credential holder backed by Mimoto BFF.',
        endpointUrl: config.mimotoWalletBaseUrl,
      },
    ],
    [
      'inji-wallet-mobile',
      {
        id: 'inji-wallet-mobile',
        name: 'Inji Wallet Mobile (App)',
        role: 'wallet',
        isMock: false,
        version: '0.10.x',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc', 'mso_mdoc'],
        supportedProtocols: ['OpenID4VCI-draft13', 'OpenID4VP-draft21', 'PixelPass-QR'],
        status: 'ready',
        description: 'React Native Inji Wallet with QR code scanning and offline BLE transfer (Tuvali).',
      },
    ],
    [
      'simulated-wallet',
      {
        id: 'simulated-wallet',
        name: 'Simulated Automated Holder',
        role: 'wallet',
        isMock: true,
        version: '1.0.0',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc', 'mso_mdoc'],
        supportedProtocols: ['OpenID4VCI-draft13', 'OpenID4VP-draft21'],
        status: 'ready',
        description: 'Headless automated wallet agent for continuous automated test pipeline verification.',
      },
    ],
  ]);

  private static verifiers: Map<string, ComponentMetadata> = new Map([
    [
      'inji-verify',
      {
        id: 'inji-verify',
        name: 'Inji Verify (MOSIP OpenID4VP)',
        role: 'verifier',
        isMock: false,
        version: '0.10.x',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc'],
        supportedProtocols: ['OpenID4VP-draft21'],
        status: 'ready',
        description: 'MOSIP Inji Verify relying party service and SDK for authoritative VC verification.',
        endpointUrl: config.injiVerifyBaseUrl,
      },
    ],
    [
      'mock-openid4vp',
      {
        id: 'mock-openid4vp',
        name: 'Mock OpenID4VP Reference Verifier',
        role: 'verifier',
        isMock: true,
        version: '1.0.0',
        supportedFormats: ['w3c_vc_jsonld', 'sd_jwt_vc'],
        supportedProtocols: ['OpenID4VP-draft21'],
        status: 'ready',
        description: 'Mock OpenID4VP Relying Party simulator performing JSON-LD and SD-JWT validation.',
      },
    ],
  ]);

  public static getIssuers(): ComponentMetadata[] {
    return Array.from(this.issuers.values());
  }

  public static getWallets(): ComponentMetadata[] {
    return Array.from(this.wallets.values());
  }

  public static getVerifiers(): ComponentMetadata[] {
    return Array.from(this.verifiers.values());
  }

  public static getIssuer(id: string): ComponentMetadata | undefined {
    return this.issuers.get(id);
  }

  public static getWallet(id: string): ComponentMetadata | undefined {
    return this.wallets.get(id);
  }

  public static getVerifier(id: string): ComponentMetadata | undefined {
    return this.verifiers.get(id);
  }

  public static getFormats(): {
    id: CredentialFormat;
    name: string;
    description: string;
    standardsRef: string;
  }[] {
    return [
      {
        id: 'w3c_vc_jsonld',
        name: 'W3C VC 1.1/2.0 (JSON-LD)',
        description: 'W3C Verifiable Credentials Data Model with Ed25519Signature2020 / RSA proofs.',
        standardsRef: 'https://www.w3.org/TR/vc-data-model-2.0/',
      },
      {
        id: 'sd_jwt_vc',
        name: 'IETF SD-JWT VC',
        description: 'Selective Disclosure for JWTs (SD-JWT) verifiable credential profile.',
        standardsRef: 'https://datatracker.ietf.org/doc/draft-ietf-oauth-sd-jwt-vc/',
      },
      {
        id: 'mso_mdoc',
        name: 'mDoc / mDL (ISO/IEC 18013-5)',
        description: 'Mobile Driving License and mobile document format with CBOR/COSE encoding.',
        standardsRef: 'https://www.iso.org/standard/69084.html',
      },
    ];
  }

  public static getCompatibilityMatrix(): MatrixCell[] {
    const cells: MatrixCell[] = [];
    const formats: CredentialFormat[] = ['w3c_vc_jsonld', 'sd_jwt_vc', 'mso_mdoc'];

    for (const issuer of this.getIssuers()) {
      for (const wallet of this.getWallets()) {
        for (const verifier of this.getVerifiers()) {
          for (const format of formats) {
            const issuerSupports = issuer.supportedFormats.includes(format);
            const walletSupports = wallet.supportedFormats.includes(format);
            const verifierSupports = verifier.supportedFormats.includes(format);

            if (issuerSupports && walletSupports && verifierSupports) {
              if (issuer.isMock || wallet.isMock || verifier.isMock) {
                cells.push({
                  issuerId: issuer.id,
                  walletId: wallet.id,
                  verifierId: verifier.id,
                  format,
                  status: 'SUPPORTED',
                  notes: 'Fully supported and automated via reference/mock harness.',
                });
              } else {
                cells.push({
                  issuerId: issuer.id,
                  walletId: wallet.id,
                  verifierId: verifier.id,
                  format,
                  status: 'PENDING_INTEGRATION',
                  notes: 'Live Inji stack integration baseline with Person 1 endpoints.',
                });
              }
            } else {
              cells.push({
                issuerId: issuer.id,
                walletId: wallet.id,
                verifierId: verifier.id,
                format,
                status: 'UNSUPPORTED',
                notes: `Format ${format} not supported by all 3 selected components.`,
              });
            }
          }
        }
      }
    }

    return cells;
  }
}
