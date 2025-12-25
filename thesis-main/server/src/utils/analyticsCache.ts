const CACHE_TTL_MS = 30_000;
const analyticsCache = new Map<string, { expires: number; value: unknown }>();

export function getAnalyticsCache<T = unknown>(key: string): T | null {
  const entry = analyticsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    analyticsCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setAnalyticsCache<T = unknown>(key: string, value: T) {
  analyticsCache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

export function clearAnalyticsCache() {
  analyticsCache.clear();
}
