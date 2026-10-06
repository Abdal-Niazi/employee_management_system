import { createContext, useContext, useState } from "react";

// Demo-only session. The backend has no POST /api/auth/login yet, so nothing is
// verified and no password is sent — this only remembers the chosen role. When
// auth lands, store the JWT with expo-secure-store and send it as a Bearer token.

export const ROLES = {
  manager: "Manager",
  hr_admin: "HR Admin",
  employee: "Employee",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = ({ email, role }) => setUser({ email, role });
  const logout = () => setUser(null);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
