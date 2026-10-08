import { request } from "./client";

export function loginRequest(email, password) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function getCurrentAdmin() {
  const { admin } = await request("/api/auth/me");
  return admin;
}
