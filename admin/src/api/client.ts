import axios from "axios";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isLocalBrowser =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

// Local dev can default to localhost API. Hosted environments should use an explicit VITE_API_URL.
export const API_URL = configuredApiUrl || (isLocalBrowser ? "http://localhost:4000/api" : "/api");
export const IS_USING_API_FALLBACK = !configuredApiUrl;

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
