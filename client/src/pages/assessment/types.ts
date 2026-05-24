/**
 * DRU CLEAR™ AI Readiness Assessment
 * types.ts — Types, config constants, shared UI
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Screen =
  | "splash"
  | "welcome"
  | "lead-capture"
  | "clarity"
  | "leadership"
  | "execution"
  | "alignment"
  | "results-pillar"
  | "calculating"
  | "results"
  | "diagnose"
  | "payment-strategic"
  | "payment-executive"
  | "thankyou-strategic"
  | "thankyou-executive"
  | "expired"
  | "share-your-excitement";

export interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country_name?: string;
  country_iso?: string;
  company: string;
  role: string;
}

export interface Scores {
  [key: number]: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export const WEBHOOK_LEAD_URL: string =
  (import.meta.env.VITE_GHL_WEBHOOK_LEAD as string) ||
  "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

export const WEBHOOK_COMPLETE_URL: string =
  (import.meta.env.VITE_GHL_WEBHOOK_COMPLETE as string) ||
  "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/5498d39b-2d12-43e6-884a-ddf24f51b0d1";

export const WEBHOOK_CONFIG = { url: WEBHOOK_COMPLETE_URL };

export const BOOKING_BASE_URL =
  "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";

export const PAYMENT_STRATEGIC_URL = "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222";
export const PAYMENT_EXECUTIVE_URL  = "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645";
export const CALENDAR_STRATEGIC_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";
export const CALENDAR_EXECUTIVE_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation8yxwmy";

export const EXPIRY_KEY   = "dru_clear_expiry";
export const EXPIRY_HOURS = 48;
export const NUDGE_HOURS  = 36;

// ─── Assets ───────────────────────────────────────────────────────────────────

export const LOGO_CDN     = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/NJTJspnSktvZQJaw.png";
export const HEADSHOT_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/deanna-headshot_31437bb8.jpg";

// ─── Score / Tier Content ─────────────────────────────────────────────────────

export const LIKERT_LABELS = ["Strongly\nDisagree", "Disagree", "Neutral", "Agree", "Strongly\nAgree"];

export const GAP_MESSAGES: Record<string, string> = {
  Clarity:    "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership: "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution:  "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment:  "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results:    "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};

export const TIER_MESSAGES: Record<string, string> = {
  EMERGING:   "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR™ Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING: "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING:  "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING:    "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};

export const STRENGTH_MESSAGES: Record<string, string> = {
  Clarity:    "Your AI vision is clearly defined and connected to your business strategy — a critical foundation that most organizations struggle to establish.",
  Leadership: "Your executive team is AI-fluent and actively sponsoring transformation — the single most important driver of successful AI adoption.",
  Execution:  "Your teams have the skills, tools, and processes to implement AI effectively — turning strategy into measurable results.",
  Alignment:  "Your departments operate as a unified AI front with clear communication and coordinated priorities — rare and powerful.",
  Results:    "You measure, track, and demonstrate AI ROI consistently — giving you the credibility and data to scale confidently.",
};

export const TIER_ONE_LINERS: Record<string, { text: string; color: string }> = {
  EMERGING:   { text: "Most organizations don't even know where to start — now you do. Let's build your AI foundation together.", color: "#E57373" },
  DEVELOPING: { text: "You've made progress, but the gaps are costing you. Let's close them before your competitors do.", color: "#FFD54F" },
  ADVANCING:  { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
  LEADING:    { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
};

export const BADGE_URLS: Record<string, string> = {
  EMERGING:   "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/kOtwAuULsXPXkaGB.png",
  DEVELOPING: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/fWXAJkZaBbdHEhOn.png",
  ADVANCING:  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/amcdeQtIckHTNLhd.png",
  LEADING:    "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/BcciWNCYnCPbYcGB.png",
};

export const BENCHMARK_PERCENTILES: Record<string, number> = {
  EMERGING: 25, DEVELOPING: 52, ADVANCING: 74, LEADING: 93,
};

// ─── DruLogo ──────────────────────────────────────────────────────────────────

export function DruLogo({ height = 64, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src={LOGO_CDN}
      alt="DRU CLEAR™ Logo"
      className={className}
      style={{
        height,
        width: "auto",
        maxWidth: "100%",
        objectFit: "contain",
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}
