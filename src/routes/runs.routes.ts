import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TestOrchestrationEngine } from '../engine/test-runner.js';
import { ITestRunRepository } from '../storage/repository.js';
import {
  CreateTestRunResponse,
  GetProtocolEventsResponse,
  GetTestRunResponse,
  GetTestRunsResponse,
} from '../types/api.js';

const CreateRunSchema = z.object({
  issuerId: z.string().min(1),
  walletId: z.string().min(1),
  verifierId: z.string().min(1),
  format: z.enum(['w3c_vc_jsonld', 'sd_jwt_vc', 'mso_mdoc']),
  proofType: z.enum(['Ed25519Signature2020', 'JsonWebSignature2020', 'ES256', 'RSA']).optional(),
  interactiveMode: z.boolean().optional(),
  mockTamper: z
    .object({
      corruptSignature: z.boolean().optional(),
      forceExpired: z.boolean().optional(),
      alterClaims: z.boolean().optional(),
    })
    .optional(),
});

export function createRunsRouter(
  engine: TestOrchestrationEngine,
  repo: ITestRunRepository
): Router {
  const router = Router();

  /**
   * POST /api/v1/runs
   * Initiates a new interoperability test run.
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseResult = CreateRunSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid test run configuration',
            details: parseResult.error.format(),
            timestamp: new Date().toISOString(),
          },
        });
      }

      const run = await engine.createAndStartRun(parseResult.data);

      const response: CreateTestRunResponse = {
        runId: run.runId,
        status: run.status,
        currentStage: run.currentStage,
        createdAt: run.createdAt,
        message: 'Test run initialized successfully',
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/runs
   * Retrieves list of all test runs for history view.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 50;
      const runs = await repo.listRuns(limit);

      const response: GetTestRunsResponse = {
        total: runs.length,
        runs: runs.map((r) => ({
          runId: r.runId,
          status: r.status,
          currentStage: r.currentStage,
          config: r.config,
          createdAt: r.createdAt,
          completedAt: r.completedAt,
          verdict: r.report?.verdict,
          durationMs: r.report?.totalDurationMs,
        })),
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/runs/:id
   * Polls or inspects current state of a specific test run.
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const run = await repo.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Test run ${req.params.id} does not exist`,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const response: GetTestRunResponse = {
        runId: run.runId,
        status: run.status,
        currentStage: run.currentStage,
        config: run.config,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        completedAt: run.completedAt,
        stages: run.stages,
        eventsCount: run.events.length,
        qrPayload: run.qrPayload,
        report: run.report,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/runs/:id/events
   * Protocol inspector panel endpoint returning raw exchanged payloads.
   */
  router.get('/:id/events', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const run = await repo.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({
          error: {
            code: 'RUN_NOT_FOUND',
            message: `Test run ${req.params.id} does not exist`,
            timestamp: new Date().toISOString(),
          },
        });
      }

      const response: GetProtocolEventsResponse = {
        runId: run.runId,
        totalEvents: run.events.length,
        events: run.events,
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
