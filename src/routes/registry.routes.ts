import { Router, Request, Response } from 'express';
import { ComponentRegistry } from '../registry/component-registry.js';
import { ComponentRegistryResponse, CompatibilityMatrixResponse } from '../types/api.js';

export const registryRouter = Router();

/**
 * GET /api/v1/registry/components
 * Returns all registered Issuers, Wallets, Verifiers, and supported Credential Formats.
 */
registryRouter.get('/components', (_req: Request, res: Response) => {
  const response: ComponentRegistryResponse = {
    issuers: ComponentRegistry.getIssuers(),
    wallets: ComponentRegistry.getWallets(),
    verifiers: ComponentRegistry.getVerifiers(),
    formats: ComponentRegistry.getFormats(),
  };

  res.json(response);
});

/**
 * GET /api/v1/registry/matrix
 * Returns the 3-dimensional compatibility matrix showing status of each combination.
 */
registryRouter.get('/matrix', (_req: Request, res: Response) => {
  const response: CompatibilityMatrixResponse = {
    cells: ComponentRegistry.getCompatibilityMatrix(),
    lastUpdated: new Date().toISOString(),
  };

  res.json(response);
});

/**
 * GET /api/v1/registry/formats
 * Returns available credential formats.
 */
registryRouter.get('/formats', (_req: Request, res: Response) => {
  res.json({ formats: ComponentRegistry.getFormats() });
});
