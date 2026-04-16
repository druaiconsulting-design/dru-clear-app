import { BrowserRouter, Routes, Route } from "react-router-dom";
import DruClearApp from "./DruClearApp";
import Portal from "./pages/Portal";
import Admin from "./pages/Admin";
import Resources from "./pages/Resources";
import Frameworks from "./pages/Frameworks";
import Daily from "./pages/Daily";
import ROI from "./pages/ROI";
import Affiliate from "./pages/Affiliate";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Assessment — exactly as live today, nothing changed */}
        <Route path="/" element={<DruClearApp />} />

        {/* New pages — Sprint 2 and beyond */}
        <Route path="/portal" element={<Portal />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/frameworks" element={<Frameworks />} />
        <Route path="/daily" element={<Daily />} />
        <Route path="/roi" element={<ROI />} />
        <Route path="/affiliate" element={<Affiliate />} />
      </Routes>
    </BrowserRouter>
  );
}
