import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DruClearApp from "./pages/DruClearApp";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Portal from "./pages/Portal";
import Frameworks from "./pages/Frameworks";
import BundlePricing from "./pages/BundlePricing";
import TermsPage from "./pages/TermsPage";
import Resources from "./pages/Resources";
import Daily from "./pages/Daily";
import ROI from "./pages/ROI";
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import { useEffect } from "react";
import { supabase } from "./lib/supabase";

function Router() {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  const path = window.location.pathname;
  const hash = window.location.hash;

  useEffect(() => {
    if (hash && hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const isAdminUser = session.user.email?.toLowerCase() === import.meta.env.VITE_ADMIN_EMAIL;
          window.location.href = isAdminUser ? "/admin" : "/portal";
        }
      });
    }
  }, [hash]);

  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src="https://assets.cdn.filesafe.space/gl07I4JnbkGgW8zJprSz/media/69d1a1c384c045c2744d50f6.png" alt="DRU CLEAR" style={{ height: 48, width: "auto", opacity: 0.8 }} />
      </div>
    );
  }

  if (path === "/" || path === "")                           return <DruClearApp />;
  if (path === "/roi" || path === "/roi/")                  return <ROI />;
  if (path === "/affiliate" || path === "/affiliate/")      return <Affiliate />;
  if (path === "/frameworks" || path === "/frameworks/")    return <Frameworks />;
  if (path === "/bundle-pricing" || path === "/bundle-pricing/") return <BundlePricing />;
  if (path === "/terms" || path === "/terms/")              return <TermsPage />;
  if (path === "/login" || path === "/login/")              return <Login />;

  if (path === "/admin" || path === "/admin/") {
    if (!isLoggedIn || !isAdmin) return <AdminLogin />;
    return <Admin />;
  }
  if (path === "/portal" || path === "/portal/") {
    if (!isLoggedIn) { window.location.href = "/login"; return null; }
    return <Portal />;
  }
  if (path === "/resources" || path === "/resources/") {
    if (!isLoggedIn) { window.location.href = "/login"; return null; }
    return <Resources />;
  }
  if (path === "/daily" || path === "/daily/") {
    if (!isLoggedIn) { window.location.href = "/login"; return null; }
    return <Daily />;
  }

  return <DruClearApp />;
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
