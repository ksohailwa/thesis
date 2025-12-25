/**
 * Standard API response structures for consistency across endpoints.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiSuccessResponse<T = any> {
  ok: true;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  ok: false;
  error: string;
  details?: Record<string, unknown>;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Helper to create consistent success responses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSuccessResponse<T = any>(
  data?: T,
  message?: string
): ApiSuccessResponse<T> {
  return {
    ok: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  };
}

/**
 * Helper to create consistent error responses.
 */
export function createErrorResponse(
  error: string,
  details?: Record<string, unknown>
): ApiErrorResponse {
  return {
    ok: false,
    error,
    ...(details && { details }),
  };
}
