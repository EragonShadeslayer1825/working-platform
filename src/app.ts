import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { registryRouter } from './routes/registry.routes.js';
import { createRunsRouter } from './routes/runs.routes.js';
import { createCallbacksRouter } from './routes/verifier-callbacks.routes.js';
import { FileTestRunRepository } from './storage/file-repo.js';
import { TestOrchestrationEngine } from './engine/test-runner.js';

export function createApp(): Express {
  const app = express();

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: '*', // Allows local React Vite dev server
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request Logging
  app.use(requestLogger);

  // Dependencies: File-backed persistence for test runs history
  const repository = new FileTestRunRepository();
  const engine = new TestOrchestrationEngine(repository);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'HEALTHY',
      service: 'inji-interop-playground-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // API Routes
  app.use('/api/v1/registry', registryRouter);
  app.use('/api/v1/runs', createRunsRouter(engine, repository));
  app.use('/api/v1/callbacks', createCallbacksRouter(repository));

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
