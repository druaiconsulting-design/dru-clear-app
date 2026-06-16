import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DruClearApp from "./pages/DruClearAssessment";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Portal from "./pages/Portal";
import Frameworks from "./pages/Frameworks";
import BundlePricing from "./pages/BundlePricing";
import TermsPage from "./pages/TermsPage";
import ThankYouED from "./pages/ThankYouED";
import ThankYouSD from "./pages/ThankYouSD";
import { ThankYouDruClear, ThankYou5D, ThankYou5C, ThankYouAISales } from "./pages/ThankYouFrameworks";
import ThankYouFullEcosystem from "./pages/ThankYouFullEcosystem";
import Resources from "./pages/Resources";
import Daily from "./pages/Daily";
import Community from "./pages/community";
import AcceleratorCircle from "./pages/community/AcceleratorCircle";
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import AdminOrg from "./pages/AdminOrg";
import AdminApprovals from "./pages/AdminApprovals";
import AdminArchived from "./pages/AdminArchived";
import AdminMemberIntelligence from "./pages/AdminMemberIntelligence";
import AdminSprints from "./pages/AdminSprints";
import AdminLab from "./pages/AdminLab";
import AdminWeekly from "./pages/AdminWeekly";
import AdminCourses from "./pages/AdminCourses";
import AdminLeaderboard from "./pages/AdminLeaderboard";
import CourseDashboard from "./pages/CourseDashboard";
import Twin from "./pages/Twin";
import Lab from "./pages/Lab";
import ResetPassword from "./pages/ResetPassword";
import MyResults from "./pages/MyResults";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

function setTitle(title: string) {
  document.title = title;
}

function Router() {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  const path = window.location.pathname;
  const hash = window.location.hash;
  const hostname = window.location.hostname;
  const isAssessmentDomain = hostname === "assessment.druaiconsulting.com";

  const params = new URLSearchParams(window.location.search);

  // Show spinner while any token exchange is in progress.
  // Covers: ?code= (Google OAuth) and ?token_hash= (email confirmation / recovery).
  const [exchangingCode, setExchangingCode] = useState(
    !!params.get("code") ||
    (!!params.get("token_hash") &&
      (params.get("type") === "signup" ||
       params.get("type") === "recovery" ||
       params.get("type") === "email"))
  );

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);

    // ── 1. Hash fragment — implicit-flow tokens ───────────────────────────────
    // Covers Google OAuth result and older Supabase email confirmation tokens
    // where the access_token is embedded directly in the URL hash.
    if (hash && hash.includes("access_token")) {
      // Password recovery — member or admin forgot their password.
      if (hash.includes("type=recovery")) {
        window.location.href = "/reset-password" + window.location.hash;
        return;
      }
      // New member email confirmation (hash format).
      // The hash carries type=signup — ResetPassword.tsx reads it to know
      // this is account creation, not a password reset.
      if (hash.includes("type=signup")) {
        window.location.href = "/reset-password" + window.location.hash;
        return;
      }
      // All other hash tokens — standard Google OAuth success, no type tag.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const isAdminUser =
            session.user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL;
          window.location.href = isAdminUser ? "/admin" : "https://members.druaiconsulting.com";
        }
      });
      return;
    }

    // ── 2. Token hash — email confirmation / password recovery (query params) ─
    // Supabase ignores emailRedirectTo for password-based signUp() and always
    // uses the Site URL (app.druaiconsulting.com). New members land here after
    // clicking their confirmation email with ?token_hash=xxx&type=signup.
    // We exchange the token to establish a session, then route accordingly.
    const tokenHash = sp.get("token_hash");
    const tokenType = sp.get("type") as "signup" | "recovery" | "email" | null;

    if (tokenHash && (tokenType === "signup" || tokenType === "recovery" || tokenType === "email")) {
      // Map "email" (used by some Supabase versions) to "signup" for verifyOtp.
      const otpType: "signup" | "recovery" = tokenType === "recovery" ? "recovery" : "signup";

      supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: otpType })
        .then(({ data, error }) => {
          // Clean the token params from the URL regardless of outcome.
          window.history.replaceState({}, document.title, window.location.pathname);

          if (error || !data.session) {
            // Token invalid, expired, or already used — drop to login.
            setExchangingCode(false);
            return;
          }

          const isAdminUser =
            data.session.user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL;
          const isSignup = otpType === "signup";

          if (isSignup && !isAdminUser) {
            // New member email confirmed — send to ResetPassword to create their
            // password. ?flow=signup tells that page to redirect to the members
            // portal on success instead of the old /portal route.
            window.location.replace("/reset-password?flow=signup");
          } else if (isAdminUser) {
            // Admin link (signup or recovery) — go to admin.
            window.location.replace("/admin");
          } else {
            // Member password recovery — go to ResetPassword normally.
            window.location.replace("/reset-password");
          }
        });
      return;
    }

    // ── 3. OAuth PKCE code exchange — Google sign-in ──────────────────────────
    const code = sp.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        window.history.replaceState({}, document.title, window.location.pathname);
        if (error || !data?.session) {
          setExchangingCode(false);
          return;
        }
        const isAdminUser =
          data.session.user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL;
        window.location.replace(isAdminUser ? "/admin" : "https://members.druaiconsulting.com");
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || exchangingCode) {
    setTitle("DRU CLEAR™");
    return (
      <div style={{
        minHeight: "100dvh", background: "#0A2342",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <img src="/new-dru-clear-transparent-logo.png" alt="DRU CLEAR™"
          style={{ height: 56, width: "auto", opacity: 0.9 }} />
      </div>
    );
  }

  if (path === "/" || path === "") {
    if (isAssessmentDomain) {
      setTitle("DRU CLEAR™ AI Readiness Assessment");
      return <DruClearApp />;
    }
    window.location.replace("/admin");
    return null;
  }

  if (path === "/roi" || path === "/roi/") {
    window.location.replace("/community");
    return null;
  }
  if (path === "/admin-launch" || path === "/admin-launch/") {
    window.location.replace("/admin");
    return null;
  }

  if (path === "/bundle-pricing" || path === "/bundle-pricing/") {
    setTitle("Bundle Pricing · DRU CLEAR™");
    return <BundlePricing />;
  }
  if (path === "/terms" || path === "/terms/") {
    setTitle("Terms of Engagement · DRU CLEAR™");
    return <TermsPage />;
  }
  if (path === "/reset-password" || path === "/reset-password/") {
    setTitle("Set Your Password · DRU CLEAR™");
    return <ResetPassword />;
  }
  if (path === "/login" || path === "/login/") {
    window.location.replace("/admin");
    return null;
  }

  if (path === "/thank-you-ed" || path === "/thank-you-ed/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYouED />;
  }
  if (path === "/thank-you-sd" || path === "/thank-you-sd/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYouSD />;
  }
  if (path === "/thank-you-dru-clear" || path === "/thank-you-dru-clear/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYouDruClear />;
  }
  if (path === "/thank-you-5d" || path === "/thank-you-5d/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYou5D />;
  }
  if (path === "/thank-you-5c" || path === "/thank-you-5c/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYou5C />;
  }
  if (path === "/thank-you-ai-sales" || path === "/thank-you-ai-sales/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYouAISales />;
  }
  if (path === "/thank-you-full-ecosystem" || path === "/thank-you-full-ecosystem/") {
    setTitle("Thank You · DRU CLEAR™");
    return <ThankYouFullEcosystem />;
  }

  // ── Admin Routes ────────────────────────────────────────────────────────────
  if (path === "/admin" || path === "/admin/") {
    setTitle("Profit Pulse · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <Admin />;
  }
  if (path === "/admin-org" || path === "/admin-org/") {
    setTitle("AI Empire Org Chart · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminOrg />;
  }
  if (path === "/admin-approvals" || path === "/admin-approvals/") {
    setTitle("Intelligence Hub · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminApprovals />;
  }
  if (path === "/admin-archived" || path === "/admin-archived/") {
    setTitle("Archived Queue · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminArchived />;
  }
  if (path === "/admin-member-intelligence" || path === "/admin-member-intelligence/") {
    setTitle("Member Intelligence · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminMemberIntelligence />;
  }
  if (path === "/admin-sprints" || path === "/admin-sprints/") {
    setTitle("Build Roadmap · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminSprints />;
  }
  if (path === "/admin-lab" || path === "/admin-lab/") {
    setTitle("Leadership Lab · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminLab />;
  }
  if (path === "/course-dashboard" || path === "/course-dashboard/") {
    setTitle("Course Dashboard · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <CourseDashboard adminPreview={true} />;
  }
  if (path === "/admin-courses" || path === "/admin-courses/") {
    setTitle("Course Management · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminCourses />;
  }
  if (path === "/admin-resources" || path === "/admin-resources/") {
    setTitle("Weekly Resources PDF · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminWeekly />;
  }
  if (path === "/leaderboard" || path === "/leaderboard/") {
    setTitle("Leaderboard · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminLeaderboard />;
  }

  // ── Protected Routes ────────────────────────────────────────────────────────
  if (path === "/portal" || path === "/portal/") {
    window.location.replace("https://members.druaiconsulting.com");
    return null;
  }
  if (path === "/my-results" || path === "/my-results/") {
    setTitle("My Assessment Results · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <MyResults />;
  }
  if (path === "/resources" || path === "/resources/") {
    setTitle("Knowledge Vault · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Resources />;
  }
  if (path === "/daily" || path === "/daily/") {
    setTitle("Daily Connections · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Daily />;
  }
  if (path === "/frameworks" || path === "/frameworks/") {
    setTitle("Frameworks · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Frameworks />;
  }
  if (path === "/community/accelerator" || path === "/community/accelerator/") {
    setTitle("Accelerator Circle · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AcceleratorCircle />;
  }
  if (path === "/community" || path === "/community/") {
    setTitle("Community · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Community />;
  }
  if (path === "/lab" || path === "/lab/") {
    setTitle("Leadership Lab · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Lab />;
  }
  if (path === "/affiliate" || path === "/affiliate/") {
    setTitle("Affiliate · DRU CLEAR™");
    if (!isLoggedIn) { window.location.replace("/admin"); return null; }
    return <Affiliate />;
  }
  if (path === "/twin" || path === "/twin/") {
    setTitle("DeAnna's AI Twin · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <Twin />;
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  setTitle("DRU CLEAR™");
  if (isAssessmentDomain) return <DruClearApp />;
  if (isLoggedIn) {
    window.location.replace(isAdmin ? "/admin" : "https://members.druaiconsulting.com");
    return null;
  }
  window.location.replace("/admin"); return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
