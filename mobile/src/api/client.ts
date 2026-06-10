import axios from "axios";
import { supabase } from "../lib/supabase";
import { RUNTIME_CONFIG } from "../config/runtimeConfig";
import { safeGetSession } from "../lib/sessionGuard";
import { getCachedAccessToken, setCachedAccessToken } from "../lib/authTokenCache";

function resolveDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export const api = axios.create({
  baseURL: RUNTIME_CONFIG.apiUrl || "http://localhost:4000/api"
});

api.interceptors.request.use(async (config) => {
  const deviceTimeZone = resolveDeviceTimeZone();
  config.headers = {
    ...(config.headers || {}),
    "x-ukali-client": "mobile-app",
    ...(deviceTimeZone ? { "x-ukali-time-zone": deviceTimeZone } : {})
  } as any;

  const cachedAccessToken = getCachedAccessToken();
  if (cachedAccessToken) {
    config.headers.Authorization = `Bearer ${cachedAccessToken}`;
    return config;
  }

  const { data } = await safeGetSession(supabase);
  const accessToken = data.session?.access_token || null;
  setCachedAccessToken(accessToken);
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const config = error?.config as (typeof error.config & { __ukaliRetried?: boolean }) | undefined;

    if (!config || config.__ukaliRetried || status !== 401) {
      throw error;
    }

    const hadAuthorizationHeader = Boolean(config.headers?.Authorization);
    const { data } = await safeGetSession(supabase);
    const accessToken = data.session?.access_token || null;
    setCachedAccessToken(accessToken);

    if (!accessToken) {
      throw error;
    }

    if (hadAuthorizationHeader && config.headers?.Authorization === `Bearer ${accessToken}`) {
      throw error;
    }

    config.__ukaliRetried = true;
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${accessToken}`
    };

    return api.request(config);
  }
);
