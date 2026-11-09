import type React from "react";

// Shared look for the Micro Drama Studio steps (matches the Video Hub).
export const NAVY = "#0A2342";
export const GOLD = "#D4AF37";

export const card: React.CSSProperties = { background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "1.25rem" };
export const h2: React.CSSProperties = { fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.1rem", margin: "0 0 0.4rem" };
export const small: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.6)", margin: 0 };
export const label: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "rgba(10,35,66,0.6)", display: "block", marginBottom: 4,
};
export const input: React.CSSProperties = {
  fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: NAVY, width: "100%", boxSizing: "border-box",
  padding: "0.5rem 0.65rem", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 8, background: "#FFFFFF",
};
export const btn = (primary = true, disabled = false): React.CSSProperties => ({
  fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
  padding: "0.55rem 1.1rem", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
  border: primary ? "none" : `1px solid ${NAVY}`, background: primary ? NAVY : "transparent", color: primary ? GOLD : NAVY,
});
export const chip = (active: boolean): React.CSSProperties => ({
  fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.04em",
  padding: "0.35rem 0.8rem", borderRadius: 999, cursor: "pointer",
  border: `1px solid ${active ? NAVY : "rgba(10,35,66,0.25)"}`, background: active ? NAVY : "#FFFFFF", color: active ? GOLD : NAVY,
});

export interface Agent { slug: string; name: string; role: string; division: string; photo_url?: string | null }

export interface StoryCard { id: string; category: string; title: string; summary: string; writer?: string }

export interface SceneRow {
  id: string; position: number; start_s: number | null; end_s: number | null;
  setting: string | null; characters: string | null; what_we_see: string | null; emotional_beat: string | null;
  dialogue: string | null; product_appearance: string | null; camera: string | null; image_prompt: string | null;
}

// What the project page hands each step.
export interface StepProps {
  projectId: string;
  settings: any;
  stepsDone: string[];
  onChanged: () => void | Promise<void>;
  onGoto?: (step: string) => void;
}

export function fmtTime(s: number): string {
  const n = Math.max(0, Math.round(s));
  const m = Math.floor(n / 60);
  return `${m}:${String(n % 60).padStart(2, "0")}`;
}

// Shrinks a picture the user picks (up to 1600 pixels on the long side) and returns it as a JPEG data URL,
// so it travels to the backend well under its size limit.
export function fileToDataUrl(file: File, maxSide = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error("This browser could not read the picture.")); return; }
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as a picture.")); };
    img.src = url;
  });
}
