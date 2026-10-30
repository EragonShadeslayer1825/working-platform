import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse } from '../types/api.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err);

  const statusCode = (err as { status?: number }).status || 500;
  const code = (err as { code?: string }).code || 'INTERNAL_SERVER_ERROR';

  const response: ApiErrorResponse = {
    error: {
      code,
      message: err.message || 'An unexpected internal error occurred',
      details: (err as { details?: unknown }).details,
      timestamp: new Date().toISOString(),
    },
  };

  res.status(statusCode).json(response);
}
