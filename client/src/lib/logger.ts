/**
 * Client-side logger for production-safe logging.
 * Respects environment and can integrate with error tracking services.
 */

interface LogContext {
  [key: string]: unknown;
}

class ClientLogger {
  private isDevelopment = import.meta.env.MODE === 'development';

  debug(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, context);
    }
  }

  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.info(`[INFO] ${message}`, context);
    }
  }

  warn(message: string, context?: LogContext) {
    console.warn(`[WARN] ${message}`, context);
  }

  error(message: string, error?: Error | unknown, context?: LogContext) {
    console.error(`[ERROR] ${message}`, error, context);
    // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
  }
}

export const logger = new ClientLogger();
