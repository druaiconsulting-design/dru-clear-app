import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// empire.druaiconsulting.com shows only the Empire Org Chart page (sign-in first,
// then the chart). Every other address behaves exactly as it always has.
const isEmpireHost = window.location.hostname === "empire.druaiconsulting.com";

// subscribe.druaiconsulting.com shows only the newsletter subscribe form, on every path.
const isSubscribeHost = window.location.hostname === "subscribe.druaiconsulting.com";

const root = createRoot(document.getElementById("root")!);

if (isSubscribeHost) {
  document.title = "LEAD, CLARITY, WIN! Newsletter | DRU AI Consulting";

  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.head.appendChild(robots);

  // The Hub's home-screen settings point at the Hub, so they are removed here.
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());

  import("./subscribe/SubscribeApp").then(({ default: SubscribeApp }) => {
    root.render(<SubscribeApp />);
  });
} else if (isEmpireHost) {
  document.title = "DRU AI Consulting — AI Empire Org Chart";

  // Ask search engines not to list the page.
  const robots = document.createElement("meta");
  robots.name = "robots";
  robots.content = "noindex, nofollow";
  document.head.appendChild(robots);

  // The Hub's home-screen settings point at the Hub, so they are removed here.
  // Saving this page to a phone's home screen then saves this page itself.
  document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute("content", "Empire Org Chart");

  import("./empire/EmpireApp").then(({ default: EmpireApp }) => {
    root.render(<EmpireApp />);
  });
} else {
  root.render(<App />);

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
        .then((reg) => console.log("[DRU CLEAR™] Service worker registered:", reg.scope))
        .catch((err) => console.warn("[DRU CLEAR™] Service worker registration failed:", err));
    });
  }
}
