import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentAdmin, loginRequest } from "../api/auth";
import { ApiError, setAuthToken, setUnauthorizedHandler } from "../api/client";
import { clearToken, loadToken, saveToken } from "./tokenStorage";

export const ROLES = {
  manager: "Manager",
  hr_admin: "HR Admin",
  employee: "Employee",
};

const AuthContext = createContext(null);

// The server decides the role; its values map to the app's role keys.
const SERVER_ROLES = { HR_ADMIN: "hr_admin", MANAGER: "manager", EMPLOYEE: "employee" };
const toUser = (admin) => ({ ...admin, role: SERVER_ROLES[admin.role] });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);
  // The saved session couldn't be checked because the server didn't answer properly.
  const [unreachable, setUnreachable] = useState(false);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    setUnreachable(false);
    await clearToken().catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Bumped by Retry to check the saved session again.
  const [attempt, setAttempt] = useState(0);

  // Pick the saved session back up on app start; the server decides if it is still valid.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await loadToken();
        if (!token) return;
        setAuthToken(token);
        const admin = await getCurrentAdmin();
        if (!cancelled) setUser(toUser(admin));
      } catch (error) {
        if (cancelled) return;
        // No connection, or the server is having trouble: keep the saved session and offer a
        // retry instead of asking for the password again. A 401 (expired token) was already
        // signed out by the client.
        if (error instanceof ApiError && error.status !== 401) setUnreachable(true);
        else setAuthToken(null);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setUnreachable(false);
    setRestoring(true);
    setAttempt((n) => n + 1);
  }, []);

  const login = async (email, password) => {
    const { token, admin } = await loginRequest(email, password);
    setAuthToken(token);
    await saveToken(token).catch(() => {});
    setUser(toUser(admin));
  };

  return (
    <AuthContext.Provider value={{ user, restoring, unreachable, retry, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
