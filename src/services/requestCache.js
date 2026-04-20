const responseCache = new Map();
const inflightCache = new Map();

function hasValidEntry(entry) {
  return Boolean(entry) && entry.expiresAt > Date.now();
}

export async function cachedQuery(key, queryFn, ttlMs = 15000) {
  if (!key || typeof queryFn !== 'function') {
    return queryFn();
  }

  const cached = responseCache.get(key);
  if (hasValidEntry(cached)) {
    return cached.value;
  }

  if (inflightCache.has(key)) {
    return inflightCache.get(key);
  }

  const promise = (async () => {
    try {
      const result = await queryFn();
      if (!result?.error) {
        responseCache.set(key, {
          value: result,
          expiresAt: Date.now() + Math.max(500, Number(ttlMs) || 15000),
        });
      } else {
        responseCache.delete(key);
      }
      return result;
    } finally {
      inflightCache.delete(key);
    }
  })();

  inflightCache.set(key, promise);
  return promise;
}

export function getCachedQueryValue(key) {
  if (!key) return null;
  const cached = responseCache.get(String(key));
  if (!hasValidEntry(cached)) return null;
  return cached.value;
}

export function invalidateCache(keyPrefix) {
  if (!keyPrefix) return;
  const prefix = String(keyPrefix);
  for (const key of responseCache.keys()) {
    if (String(key).startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
  for (const key of inflightCache.keys()) {
    if (String(key).startsWith(prefix)) {
      inflightCache.delete(key);
    }
  }
}

export function invalidateAllCache() {
  responseCache.clear();
  inflightCache.clear();
}
