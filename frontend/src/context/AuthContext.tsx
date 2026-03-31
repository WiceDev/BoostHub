import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { fetchMe, type User } from "@/lib/api";

const TAB_SESSION_KEY = "active_tab_id";

function generateTabId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

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

function hasTabSession(): boolean {
  return !!sessionStorage.getItem(TAB_SESSION_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const tabIdRef = useRef<string>(sessionStorage.getItem(TAB_SESSION_KEY) || "");

  const refreshUser = useCallback(async () => {
    // If user explicitly logged out or no tab session exists, don't auto-restore
    if (isLoggedOut() || !hasTabSession()) {
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
    sessionStorage.removeItem(TAB_SESSION_KEY);
    tabIdRef.current = "";
    setUser(null);
  }, []);

  // On mount, check auth
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Listen for other tabs logging in — if their tab ID differs, log out this tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TAB_SESSION_KEY) return;
      const newTabId = e.newValue;
      // Another tab logged in with a different tab ID — log out this tab
      if (newTabId && newTabId !== tabIdRef.current) {
        sessionStorage.setItem("logged_out", "true");
        sessionStorage.removeItem(TAB_SESSION_KEY);
        tabIdRef.current = "";
        setUser(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Provide a setUser wrapper that claims the active session on login
  const setUserWrapped = useCallback((u: User | null) => {
    if (u) {
      sessionStorage.removeItem("logged_out");
      const newTabId = generateTabId();
      tabIdRef.current = newTabId;
      sessionStorage.setItem(TAB_SESSION_KEY, newTabId);
      // Broadcast to other tabs that this tab is now the active session
      localStorage.setItem(TAB_SESSION_KEY, newTabId);
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
