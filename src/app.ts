import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { requestLogger } from './middleware/request-logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { registryRouter } from './routes/registry.routes.js';
import { createRunsRouter } from './routes/runs.routes.js';
import { createPlaygroundRunsRouter } from './routes/playground-runs.routes.js';
import { createCallbacksRouter } from './routes/verifier-callbacks.routes.js';
import { FileTestRunRepository } from './storage/file-repo.js';
import { TestOrchestrationEngine } from './engine/test-runner.js';

import { ITestRunRepository } from './storage/repository.js';

export function createApp(customRepo?: ITestRunRepository, customEngine?: TestOrchestrationEngine): Express {
  const app = express();

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like curl, Postman, server-to-server, or mobile requests)
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    })
  );

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request Logging
  app.use(requestLogger);

  // Dependencies: File-backed persistence for test runs history or custom repository
  const repository = customRepo || new FileTestRunRepository();
  const engine = customEngine || new TestOrchestrationEngine(repository);

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
  app.use('/api/runs', createPlaygroundRunsRouter(engine, repository));
  app.use('/api/v1/callbacks', createCallbacksRouter(repository));

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
