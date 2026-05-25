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
export const PAYMENT_EXECUTIVE_URL = "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645";
export const CALENDAR_STRATEGIC_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";
export const CALENDAR_EXECUTIVE_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation8yxwmy";

export const LOGO_CDN = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/NJTJspnSktvZQJaw.png";
export const HEADSHOT_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/deanna-headshot_31437bb8.jpg";

// ── Expiry ────────────────────────────────────────────────────────────────────

const EXPIRY_KEY = "dru_clear_expiry";
const EXPIRY_HOURS = 48;
const NUDGE_HOURS = 36;

export function saveExpiryTimestamp(): void {
  try { localStorage.setItem(EXPIRY_KEY, new Date().toISOString()); } catch {}
}

export function getExpiryStatus(): "valid" | "nudge" | "expired" {
  try {
    const saved = localStorage.getItem(EXPIRY_KEY);
    if (!saved) return "valid";
    const hoursElapsed = (Date.now() - new Date(saved).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed >= EXPIRY_HOURS) return "expired";
    if (hoursElapsed >= NUDGE_HOURS) return "nudge";
    return "valid";
  } catch { return "valid"; }
}

export function clearExpiryTimestamp(): void {
  try { localStorage.removeItem(EXPIRY_KEY); } catch {}
}
