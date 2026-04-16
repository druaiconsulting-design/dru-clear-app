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

const PUBLIC_ROUTES = ["/", "/roi", "/affiliate", "/frameworks"];

function Router() {
  const { isLoggedIn, isAdmin, isClient } = useAuth();
  const path = window.location.pathname;

  // Public routes — no login needed
  if (path === "/" || path === "") return <DruClearApp />;
  if (path === "/roi" || path === "/roi/") return <ROI />;
  if (path === "/affiliate" || path === "/affiliate/") return <Affiliate />;
  if (path === "/frameworks" || path === "/frameworks/") return <Frameworks />;
  if (path === "/login" || path === "/login/") return <Login />;

  // Admin protected
  if (path === "/admin" || path === "/admin/") {
    if (!isLoggedIn || !isAdmin) {
      window.location.href = "/login";
      return null;
    }
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
