import { createContext, useContext, useState, useEffect, ReactNode } from "react";

// ─── Admin Credentials — Change these to your real email and password ─────────
const ADMIN_EMAIL = "deanna@druaiconsulting.com";
const ADMIN_PASSWORD = "AbundantLife4041$$";

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const AUTH_KEY = "dru_auth_session";
const CLIENTS_KEY = "dru_registered_clients";

export type UserRole = "admin" | "client" | null;

interface AuthUser {
  email: string;
  role: UserRole;
  firstName?: string;
  picture?: string;
  googleAuth?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAdmin: boolean;
  isClient: boolean;
  isLoggedIn: boolean;
  loginAdmin: (email: string, password: string) => { success: boolean; error?: string };
  loginClient: (email: string, password: string) => { success: boolean; error?: string };
  registerClient: (email: string, password: string, firstName: string) => { success: boolean; error?: string };
  loginWithGoogle: (credential: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkClientExists: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Decode Google JWT token
function parseGoogleJWT(token: string) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(json);
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      else localStorage.removeItem(AUTH_KEY);
    } catch {}
  }, [user]);

  const getClients = (): Record<string, { password?: string; firstName: string; googleAuth?: boolean }> => {
    try { return JSON.parse(localStorage.getItem(CLIENTS_KEY) || "{}"); } catch { return {}; }
  };

  const saveClients = (clients: Record<string, { password?: string; firstName: string; googleAuth?: boolean }>) => {
    try { localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients)); } catch {}
  };

  const loginAdmin = (email: string, password: string) => {
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
      setUser({ email, role: "admin", firstName: "DeAnna" });
      return { success: true };
    }
    return { success: false, error: "Invalid email or password." };
  };

  const checkClientExists = (email: string) => {
    const clients = getClients();
    return !!clients[email.toLowerCase()];
  };

  const loginWithGoogle = async (credential: string) => {
    try {
      const payload = parseGoogleJWT(credential);
      if (!payload || !payload.email) return { success: false, error: "Could not read Google account info." };

      const { email, given_name, picture } = payload;
      const clients = getClients();
      const key = email.toLowerCase();

      // Auto-register if first time
      if (!clients[key]) {
        clients[key] = { firstName: given_name || email.split("@")[0], googleAuth: true };
        saveClients(clients);
      }

      // Check if this is admin email
      const role: UserRole = email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "client";
      setUser({ email, role, firstName: given_name || clients[key].firstName, picture, googleAuth: true });

      return { success: true };
    } catch {
      return { success: false, error: "Google sign in failed. Please try again." };
    }
  };

  const registerClient = (email: string, password: string, firstName: string) => {
    if (password.length < 8) return { success: false, error: "Password must be at least 8 characters." };
    if (!/[0-9]/.test(password)) return { success: false, error: "Password must include at least one number." };
    if (!/[^a-zA-Z0-9]/.test(password)) return { success: false, error: "Password must include at least one special character." };
    const clients = getClients();
    const key = email.toLowerCase();
    if (clients[key]) return { success: false, error: "An account with this email already exists. Please log in." };
    clients[key] = { password, firstName };
    saveClients(clients);
    setUser({ email, role: "client", firstName });
    return { success: true };
  };

  const loginClient = (email: string, password: string) => {
    const clients = getClients();
    const client = clients[email.toLowerCase()];
    if (!client) return { success: false, error: "No account found. Please register first." };
    if (client.googleAuth) return { success: false, error: "This account uses Google Sign In. Please use the Google button above." };
    if (client.password !== password) return { success: false, error: "Incorrect password." };
    setUser({ email, role: "client", firstName: client.firstName });
    return { success: true };
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.role === "admin",
      isClient: user?.role === "client",
      isLoggedIn: !!user,
      loginAdmin,
      loginClient,
      registerClient,
      loginWithGoogle,
      logout,
      checkClientExists,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
