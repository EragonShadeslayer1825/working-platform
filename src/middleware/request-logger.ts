import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${method} ${originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });

  next();
}
