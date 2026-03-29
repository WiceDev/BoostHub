import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { fetchMe, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  handleLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  setUser: () => {},
  handleLogout: () => {},
});

function isLoggedOut(): boolean {
  return sessionStorage.getItem("logged_out") === "true";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    // If user explicitly logged out this session, don't try to restore
    if (isLoggedOut()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    sessionStorage.setItem("logged_out", "true");
    setUser(null);
  }, []);

  // On mount, check auth
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Provide a setUser wrapper that clears logged_out flag when a user is set (login/register)
  const setUserWrapped = useCallback((u: User | null) => {
    if (u) {
      sessionStorage.removeItem("logged_out");
    }
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setUser: setUserWrapped, handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
