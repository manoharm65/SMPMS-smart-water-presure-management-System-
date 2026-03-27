import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 * Logs full error details server-side but only returns a safe error message to the client.
 * Never leaks stack traces, file paths, or internal implementation details.
 */
export function globalErrorHandler(
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error for debugging (server-side only)
  console.error('[Error]', err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Determine status — default to 500
  const status = err.status || err.statusCode || 500;

  // Safe error response — no stack traces or internal paths
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

/**
 * Not-found handler — must be registered after all routes.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

/**
 * Creates an HTTP error with a status code.
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
