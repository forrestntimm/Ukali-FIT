const DASHBOARD_REDIRECT_ROUTES = new Set(["/login", "/auth/callback"]);

export function shouldRouteToDashboardAfterAuth(pathname) {
  if (!pathname) return false;
  return DASHBOARD_REDIRECT_ROUTES.has(pathname);
}
