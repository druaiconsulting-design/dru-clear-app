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
import Resources from "./pages/Resources";
import Daily from "./pages/Daily";
import ROI from "./pages/ROI";
import Affiliate from "./pages/Affiliate";
import Admin from "./pages/Admin";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import NavBar from "./components/NavBar";

const WEBHOOK_LEAD_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

function ComingSoon() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const handleWaitlist = async () => {
    if (!email || !firstName) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ event_type: "waitlist_signup", tags: "Waitlist-DRU-Scale-System", first_name: firstName, email, timestamp: new Date().toISOString() });
      await fetch(`${WEBHOOK_LEAD_URL}?${params.toString()}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "" });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };
  const inp = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none", width: "100%" } as const;
  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/coming-soon" />
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Coming Soon</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Something Big Is Coming</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>The DRU Scale System is launching soon. Join the waitlist to be first in.</p>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, padding: "1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Join the Waitlist</p>
          {!submitted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inp} />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={inp} />
              <button onClick={handleWaitlist} disabled={loading || !email || !firstName} style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.75rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: email && firstName ? "pointer" : "not-allowed", opacity: email && firstName ? 1 : 0.5 }}>
                {loading ? "Joining..." : "Join the Waitlist"}
              </button>
            </div>
          ) : (
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#43A047", fontWeight: 700, fontSize: "0.8rem" }}>You are on the waitlist!</p>
          )}
        </div>
      </main>
      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}

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
  if (path === "/" || path === "") return <DruClearApp />;
  if (path === "/roi" || path === "/roi/") return <ROI />;
  if (path === "/affiliate" || path === "/affiliate/") return <Affiliate />;
  if (path === "/frameworks" || path === "/frameworks/") return <Frameworks />;
  if (path === "/coming-soon" || path === "/coming-soon/") return <ComingSoon />;
  if (path === "/login" || path === "/login/") return <Login />;
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
