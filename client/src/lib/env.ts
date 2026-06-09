/**
 * Environment variable validation
 * Ensures required env vars are present at build/runtime
 */

interface Env {
  apiBaseUrl: string;
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

function getEnv(): Env {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || (
    import.meta.env.DEV ? 'http://localhost:4000' : (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  );
  const nodeEnv = import.meta.env.MODE || 'development';

  if (nodeEnv === 'production' && !import.meta.env.VITE_API_BASE_URL) {
    console.warn('VITE_API_BASE_URL not set, using same-origin base:', apiBaseUrl);
  }

  return {
    apiBaseUrl,
    nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
  };
}

export const env = getEnv();

if (env.isDevelopment) {
  console.log('Environment configuration:', {
    apiBaseUrl: env.apiBaseUrl,
    nodeEnv: env.nodeEnv,
  });
}
