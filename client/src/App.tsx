import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DruClearApp from "./pages/assessment";
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
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import AdminOrg from "./pages/AdminOrg";
import AdminApprovals from "./pages/AdminApprovals";
import AdminArchived from "./pages/AdminArchived";
import Twin from "./pages/Twin";
import Lab from "./pages/Lab";
import ResetPassword from "./pages/ResetPassword";
import { useEffect } from "react";
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

  useEffect(() => {
    if (hash && hash.includes("access_token")) {
      if (hash.includes("type=recovery") || hash.includes("type=signup")) {
        window.location.href = "/reset-password" + window.location.hash;
        return;
      }
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const isAdminUser = session.user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL;
          window.location.href = isAdminUser ? "/admin" : "/portal";
        }
      });
    }
  }, [hash]);

  if (loading) {
    setTitle("DRU CLEAR™");
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#0A2342",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <img
          src="/new-dru-clear-transparent-logo.png"
          alt="DRU CLEAR™"
          style={{ height: 56, width: "auto", opacity: 0.9 }}
        />
      </div>
    );
  }

  // ── Root ────────────────────────────────────────────────────────────────────
  if (path === "/" || path === "") {
    if (isAssessmentDomain) {
      setTitle("DRU CLEAR™ AI Readiness Assessment");
      return <DruClearApp />;
    }
    if (isLoggedIn) {
      window.location.replace(isAdmin ? "/admin" : "/portal");
      return null;
    }
    setTitle("Sign In · DRU CLEAR™");
    return <Login />;
  }

  // ── Redirects ───────────────────────────────────────────────────────────────
  if (path === "/roi" || path === "/roi/") {
    window.location.replace("/community");
    return null;
  }
  if (path === "/admin-launch" || path === "/admin-launch/") {
    window.location.replace("/admin");
    return null;
  }

  // ── Public Routes ───────────────────────────────────────────────────────────
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
    setTitle("Sign In · DRU CLEAR™");
    return <Login />;
  }

  // ── Thank You Pages ─────────────────────────────────────────────────────────
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
    setTitle("Command Center · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <Admin />;
  }
  if (path === "/admin-org" || path === "/admin-org/") {
    setTitle("AI Empire Org Chart · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminOrg />;
  }
  if (path === "/admin-approvals" || path === "/admin-approvals/") {
    setTitle("Approval Queue · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminApprovals />;
  }
  if (path === "/admin-archived" || path === "/admin-archived/") {
    setTitle("Archived Queue · DRU CLEAR™");
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <AdminArchived />;
  }

  // ── Protected Routes ────────────────────────────────────────────────────────
  if (path === "/portal" || path === "/portal/") {
    setTitle("My Portal · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Portal />;
  }
  if (path === "/resources" || path === "/resources/") {
    setTitle("Resource Hub · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Resources />;
  }
  if (path === "/daily" || path === "/daily/") {
    setTitle("Daily Connections · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Daily />;
  }
  if (path === "/frameworks" || path === "/frameworks/") {
    setTitle("Frameworks · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Frameworks />;
  }
  if (path === "/community" || path === "/community/") {
    setTitle("Community · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Community />;
  }
  if (path === "/lab" || path === "/lab/") {
    setTitle("Leadership Lab · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Lab />;
  }
  if (path === "/affiliate" || path === "/affiliate/") {
    setTitle("Affiliate · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Affiliate />;
  }
  if (path === "/twin" || path === "/twin/") {
    setTitle("DeAnna's AI Twin · DRU CLEAR™");
    if (!isLoggedIn) return <Login />;
    return <Twin />;
  }

  // ── Fallback ────────────────────────────────────────────────────────────────
  setTitle("DRU CLEAR™");
  if (isAssessmentDomain) return <DruClearApp />;
  if (isLoggedIn) {
    window.location.replace(isAdmin ? "/admin" : "/portal");
    return null;
  }
  return <Login />;
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

