// On a phone (Expo Go), localhost is the phone itself — set EXPO_PUBLIC_API_URL
// in mobile/.env to your computer's LAN address, e.g. http://192.168.1.20:5000.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

// A wrong IP or a firewall block can otherwise leave a screen spinning for minutes.
const TIMEOUT_MS = 10_000;

// Release builds only talk to an HTTPS API, so passwords and tokens are never sent in
// plain text. Plain http is fine while developing on a local network.
const INSECURE_API = !__DEV__ && !API_URL.startsWith("https://");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// AuthContext owns the session; it hands the token (and a sign-out callback for
// expired tokens) to this module so every request can send the Bearer header.
let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function request(path, options = {}) {
  if (INSECURE_API) {
    throw new ApiError("This build needs an https:// API address (EXPO_PUBLIC_API_URL).", 0);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const sentToken = authToken;
  // Only send a JSON content type with a body — on GETs it just forces a CORS preflight.
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : null),
    ...(sentToken ? { Authorization: `Bearer ${sentToken}` } : null),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(
        `The API at ${API_URL} did not respond. Check that the backend is running and EXPO_PUBLIC_API_URL is correct.`,
        0
      );
    }
    throw new ApiError(`Cannot reach the API at ${API_URL}`, 0);
  } finally {
    clearTimeout(timer);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // A 401 for the token still in use means it expired or was revoked — sign out. A late 401
    // from a request sent before a new login must not sign that new login out.
    if (response.status === 401 && sentToken && sentToken === authToken) onUnauthorized?.();
    throw new ApiError(body.message || `Request failed (${response.status})`, response.status);
  }

  return body;
}
