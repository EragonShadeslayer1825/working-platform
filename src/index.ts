import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Inji Interoperability Playground Backend Orchestrator`);
  console.log(`📡 Listening on http://localhost:${config.port}`);
  console.log(`⚙️  Environment: ${config.nodeEnv}`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated.');
  });
});
