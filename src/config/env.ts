import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:5173', 'http://localhost:3000'],
  
  // Real Inji service endpoints (to be provided/configured by Person 1)
  injiCertifyBaseUrl: process.env.INJI_CERTIFY_BASE_URL || 'http://localhost:8080/certify',
  mimotoWalletBaseUrl: process.env.MIMOTO_WALLET_BASE_URL || 'http://localhost:8081/mimoto',
  injiVerifyBaseUrl: process.env.INJI_VERIFY_BASE_URL || 'http://localhost:8082/verify',
  
  // Timeouts
  stageTimeoutMs: parseInt(process.env.STAGE_TIMEOUT_MS || '30000', 10),
  testRunTotalTimeoutMs: parseInt(process.env.RUN_TIMEOUT_MS || '120000', 10),
};
