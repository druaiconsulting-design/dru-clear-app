/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Calculating.tsx
 */

import { useEffect } from "react";

export function CalculatingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="screen-enter flex flex-col items-center justify-center gap-8"
      style={{ height: "100%", background: "#0A2342", padding: "2rem" }}
    >
      <div className="gold-spinner" />
      <div className="text-center">
        <p className="text-lg font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}>
          Analyzing your responses
        </p>
        <p className="text-sm" style={{ color: "rgba(230,230,230,0.6)" }}>
          across all 5 CLEAR™ pillars...
        </p>
      </div>
    </div>
  );
}
