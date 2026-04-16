import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DruClearApp from "./pages/DruClearApp";
import Login from "./pages/Login";
import Portal from "./pages/Portal";
import Frameworks from "./pages/Frameworks";
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

  // Handle Supabase OAuth callback
  useEffect(() => {
    if (hash && hash.includes("access_token")) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const role = session.user.email?.toLowerCase() === "deanna@druaiconsulting.com" ? "admin" : "client";
          window.location.href = role === "admin" ? "/admin" : "/portal";
        }
      });
    }
  }, [hash]);

  // Show nothing while auth is loading
  if (loading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.5rem" }}>DRU</div>
      </div>
    );
  }

  // Public routes
  if (path === "/" || path === "") return <DruClearApp />;
  if (path === "/roi" || path === "/roi/") return <ROI />;
  if (path === "/affiliate" || path === "/affiliate/") return <Affiliate />;
  if (path === "/frameworks" || path === "/frameworks/") return <Frameworks />;
  if (path === "/login" || path === "/login/") return <Login />;

  // Admin protected
  if (path === "/admin" || path === "/admin/") {
    if (!isLoggedIn || !isAdmin) { window.location.href = "/login"; return null; }
    return <Admin />;
  }

  // Client protected
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
