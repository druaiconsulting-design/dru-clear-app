import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker for PWA capability
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[DRU CLEAR\u2122] Service worker registered:", reg.scope))
      .catch((err) => console.warn("[DRU CLEAR\u2122] Service worker registration failed:", err));
  });
}
