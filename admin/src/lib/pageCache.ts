export type PageCacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

const memoryCache = new Map<string, PageCacheEnvelope<unknown>>();

function hasStorage() {
  return typeof window !== "undefined";
}

export function readPageCache<T>(key: string): PageCacheEnvelope<T> | null {
  const inMemory = memoryCache.get(key) as PageCacheEnvelope<T> | undefined;
  if (inMemory) return inMemory;
  if (!hasStorage()) return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PageCacheEnvelope<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed)) {
      return null;
    }
    memoryCache.set(key, parsed as PageCacheEnvelope<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

export function writePageCache<T>(key: string, data: T) {
  const envelope: PageCacheEnvelope<T> = { savedAt: Date.now(), data };
  memoryCache.set(key, envelope as PageCacheEnvelope<unknown>);
  if (!hasStorage()) return;
  sessionStorage.setItem(key, JSON.stringify(envelope));
}

export function clearPageCache(key: string) {
  memoryCache.delete(key);
  if (!hasStorage()) return;
  sessionStorage.removeItem(key);
}

export function peekPageCache<T>(key: string): PageCacheEnvelope<T> | null {
  return (memoryCache.get(key) as PageCacheEnvelope<T> | undefined) || null;
}

export function isPageCacheFresh(savedAt: number, maxAgeMs: number) {
  return Date.now() - savedAt <= maxAgeMs;
}
