import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loginRequest } from "../api/auth";
import { setAuthToken, setUnauthorizedHandler } from "../api/client";

// The server checks the email and password and returns a JWT, which client.js sends
// with every request. The backend only has HR admin accounts and no roles yet, so the
// role still comes from "Sign in as" on the login screen. The token lives in memory,
// so reloading the app signs you out (expo-secure-store can keep it once roles exist).

export const ROLES = {
  manager: "Manager",
  hr_admin: "HR Admin",
  employee: "Employee",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = async ({ email, password, role }) => {
    const { token, account } = await loginRequest(email, password);
    setAuthToken(token);
    setUser({ email: account?.email ?? email, name: account?.name ?? null, role });
  };

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  // A rejected token (e.g. expired after 8 hours) signs the user out.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
