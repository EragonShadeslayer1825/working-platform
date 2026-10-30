import { Router, Request, Response, NextFunction } from 'express';
import { ITestRunRepository } from '../storage/repository.js';
import { ProtocolEventBus } from '../engine/event-bus.js';

export function createCallbacksRouter(repo: ITestRunRepository): Router {
  const router = Router();

  /**
   * POST /api/v1/callbacks/verifier/:runId
   * Webhook callback receiver for Inji Verify or external verifiers.
   */
  router.post('/verifier/:runId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const callbackPayload = req.body;

      const run = await repo.getRun(runId);
      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      const event = ProtocolEventBus.createEvent({
        runId,
        stage: 'AUTHORITATIVE_VERIFICATION',
        protocol: 'OPENID4VP',
        source: 'VERIFIER',
        destination: 'ORCHESTRATOR',
        action: 'VERIFIER_WEBHOOK_RECEIVED',
        payloadSummary: `Verifier posted callback for run ${runId}`,
        rawPayload: callbackPayload,
        httpStatus: 200,
      });

      await repo.appendEvents(runId, [event]);

      res.status(200).json({ status: 'ACKNOWLEDGED', runId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
