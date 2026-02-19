// keys used in localStorage
export const ACCESS_TOKEN = "access_token";
export const REFRESH_TOKEN = "refresh_token";

// API base URL (single source of truth)
export const API_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
