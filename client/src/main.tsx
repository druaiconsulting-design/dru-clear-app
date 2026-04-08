import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Disable pull-to-refresh ONLY — allow normal scrolling everywhere.
// Strategy: track touch start Y, then on touchmove only block if:
//   (a) the nearest scrollable ancestor is at scrollTop === 0, AND
//   (b) the finger is moving DOWNWARD (deltaY > 0 = pulling down)
// This preserves all normal scroll gestures while killing the PTR bounce.
let _touchStartY = 0;
document.addEventListener("touchstart", (e) => {
  _touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener(
  "touchmove",
  (e) => {
    const deltaY = e.touches[0].clientY - _touchStartY;
    // Find the nearest scrollable ancestor of the touched element
    let el: HTMLElement | null = e.target as HTMLElement;
    let scrollable: HTMLElement | null = null;
    while (el) {
      const style = window.getComputedStyle(el);
      const overflow = style.overflowY;
      if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) {
        scrollable = el;
        break;
      }
      el = el.parentElement;
    }
    // If no scrollable ancestor found, use the document scroll element
    const target = scrollable || (document.scrollingElement as HTMLElement | null);
    const atTop = !target || target.scrollTop <= 0;
    const pullingDown = deltaY > 0;
    // Only block the gesture when at the top AND pulling downward
    if (atTop && pullingDown) {
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
