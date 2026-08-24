import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Teacher } from "./api";

interface AuthState {
  status: "loading" | "signed-out" | "signed-in";
  teacher: Teacher | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [teacher, setTeacher] = useState<Teacher | null>(null);

  async function refresh() {
    try {
      const me = await api.getMe();
      setTeacher(me);
      setStatus("signed-in");
    } catch {
      setTeacher(null);
      setStatus("signed-out");
    }
  }

  async function signOut() {
    await api.logout().catch(() => {});
    setTeacher(null);
    setStatus("signed-out");
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ status, teacher, refresh, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
