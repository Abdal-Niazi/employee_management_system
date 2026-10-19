import { request } from "./client";

export function loginRequest(email, password) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

// The signed-in account's own password -> { token, admin }. The token replaces this login's: the
// account's other logins are signed out.
export function changePasswordRequest(currentPassword, newPassword) {
  return request("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function getCurrentAdmin() {
  const { admin } = await request("/api/auth/me");
  return admin;
}
