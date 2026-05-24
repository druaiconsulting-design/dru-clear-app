/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/Splash.tsx
 */

import { useEffect } from "react";
import { DruLogo } from "../Types";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="screen-enter flex flex-col items-center justify-between"
      style={{ height: "100%", background: "#0A2342", padding: "3rem 2rem" }}
    >
      <div />
      <div className="flex flex-col items-center gap-6">
        <DruLogo height={140} />
        <p
          className="text-base font-medium tracking-wide text-center"
          style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif" }}
        >
          DRU AI Consulting
        </p>
      </div>
      <p
        className="text-sm text-center tracking-widest uppercase"
        style={{ color: "rgba(230,230,230,0.55)", letterSpacing: "0.12em" }}
      >
        Leading with Intelligence and Impact
      </p>
    </div>
  );
}
