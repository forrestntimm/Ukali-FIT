export function resolveAuthToken(localToken, sessionToken) {
  const normalizedLocal = (localToken || "").trim();
  if (normalizedLocal) return normalizedLocal;

  const normalizedSession = (sessionToken || "").trim();
  if (normalizedSession) return normalizedSession;

  return null;
}
