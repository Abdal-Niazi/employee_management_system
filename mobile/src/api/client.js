// On a phone (Expo Go), localhost is the phone itself — set EXPO_PUBLIC_API_URL
// in mobile/.env to your computer's LAN address, e.g. http://192.168.1.20:5000.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

// A wrong IP or a firewall block can otherwise leave a screen spinning for minutes.
const TIMEOUT_MS = 10_000;

// Set by AuthContext after login and sent as a Bearer token with every request.
let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

// Called when the server rejects the current token (e.g. it expired), so the app can sign out.
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const sentToken = authToken;
  const headers = {
    ...(options.body && { "Content-Type": "application/json" }),
    ...(sentToken && { Authorization: `Bearer ${sentToken}` }),
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
    // Only for the token still in use: a late 401 from before a new login must not sign that login out.
    if (response.status === 401 && sentToken && sentToken === authToken) onUnauthorized?.();
    throw new ApiError(body.message || `Request failed (${response.status})`, response.status);
  }

  return body;
}
