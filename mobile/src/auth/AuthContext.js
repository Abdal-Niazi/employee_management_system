import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { changePasswordRequest, getCurrentAdmin, loginRequest } from "../api/auth";
import { ApiError, setAuthToken, setUnauthorizedHandler } from "../api/client";
import { clearToken, loadToken, saveToken } from "./tokenStorage";

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

  // While a password change is on its way, the server may already have ended this login, so another
  // request can get a 401 just before the answer. That 401 is noted here instead of signing out at
  // once: changePassword decides when the answer comes.
  const changing = useRef(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (changing.current) changing.current.signedOut = true;
      else logout();
    });
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

  // The server signs out every other login and answers with a new token for this one, which
  // replaces the old token here (in memory and in secure storage). Answers { saved: false } when the
  // phone couldn't store it, so the screen can say the next app start will ask to sign in.
  const changePassword = async (currentPassword, newPassword) => {
    const change = { signedOut: false };
    changing.current = change;
    try {
      const { token, admin } = await changePasswordRequest(currentPassword, newPassword);
      // A 401 for the old token while waiting was expected: that login has just been ended.
      setAuthToken(token);
      setUser(toUser(admin));
      try {
        await saveToken(token);
        return { saved: true };
      } catch {
        // The stored token is the old one, which no longer works: remove it.
        await clearToken().catch(() => {});
        return { saved: false };
      }
    } catch (error) {
      // No change was made, so a 401 while waiting means this login really ended.
      if (change.signedOut) await logout();
      throw error;
    } finally {
      if (changing.current === change) changing.current = null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, restoring, unreachable, retry, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
