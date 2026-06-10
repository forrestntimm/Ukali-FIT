let cachedAccessToken: string | null = null;

export function getCachedAccessToken() {
  return cachedAccessToken;
}

export function setCachedAccessToken(token: string | null | undefined) {
  cachedAccessToken = token || null;
}

export function clearCachedAccessToken() {
  cachedAccessToken = null;
}
