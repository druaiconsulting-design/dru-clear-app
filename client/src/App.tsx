import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import DruClearApp from "./pages/DruClearApp";
import AdminDashboard from "./pages/AdminDashboard";
import Portal from "./pages/Portal";
import Frameworks from "./pages/Frameworks";
import Resources from "./pages/Resources";
import Daily from "./pages/Daily";
import ROI from "./pages/ROI";
import Affiliate from "./pages/Affiliate";

function Router() {
  const path = window.location.pathname;

  if (path === "/admin" || path === "/admin/") return <AdminDashboard />;
  if (path === "/portal" || path === "/portal/") return <Portal />;
  if (path === "/frameworks" || path === "/frameworks/") return <Frameworks />;
  if (path === "/resources" || path === "/resources/") return <Resources />;
  if (path === "/daily" || path === "/daily/") return <Daily />;
  if (path === "/roi" || path === "/roi/") return <ROI />;
  if (path === "/affiliate" || path === "/affiliate/") return <Affiliate />;

  return <DruClearApp />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
