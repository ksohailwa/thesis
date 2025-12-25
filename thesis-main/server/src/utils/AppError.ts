/**
 * Standard application error class for consistent error handling.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isDev: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      error: this.message,
      ...(this.isDev && { stack: this.stack }),
    };
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
