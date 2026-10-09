import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getCurrentAdmin, loginRequest } from "../api/auth";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";
import { clearToken, loadToken, saveToken } from "./tokenStorage";

export const ROLES = {
  manager: "Manager",
  hr_admin: "HR Admin",
  employee: "Employee",
};

const AuthContext = createContext(null);

// The server decides the role; its values map to the app's role keys.
const SERVER_ROLES = { HR_ADMIN: "hr_admin", MANAGER: "manager" };
const toUser = (admin) => ({ ...admin, role: SERVER_ROLES[admin.role] });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(true);

  const logout = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await clearToken().catch(() => {});
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

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
      } catch {
        // Expired token (401) is cleared by the client; an unreachable API just shows the login screen.
        setAuthToken(null);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const { token, admin } = await loginRequest(email, password);
    setAuthToken(token);
    await saveToken(token).catch(() => {});
    setUser(toUser(admin));
  };

  return <AuthContext.Provider value={{ user, restoring, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
