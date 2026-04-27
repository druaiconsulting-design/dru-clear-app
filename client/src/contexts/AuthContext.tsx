import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const ADMIN_EMAIL = "deanna@druaiconsulting.com";

export type UserRole = "admin" | "client" | null;
export type UserTier = "free" | "paid";
export type PathwayStage = "discover" | "diagnose" | "deploy";

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  tier: UserTier;
  pathwayStage: PathwayStage;
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
  isPaid: boolean;
  pathwayStage: PathwayStage;
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

function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch tier and pathway_stage from profiles table ──────────────────────
  // Both are always read from profiles so GHL Edge Function writes are
  // reflected in real time without requiring a new login.
  async function fetchProfileData(userId: string): Promise<{ tier: UserTier; pathwayStage: PathwayStage }> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("tier, pathway_stage")
        .eq("id", userId)
        .single();

      if (error || !data) return { tier: "free", pathwayStage: "discover" };

      const tier: UserTier = data.tier === "paid" ? "paid" : "free";
      const pathwayStage: PathwayStage =
        data.pathway_stage === "deploy" ? "deploy" :
        data.pathway_stage === "diagnose" ? "diagnose" :
        "discover";

      return { tier, pathwayStage };
    } catch {
      return { tier: "free", pathwayStage: "discover" };
    }
  }

  async function buildUser(supabaseUser: User): Promise<AuthUser> {
    const email = supabaseUser.email || "";
    const meta = supabaseUser.user_metadata || {};
    const role = getRole(email);

    const fullName = meta.full_name || meta.name || "";
    const storedFirst =
      meta.given_name ||
      meta.first_name ||
      (fullName ? fullName.split(" ")[0] : "");

    const emailPrefix = email.split("@")[0] || "";
    const firstName = storedFirst || capitalize(emailPrefix) || "";
    const picture = meta.avatar_url || meta.picture || null;

    // Admin always gets paid + deploy — fetch from profiles for all other users
    const { tier, pathwayStage } = role === "admin"
      ? { tier: "paid" as UserTier, pathwayStage: "deploy" as PathwayStage }
      : await fetchProfileData(supabaseUser.id);

    return {
      id: supabaseUser.id,
      email,
      role,
      tier,
      pathwayStage,
      firstName: firstName || undefined,
      fullName: fullName || undefined,
      picture: picture || undefined,
    };
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) setUser(await buildUser(session.user));
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) setUser(await buildUser(session.user));
      else setUser(null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        data: { first_name: firstName, tier: "free" },
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
      isPaid: user?.tier === "paid",
      pathwayStage: user?.pathwayStage ?? "discover",
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
