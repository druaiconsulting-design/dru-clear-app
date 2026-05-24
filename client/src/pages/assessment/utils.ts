/**
 * DRU CLEAR™ AI Readiness Assessment
 * utils.ts — Expiry, webhooks, UTM, scoring, session progress
 */

import {
  EXPIRY_KEY,
  EXPIRY_HOURS,
  NUDGE_HOURS,
  WEBHOOK_CONFIG,
  WEBHOOK_COMPLETE_URL,
  BOOKING_BASE_URL,
  LeadData,
  Scores,
  Screen,
} from "./types";

// ─── Expiry ───────────────────────────────────────────────────────────────────

export function saveExpiryTimestamp(): void {
  try { localStorage.setItem(EXPIRY_KEY, new Date().toISOString()); } catch {}
}

export function getExpiryStatus(): "valid" | "nudge" | "expired" {
  try {
    const saved = localStorage.getItem(EXPIRY_KEY);
    if (!saved) return "valid";
    const hoursElapsed = (Date.now() - new Date(saved).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed >= EXPIRY_HOURS) return "expired";
    if (hoursElapsed >= NUDGE_HOURS)  return "nudge";
    return "valid";
  } catch { return "valid"; }
}

export function clearExpiryTimestamp(): void {
  try { localStorage.removeItem(EXPIRY_KEY); } catch {}
}

// ─── Phone ────────────────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ─── Webhook Queue ────────────────────────────────────────────────────────────

const RETRY_QUEUE_KEY = "dru_clear_webhook_queue";

export function enqueueWebhook(payload: Record<string, unknown>): void {
  try {
    const queue = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || "[]");
    queue.push({ payload, queuedAt: new Date().toISOString(), attempts: 0 });
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

export async function flushWebhookQueue(): Promise<void> {
  try {
    const queue: Array<{ payload: Record<string, unknown>; queuedAt: string; attempts: number }> =
      JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || "[]");
    if (queue.length === 0) return;
    const remaining: typeof queue = [];
    for (const item of queue) {
      const ok = await sendWebhookDirect(item.payload);
      if (!ok && item.attempts < 5) {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(remaining));
  } catch {}
}

export async function sendWebhookDirect(payload: Record<string, unknown>): Promise<boolean> {
  if (!WEBHOOK_CONFIG.url) return false;
  try {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) {
        if (Array.isArray(value)) {
          params.append(key, value.join(","));
        } else if (typeof value === "object") {
          params.append(key, JSON.stringify(value));
        } else {
          params.append(key, String(value));
        }
      }
    }
    const url = `${WEBHOOK_CONFIG.url}?${params.toString()}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "",
    });
    return res.ok || res.status < 500;
  } catch { return false; }
}

export async function sendWebhook(payload: Record<string, unknown>): Promise<boolean> {
  const ok = await sendWebhookDirect(payload);
  if (!ok) enqueueWebhook(payload);
  return ok;
}

export async function sendWebhookJson(
  payload: Record<string, unknown>,
  targetUrl: string
): Promise<boolean> {
  if (!targetUrl) return false;
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok && res.status >= 500) {
      enqueueWebhook(payload);
      return false;
    }
    return true;
  } catch {
    enqueueWebhook(payload);
    return false;
  }
}

// ─── Local Storage ────────────────────────────────────────────────────────────

export function saveToLocalStorage(key: string, data: object) {
  try {
    const existing = JSON.parse(localStorage.getItem("dru_clear_submissions") || "[]");
    existing.push({ key, data, savedAt: new Date().toISOString() });
    localStorage.setItem("dru_clear_submissions", JSON.stringify(existing));
  } catch {}
}

// ─── UTM Params ───────────────────────────────────────────────────────────────

export interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referral_code: string;
}

export function captureUtmParams(): UtmParams {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source:    p.get("utm_source")    || "",
    utm_medium:    p.get("utm_medium")    || "",
    utm_campaign:  p.get("utm_campaign")  || "",
    utm_content:   p.get("utm_content")   || "",
    utm_term:      p.get("utm_term")      || "",
    referral_code: p.get("ref")           || "",
  };
}

export const UTM_PARAMS: UtmParams = captureUtmParams();

// ─── Score Utilities ──────────────────────────────────────────────────────────

export function getPillarScore(scores: Scores, startQ: number): number {
  return (scores[startQ] || 0) + (scores[startQ + 1] || 0) + (scores[startQ + 2] || 0);
}

export function getTier(total: number): { label: string; className: string; color: string } {
  const scaled = Math.round((total / 75) * 100);
  if (scaled <= 40) return { label: "EMERGING",   className: "tier-emerging",   color: "#E53935" };
  if (scaled <= 60) return { label: "DEVELOPING", className: "tier-developing", color: "#D4AF37" };
  if (scaled <= 80) return { label: "ADVANCING",  className: "tier-advancing",  color: "#1E88E5" };
  return               { label: "LEADING",     className: "tier-leading",     color: "#43A047" };
}

export function buildBookingUrl(lead: LeadData): string {
  const params = new URLSearchParams({
    utm_source:    "pwa",
    utm_medium:    "scorecard",
    utm_campaign:  "ai-readiness",
    first_name:    lead.firstName || "",
    last_name:     lead.lastName  || "",
    email:         lead.email,
    company:       lead.company,
  });
  return `${BOOKING_BASE_URL}?${params.toString()}`;
}

// ─── Session Progress ─────────────────────────────────────────────────────────

export const PROGRESS_KEY = "dru_clear_progress";

export const RESUMABLE_SCREENS: Screen[] = [
  "lead-capture",
  "clarity",
  "leadership",
  "execution",
  "alignment",
  "results-pillar",
];

export function saveProgress(screen: Screen, lead: LeadData, scores: Scores): void {
  try {
    sessionStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ screen, lead, scores, savedAt: new Date().toISOString() })
    );
  } catch {}
}

export function loadProgress(): { screen: Screen; lead: LeadData; scores: Scores } | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.screen || !RESUMABLE_SCREENS.includes(parsed.screen)) return null;
    return parsed;
  } catch { return null; }
}

export function clearProgress(): void {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch {}
}
