// On a phone (Expo Go), localhost is the phone itself — set EXPO_PUBLIC_API_URL
// in mobile/.env to your computer's LAN address, e.g. http://192.168.1.20:5000.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ApiError(`Cannot reach the API at ${API_URL}`, 0);
  }

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(body.message || `Request failed (${response.status})`, response.status);
  }

  return body;
}
