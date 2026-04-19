import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const ADMIN_EMAIL = "deanna@druaiconsulting.com";

export type UserRole = "admin" | "client" | null;

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  fullName?: string;
  picture?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isAdmin: boolean;
  isClient: boolean;
  isLoggedIn: boolean;
  loading: boolean;
  loginAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginClient: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerClient: (email: string, password: string, firstName: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getRole(email: string): UserRole {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? "admin" : "client";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) setUser(buildUser(session.user));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) setUser(buildUser(session.user));
      else setUser(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  function buildUser(supabaseUser: User): AuthUser {
    const email = supabaseUser.email || "";
    const meta = supabaseUser.user_metadata || {};

    // Full name — Google stores as full_name or name — trust as-is
    const fullName = meta.full_name || meta.name || "";

    // First name resolution — priority order:
    // 1. given_name (Google) — trust as-is e.g. "DeAnna"
    // 2. first_name (email signup) — trust as-is e.g. "DeAnna"
    // 3. First word of full_name — trust as-is e.g. "DeAnna" from "DeAnna R Upshaw"
    // 4. Email prefix — only this one gets capitalized since it's always lowercase
    const storedFirst =
      meta.given_name ||
      meta.first_name ||
      (fullName ? fullName.split(" ")[0] : "");

    // Only capitalize if falling back to email prefix — stored names are trusted as-is
    const emailPrefix = email.split("@")[0] || "";
    const capitalizedPrefix = emailPrefix
      ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
      : "";

    const firstName = storedFirst || capitalizedPrefix || "";

    const picture = meta.avatar_url || meta.picture || null;

    return {
      id: supabaseUser.id,
      email,
      role: getRole(email),
      firstName: firstName || undefined,
      fullName: fullName || undefined,
      picture: picture || undefined,
    };
  }

  const loginAdmin = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      await supabase.auth.signOut();
      return { success: false, error: "This login is for admin access only." };
    }
    return { success: true };
  };

  const loginClient = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: "Incorrect email or password." };
    return { success: true };
  };

  const registerClient = async (email: string, password: string, firstName: string) => {
    if (password.length < 8) return { success: false, error: "Password must be at least 8 characters." };
    if (!/[0-9]/.test(password)) return { success: false, error: "Password must include at least one number." };
    if (!/[^a-zA-Z0-9]/.test(password)) return { success: false, error: "Password must include at least one special character." };

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName },
      },
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAdmin: user?.role === "admin",
      isClient: user?.role === "client",
      isLoggedIn: !!user,
      loading,
      loginAdmin,
      loginClient,
      registerClient,
      loginWithGoogle,
      resetPassword,
      logout,
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
