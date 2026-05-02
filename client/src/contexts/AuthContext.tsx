import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const ADMIN_EMAIL = "deanna@druaiconsulting.com";

export type UserRole = "admin" | "client" | null;
export type UserTier = "free" | "paid" | "navigator" | "accelerator";
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
  isNavigator: boolean;
  isAccelerator: boolean;
  hasStrategicEdge: boolean;
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

// ── Phase 1: Build user instantly from session — no network call ──────────────
function buildBasicUser(supabaseUser: User): AuthUser {
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

  const tier: UserTier = role === "admin" ? "accelerator" : "free";
  const pathwayStage: PathwayStage = role === "admin" ? "deploy" : "discover";

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

// ── Phase 2: Fetch real profile from Supabase — runs silently in background ───
async function fetchProfileData(userId: string): Promise<{ tier: UserTier; pathwayStage: PathwayStage }> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("tier, pathway_stage")
      .eq("id", userId)
      .single();

    if (error || !data) return { tier: "free", pathwayStage: "discover" };

    const tier: UserTier =
      data.tier === "accelerator" ? "accelerator" :
      data.tier === "navigator"   ? "navigator"   :
      data.tier === "paid"        ? "paid"         :
      "free";

    const pathwayStage: PathwayStage =
      data.pathway_stage === "deploy"   ? "deploy"   :
      data.pathway_stage === "diagnose" ? "diagnose" :
      "discover";

    return { tier, pathwayStage };
  } catch {
    return { tier: "free", pathwayStage: "discover" };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── Safety timeout: if onAuthStateChange never fires, unblock the app ────
    // Prevents the splash screen from hanging indefinitely under any condition.
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      clearTimeout(safetyTimeout); // fired successfully — cancel the timeout

      setSession(session);

      if (session?.user) {
        try {
          // Phase 1: resolve loading immediately from session data
          const basicUser = buildBasicUser(session.user);
          setUser(basicUser);
          setLoading(false);

          // Phase 2: update with real profile data silently in background
          if (basicUser.role !== "admin") {
            fetchProfileData(session.user.id).then(({ tier, pathwayStage }) => {
              setUser((prev) => prev ? { ...prev, tier, pathwayStage } : null);
            });
          }
        } catch {
          // Even if something goes wrong, never stay stuck on splash
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
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
      options: { redirectTo: `${window.location.origin}/login` },
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

  const tier = user?.tier;
  const isPaid           = tier === "paid" || tier === "navigator" || tier === "accelerator";
  const isNavigator      = tier === "navigator";
  const isAccelerator    = tier === "accelerator";
  const hasStrategicEdge = isNavigator || isAccelerator;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      isAdmin: user?.role === "admin",
      isClient: user?.role === "client",
      isLoggedIn: !!user,
      isPaid,
      isNavigator,
      isAccelerator,
      hasStrategicEdge,
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
