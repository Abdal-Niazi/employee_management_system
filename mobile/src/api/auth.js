import { request } from "./client";

// POST /api/auth/login → { token, admin } today. `user` is accepted too, for when
// the backend has one account table with roles.
export async function loginRequest(email, password) {
  const body = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { token: body.token, account: body.user ?? body.admin };
}
