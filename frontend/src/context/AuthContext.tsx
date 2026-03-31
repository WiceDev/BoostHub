import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { fetchMe, type User } from "@/lib/api";

// Keys
const TAB_SESSION_KEY = "active_tab_id";
const SESSION_INSTANCE_KEY = "session_instance_id";
const BROADCAST_CHANNEL = "wice_tab_session";

// Unique ID per JS execution — regenerated on every page load/refresh/duplicate.
// This is what lets us tell a refreshed tab apart from a duplicate tab.
const INSTANCE_ID = Date.now().toString(36) + Math.random().toString(36).slice(2);

function generateTabId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function isLoggedOut(): boolean {
  return sessionStorage.getItem("logged_out") === "true";
}

function hasTabSession(): boolean {
  return !!sessionStorage.getItem(TAB_SESSION_KEY);
}

function clearTabSession(): void {
  sessionStorage.setItem("logged_out", "true");
  sessionStorage.removeItem(TAB_SESSION_KEY);
}

/**
 * Ping all other open tabs. If any authenticated tab responds within 200ms,
 * we are a duplicate — the original tab is already running.
 */
function checkForDuplicateTab(): Promise<boolean> {
  return new Promise((resolve) => {
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
    } catch {
      // BroadcastChannel not supported — fail open (allow login)
      resolve(false);
      return;
    }

    let resolved = false;

    channel.onmessage = (e) => {
      if (e.data?.type === "pong" && e.data?.instanceId !== INSTANCE_ID) {
        // An existing authenticated tab responded — we are a duplicate
        if (!resolved) {
          resolved = true;
          channel.close();
          resolve(true);
        }
      }
    };

    // Ask if any other tab is already active
    channel.postMessage({ type: "ping", instanceId: INSTANCE_ID });

    // Wait up to 200ms for a response (BroadcastChannel is near-instant within the same browser)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        channel.close();
        resolve(false); // No response → we are the only tab
      }
    }, 200);
  });
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const tabIdRef = useRef<string>(sessionStorage.getItem(TAB_SESSION_KEY) || "");

  const refreshUser = useCallback(async () => {
    // If the user explicitly logged out in this tab, don't restore
    if (isLoggedOut()) {
      setUser(null);
      setLoading(false);
      return;
    }

    // No session in this tab → unauthenticated (new tab, not a duplicate)
    if (!hasTabSession()) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Ping other tabs — if one responds, this tab is a duplicate → force login
    const isDuplicate = await checkForDuplicateTab();
    if (isDuplicate) {
      clearTabSession();
      tabIdRef.current = "";
      setUser(null);
      setLoading(false);
      return;
    }

    // Claim this instance as the session owner
    localStorage.setItem(SESSION_INSTANCE_KEY, INSTANCE_ID);

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
    clearTabSession();
    tabIdRef.current = "";
    localStorage.removeItem(SESSION_INSTANCE_KEY);
    setUser(null);
  }, []);

  // On mount, establish auth
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Respond to ping from other tabs — proves THIS tab is alive and authenticated
  useEffect(() => {
    if (!user) return;
    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL);
    } catch {
      return;
    }

    channel.onmessage = (e) => {
      if (e.data?.type === "ping" && e.data?.instanceId !== INSTANCE_ID) {
        // A new/duplicate tab is asking if anyone is home — respond
        channel.postMessage({ type: "pong", instanceId: INSTANCE_ID });
      }
    };

    return () => channel.close();
  }, [user]);

  // Watch for session takeover: another tab logged in and claimed the session
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSION_INSTANCE_KEY) {
        const newInstance = e.newValue;
        if (newInstance && newInstance !== INSTANCE_ID) {
          // A different tab has claimed the session — log this tab out
          clearTabSession();
          tabIdRef.current = "";
          setUser(null);
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Claim the session on login
  const setUserWrapped = useCallback((u: User | null) => {
    if (u) {
      sessionStorage.removeItem("logged_out");
      const newTabId = generateTabId();
      tabIdRef.current = newTabId;
      sessionStorage.setItem(TAB_SESSION_KEY, newTabId);
      // Claim this instance — broadcasts to all other tabs via storage event
      localStorage.setItem(SESSION_INSTANCE_KEY, INSTANCE_ID);
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
