import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Disable pull-to-refresh on all mobile browsers
// overscroll-behavior:none handles Chrome/Edge/Firefox;
// the touchmove listener handles Safari and older browsers
document.addEventListener(
  "touchmove",
  (e) => {
    // Only block if the touch started at the very top of the scroll container
    // (i.e., the user is trying to pull down from the top)
    const el = e.target as HTMLElement;
    const scrollable = el.closest('[data-scrollable]') || document.scrollingElement;
    if (!scrollable || scrollable.scrollTop <= 0) {
      e.preventDefault();
    }
  },
  { passive: false }
);

// Register service worker for PWA capability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[DRU CLEAR\u2122] Service worker registered:", reg.scope))
      .catch((err) => console.warn("[DRU CLEAR\u2122] Service worker registration failed:", err));
  });
}
