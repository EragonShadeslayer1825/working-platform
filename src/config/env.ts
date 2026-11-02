import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:5173', 'http://localhost:3000'],
  
  // Real Inji service endpoints
  injiCertifyBaseUrl: process.env.INJI_CERTIFY_BASE_URL || 'http://localhost:8080/certify',
  mimotoWalletBaseUrl: process.env.MIMOTO_WALLET_BASE_URL || 'http://localhost:8081/mimoto',
  injiVerifyBaseUrl: process.env.INJI_VERIFY_BASE_URL || 'http://localhost:8082/verify',
  
  // Configurable external callback destination (for remote verifier or Docker container)
  callbackBaseUrl:
    process.env.CALLBACK_BASE_URL ||
    process.env.BACKEND_PUBLIC_URL ||
    process.env.PLAYGROUND_BACKEND_URL ||
    `http://localhost:${process.env.PORT || '4000'}`,

  // Timeouts
  stageTimeoutMs: parseInt(process.env.STAGE_TIMEOUT_MS || '30000', 10),
  testRunTotalTimeoutMs: parseInt(process.env.RUN_TIMEOUT_MS || '120000', 10),
};
