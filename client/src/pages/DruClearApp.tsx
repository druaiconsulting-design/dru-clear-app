/**
 * DRU CLEAR™ AI Readiness Scorecard PWA
 * Design: Executive Prestige — Dark Luxury
 * Background: #0A2342 | Gold: #D4AF37 | Magenta CTA: #C2185B
 * Fonts: Playfair Display (headings) + Inter (body)
 */

import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
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

interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country_name?: string;
  country_iso?: string;
  company: string;
  role: string;
}

interface Scores {
  [key: number]: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const WEBHOOK_LEAD_URL: string =
  (import.meta.env.VITE_GHL_WEBHOOK_LEAD as string) ||
  "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

const WEBHOOK_COMPLETE_URL: string =
  (import.meta.env.VITE_GHL_WEBHOOK_COMPLETE as string) ||
  "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/5498d39b-2d12-43e6-884a-ddf24f51b0d1";

const WEBHOOK_CONFIG = { url: WEBHOOK_COMPLETE_URL };

const BOOKING_BASE_URL =
  "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";

const PAYMENT_STRATEGIC_URL = "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222";
const PAYMENT_EXECUTIVE_URL = "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645";
const CALENDAR_STRATEGIC_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation";
const CALENDAR_EXECUTIVE_URL = "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation8yxwmy";

const EXPIRY_KEY = "dru_clear_expiry";
const EXPIRY_HOURS = 48;
const NUDGE_HOURS = 36;

function saveExpiryTimestamp(): void {
  try { localStorage.setItem(EXPIRY_KEY, new Date().toISOString()); } catch {}
}

function getExpiryStatus(): "valid" | "nudge" | "expired" {
  try {
    const saved = localStorage.getItem(EXPIRY_KEY);
    if (!saved) return "valid";
    const hoursElapsed = (Date.now() - new Date(saved).getTime()) / (1000 * 60 * 60);
    if (hoursElapsed >= EXPIRY_HOURS) return "expired";
    if (hoursElapsed >= NUDGE_HOURS) return "nudge";
    return "valid";
  } catch { return "valid"; }
}

function clearExpiryTimestamp(): void {
  try { localStorage.removeItem(EXPIRY_KEY); } catch {}
}

// ─── Webhook & Storage ───────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

const RETRY_QUEUE_KEY = "dru_clear_webhook_queue";

function enqueueWebhook(payload: Record<string, unknown>): void {
  try {
    const queue = JSON.parse(localStorage.getItem(RETRY_QUEUE_KEY) || "[]");
    queue.push({ payload, queuedAt: new Date().toISOString(), attempts: 0 });
    localStorage.setItem(RETRY_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

async function flushWebhookQueue(): Promise<void> {
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

async function sendWebhookDirect(payload: Record<string, unknown>): Promise<boolean> {
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
  } catch {
    return false;
  }
}

async function sendWebhook(payload: Record<string, unknown>): Promise<boolean> {
  const ok = await sendWebhookDirect(payload);
  if (!ok) enqueueWebhook(payload);
  return ok;
}

async function sendWebhookJson(payload: Record<string, unknown>, targetUrl: string): Promise<boolean> {
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

function saveToLocalStorage(key: string, data: object) {
  try {
    const existing = JSON.parse(localStorage.getItem("dru_clear_submissions") || "[]");
    existing.push({ key, data, savedAt: new Date().toISOString() });
    localStorage.setItem("dru_clear_submissions", JSON.stringify(existing));
  } catch {}
}

// ─── UTM Parameter Capture ───────────────────────────────────────────────────

interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referral_code: string;
}

function captureUtmParams(): UtmParams {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_campaign: p.get("utm_campaign") || "",
    utm_content: p.get("utm_content") || "",
    utm_term: p.get("utm_term") || "",
    referral_code: p.get("ref") || "",
  };
}

const UTM_PARAMS: UtmParams = captureUtmParams();

// ─── Score Utilities ─────────────────────────────────────────────────────────

function getPillarScore(scores: Scores, startQ: number): number {
  return (scores[startQ] || 0) + (scores[startQ + 1] || 0) + (scores[startQ + 2] || 0);
}

function getTier(total: number): { label: string; className: string; color: string } {
  const scaled = Math.round((total / 75) * 100);
  if (scaled <= 40) return { label: "EMERGING", className: "tier-emerging", color: "#E53935" };
  if (scaled <= 60) return { label: "DEVELOPING", className: "tier-developing", color: "#D4AF37" };
  if (scaled <= 80) return { label: "ADVANCING", className: "tier-advancing", color: "#1E88E5" };
  return { label: "LEADING", className: "tier-leading", color: "#43A047" };
}

const GAP_MESSAGES: Record<string, string> = {
  Clarity: "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership: "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution: "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment: "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results: "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};

const TIER_MESSAGES: Record<string, string> = {
  EMERGING: "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR™ Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING: "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING: "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING: "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};

const STRENGTH_MESSAGES: Record<string, string> = {
  Clarity: "Your AI vision is clearly defined and connected to your business strategy — a critical foundation that most organizations struggle to establish.",
  Leadership: "Your executive team is AI-fluent and actively sponsoring transformation — the single most important driver of successful AI adoption.",
  Execution: "Your teams have the skills, tools, and processes to implement AI effectively — turning strategy into measurable results.",
  Alignment: "Your departments operate as a unified AI front with clear communication and coordinated priorities — rare and powerful.",
  Results: "You measure, track, and demonstrate AI ROI consistently — giving you the credibility and data to scale confidently.",
};

const TIER_ONE_LINERS: Record<string, { text: string; color: string }> = {
  EMERGING: { text: "Most organizations don't even know where to start — now you do. Let's build your AI foundation together.", color: "#E57373" },
  DEVELOPING: { text: "You've made progress, but the gaps are costing you. Let's close them before your competitors do.", color: "#FFD54F" },
  ADVANCING: { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
  LEADING: { text: "You're ahead of most organizations — here's how to turn that advantage into market dominance.", color: "#66BB6A" },
};

const BADGE_URLS: Record<string, string> = {
  EMERGING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-emerging_6233aed6.png",
  DEVELOPING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-developing_226a8643.png",
  ADVANCING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-advancing_d5ded127.png",
  LEADING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-leading_3fa87f71.png",
};

function buildBookingUrl(lead: LeadData): string {
  const params = new URLSearchParams({
    utm_source: "pwa",
    utm_medium: "scorecard",
    utm_campaign: "ai-readiness",
    first_name: lead.firstName || "",
    last_name: lead.lastName || "",
    email: lead.email,
    company: lead.company,
  });
  return `${BOOKING_BASE_URL}?${params.toString()}`;
}

// ─── Logo ─────────────────────────────────────────────────────────────────────

const LOGO_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-clear-logo-transparent_fdbc9d32.png";
const HEADSHOT_CDN = "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/deanna-headshot_31437bb8.jpg";

function DruLogo({ className = "" }: { className?: string }) {
  return <img src={LOGO_CDN} alt="DRU CLEAR™ Logo" className={className} style={{ objectFit: "contain" }} />;
}

// ─── Score Button Row ─────────────────────────────────────────────────────────

const LIKERT_LABELS = ["Strongly\nDisagree", "Disagree", "Neutral", "Agree", "Strongly\nAgree"];

function ScoreRow({ questionNum, question, value, onChange }: { questionNum: number; question: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium mb-3" style={{ color: "#E6E6E6", lineHeight: 1.5 }}>
        <span style={{ color: "#D4AF37", marginRight: "0.4em" }}>{questionNum}.</span>{question}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`score-btn${value === n ? " selected" : ""}`} onClick={() => onChange(n)} aria-label={LIKERT_LABELS[n - 1].replace("\n", " ")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", height: "auto" }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center", whiteSpace: "pre-line", opacity: 0.85, fontFamily: "'Inter', sans-serif" }}>{LIKERT_LABELS[n - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="screen-enter flex flex-col items-center justify-between" style={{ height: "100%", background: "#0A2342", padding: "3rem 2rem" }}>
      <div />
      <div className="flex flex-col items-center gap-6">
        <DruLogo className="w-72 max-w-full" />
        <p className="text-base font-medium tracking-wide text-center" style={{ color: "#E6E6E6", fontFamily: "'Inter', sans-serif" }}>DRU AI Consulting</p>
      </div>
      <p className="text-sm text-center tracking-widest uppercase" style={{ color: "rgba(230,230,230,0.55)", letterSpacing: "0.12em" }}>Leading with Intelligence and Impact</p>
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="flex flex-col items-center mb-6">
        <DruLogo className="w-48 max-w-full mb-4" />
        <div style={{ width: 120, height: 120, borderRadius: "50%", border: "2.5px solid #D4AF37", boxShadow: "0 0 0 4px rgba(212,175,55,0.15), 0 4px 20px rgba(0,0,0,0.4)", overflow: "hidden", marginBottom: "1.25rem", flexShrink: 0 }}>
          <img src={HEADSHOT_CDN} alt="DeAnna R. Upshaw" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
        </div>
        <h1 className="text-3xl font-bold text-center mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>DeAnna R. Upshaw</h1>
        <p className="text-lg font-medium text-center mb-1" style={{ color: "#FFFFFF" }}>AI Authority</p>
        <p className="text-sm text-center" style={{ color: "#E6E6E6" }}>CEO, DRU AI Consulting</p>
      </div>
      <div className="gold-divider mb-6" />
      <p className="text-center text-sm mb-6 italic" style={{ color: "#E6E6E6", fontFamily: "'Playfair Display', serif" }}>Your Trusted Advisor &amp; Strategist</p>
      <p className="text-sm leading-relaxed mb-8" style={{ color: "#E6E6E6" }}>
        How ready is your organization for the AI era? Take the free{" "}
        <strong style={{ color: "#D4AF37" }}>DRU CLEAR™ AI Readiness Scorecard</strong> and find out in 3 minutes.
      </p>
      <button className="btn-gold" onClick={onStart}>Start Your Assessment →</button>
    </div>
  );
}

// ─── Email Verification ───────────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org","tempmail.com","temp-mail.org","throwaway.email",
  "trashmail.com","trashmail.me","trashmail.net","dispostable.com","maildrop.cc","yopmail.com","yopmail.fr",
  "10minutemail.com","10minutemail.net","fakeinbox.com","fakemailgenerator.com","guerrillamailblock.com",
  "sharklasers.com","grr.la","spam4.me","spamgourmet.com","mohmal.com","mytemp.email","nada.email",
  "gmial.com","gmal.com","gmai.com","gmali.com","gmaill.com","yahooo.com","yahho.com","yaho.com",
  "hotmial.com","hotmal.com","hotmai.com","outlok.com","outloo.com",
]);

const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com","gmal.com": "gmail.com","gmai.com": "gmail.com","gmali.com": "gmail.com","gmaill.com": "gmail.com",
  "yahooo.com": "yahoo.com","yahho.com": "yahoo.com","yaho.com": "yahoo.com","yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com","hotmal.com": "hotmail.com","hotmai.com": "hotmail.com","hotmaill.com": "hotmail.com",
  "outlok.com": "outlook.com","outloo.com": "outlook.com","outloook.com": "outlook.com",
};

async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return true;
    const data = await res.json();
    if (data.Status !== 0 || !Array.isArray(data.Answer) || data.Answer.length === 0) return false;
    return data.Answer.some((rec: { data: string }) => { const d = (rec.data || "").trim(); return d !== "." && d !== "0 ." && !d.endsWith(" ."); });
  } catch { return true; }
}

async function verifyEmail(email: string): Promise<{ valid: boolean; error: string; suggestion?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: "Required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { valid: false, error: "Please enter a valid email address" };
  const domain = trimmed.split("@")[1];
  if (DOMAIN_TYPOS[domain]) return { valid: false, error: `Did you mean ${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}?`, suggestion: `${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}` };
  if (DISPOSABLE_DOMAINS.has(domain)) return { valid: false, error: "Disposable email addresses are not accepted. Please use your work or personal email." };
  const hasMx = await checkMxRecord(domain);
  if (!hasMx) return { valid: false, error: `No mail server found for "${domain}". Please check your email address.` };
  return { valid: true, error: "" };
}

// ─── Country Code Data ────────────────────────────────────────────────────────

interface CountryCode {
  code: string;
  iso: string;
  name: string;
  flag: string;
  hint: string;
  minLen: number;
  maxLen: number;
}

const TIMEZONE_TO_ISO: Record<string, string> = {
  "America/New_York": "US","America/Chicago": "US","America/Denver": "US","America/Los_Angeles": "US",
  "America/Phoenix": "US","America/Anchorage": "US","Pacific/Honolulu": "US","America/Detroit": "US",
  "America/Indiana/Indianapolis": "US","America/Toronto": "CA","America/Vancouver": "CA","America/Montreal": "CA",
  "America/Mexico_City": "MX","America/Sao_Paulo": "BR","America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO","America/Lima": "PE","America/Santiago": "CL","America/Caracas": "VE",
  "Europe/London": "GB","Europe/Dublin": "IE","Europe/Paris": "FR","Europe/Berlin": "DE",
  "Europe/Madrid": "ES","Europe/Rome": "IT","Europe/Amsterdam": "NL","Europe/Brussels": "BE",
  "Europe/Stockholm": "SE","Europe/Oslo": "NO","Europe/Copenhagen": "DK","Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL","Europe/Moscow": "RU","Europe/Istanbul": "TR","Europe/Athens": "GR",
  "Asia/Tokyo": "JP","Asia/Seoul": "KR","Asia/Shanghai": "CN","Asia/Hong_Kong": "HK",
  "Asia/Singapore": "SG","Asia/Kolkata": "IN","Asia/Dubai": "AE","Asia/Riyadh": "SA",
  "Australia/Sydney": "AU","Australia/Melbourne": "AU","Australia/Brisbane": "AU",
  "Pacific/Auckland": "NZ","Africa/Cairo": "EG","Africa/Johannesburg": "ZA","Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
};

function detectCountryFromTimezone(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso = TIMEZONE_TO_ISO[tz];
    if (iso) { const found = COUNTRY_CODES.find((c) => c.iso === iso); if (found) return found; }
  } catch {}
  return COUNTRY_CODES[0];
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+1", iso: "US", name: "United States", flag: "🇺🇸", hint: "Format: (555) 000-0000", minLen: 10, maxLen: 10 },
  { code: "+1", iso: "CA", name: "Canada", flag: "🇨🇦", hint: "Format: (555) 000-0000", minLen: 10, maxLen: 10 },
  { code: "+7", iso: "RU", name: "Russia", flag: "🇷🇺", hint: "Format: 9xx xxx xx xx", minLen: 10, maxLen: 10 },
  { code: "+20", iso: "EG", name: "Egypt", flag: "🇪🇬", hint: "Format: 1x xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+27", iso: "ZA", name: "South Africa", flag: "🇿🇦", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+30", iso: "GR", name: "Greece", flag: "🇬🇷", hint: "Format: 6xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+31", iso: "NL", name: "Netherlands", flag: "🇳🇱", hint: "Format: 6 xxxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+32", iso: "BE", name: "Belgium", flag: "🇧🇪", hint: "Format: 4xx xx xx xx", minLen: 9, maxLen: 9 },
  { code: "+33", iso: "FR", name: "France", flag: "🇫🇷", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+34", iso: "ES", name: "Spain", flag: "🇪🇸", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+36", iso: "HU", name: "Hungary", flag: "🇭🇺", hint: "Format: 20 xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+39", iso: "IT", name: "Italy", flag: "🇮🇹", hint: "Format: 3xx xxx xxxx", minLen: 9, maxLen: 11 },
  { code: "+40", iso: "RO", name: "Romania", flag: "🇷🇴", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+41", iso: "CH", name: "Switzerland", flag: "🇨🇭", hint: "Format: 7x xxx xx xx", minLen: 9, maxLen: 9 },
  { code: "+43", iso: "AT", name: "Austria", flag: "🇦🇹", hint: "Format: 6xx xxxxxx", minLen: 7, maxLen: 13 },
  { code: "+44", iso: "GB", name: "United Kingdom", flag: "🇬🇧", hint: "Format: 07xxx xxxxxx", minLen: 10, maxLen: 10 },
  { code: "+45", iso: "DK", name: "Denmark", flag: "🇩🇰", hint: "Format: xx xx xx xx", minLen: 8, maxLen: 8 },
  { code: "+46", iso: "SE", name: "Sweden", flag: "🇸🇪", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+47", iso: "NO", name: "Norway", flag: "🇳🇴", hint: "Format: xxx xx xxx", minLen: 8, maxLen: 8 },
  { code: "+48", iso: "PL", name: "Poland", flag: "🇵🇱", hint: "Format: xxx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+49", iso: "DE", name: "Germany", flag: "🇩🇪", hint: "Format: 1xx xxxxxxxx", minLen: 10, maxLen: 12 },
  { code: "+51", iso: "PE", name: "Peru", flag: "🇵🇪", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+52", iso: "MX", name: "Mexico", flag: "🇲🇽", hint: "Format: 1xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+54", iso: "AR", name: "Argentina", flag: "🇦🇷", hint: "Format: 9 11 xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+55", iso: "BR", name: "Brazil", flag: "🇧🇷", hint: "Format: 11 9xxxx xxxx", minLen: 10, maxLen: 11 },
  { code: "+56", iso: "CL", name: "Chile", flag: "🇨🇱", hint: "Format: 9 xxxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+57", iso: "CO", name: "Colombia", flag: "🇨🇴", hint: "Format: 3xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+60", iso: "MY", name: "Malaysia", flag: "🇲🇾", hint: "Format: 1x xxxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+61", iso: "AU", name: "Australia", flag: "🇦🇺", hint: "Format: 4xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+62", iso: "ID", name: "Indonesia", flag: "🇮🇩", hint: "Format: 8xx xxxx xxxx", minLen: 9, maxLen: 12 },
  { code: "+63", iso: "PH", name: "Philippines", flag: "🇵🇭", hint: "Format: 9xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+64", iso: "NZ", name: "New Zealand", flag: "🇳🇿", hint: "Format: 2x xxx xxxx", minLen: 8, maxLen: 10 },
  { code: "+65", iso: "SG", name: "Singapore", flag: "🇸🇬", hint: "Format: 8xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+66", iso: "TH", name: "Thailand", flag: "🇹🇭", hint: "Format: 8x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+81", iso: "JP", name: "Japan", flag: "🇯🇵", hint: "Format: 9x xxxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+82", iso: "KR", name: "South Korea", flag: "🇰🇷", hint: "Format: 10x xxxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+84", iso: "VN", name: "Vietnam", flag: "🇻🇳", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 10 },
  { code: "+86", iso: "CN", name: "China", flag: "🇨🇳", hint: "Format: 1xx xxxx xxxx", minLen: 11, maxLen: 11 },
  { code: "+90", iso: "TR", name: "Turkey", flag: "🇹🇷", hint: "Format: 5xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+91", iso: "IN", name: "India", flag: "🇮🇳", hint: "Format: 9xxxx xxxxx", minLen: 10, maxLen: 10 },
  { code: "+92", iso: "PK", name: "Pakistan", flag: "🇵🇰", hint: "Format: 3xx xxxxxxx", minLen: 10, maxLen: 10 },
  { code: "+94", iso: "LK", name: "Sri Lanka", flag: "🇱🇰", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+98", iso: "IR", name: "Iran", flag: "🇮🇷", hint: "Format: 9xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+212", iso: "MA", name: "Morocco", flag: "🇲🇦", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+213", iso: "DZ", name: "Algeria", flag: "🇩🇿", hint: "Format: 5xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+216", iso: "TN", name: "Tunisia", flag: "🇹🇳", hint: "Format: 2x xxx xxx", minLen: 8, maxLen: 8 },
  { code: "+221", iso: "SN", name: "Senegal", flag: "🇸🇳", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+233", iso: "GH", name: "Ghana", flag: "🇬🇭", hint: "Format: 2x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+234", iso: "NG", name: "Nigeria", flag: "🇳🇬", hint: "Format: 8xx xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+237", iso: "CM", name: "Cameroon", flag: "🇨🇲", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+249", iso: "SD", name: "Sudan", flag: "🇸🇩", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+250", iso: "RW", name: "Rwanda", flag: "🇷🇼", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+251", iso: "ET", name: "Ethiopia", flag: "🇪🇹", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+254", iso: "KE", name: "Kenya", flag: "🇰🇪", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+255", iso: "TZ", name: "Tanzania", flag: "🇹🇿", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+256", iso: "UG", name: "Uganda", flag: "🇺🇬", hint: "Format: 7xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+260", iso: "ZM", name: "Zambia", flag: "🇿🇲", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+263", iso: "ZW", name: "Zimbabwe", flag: "🇿🇼", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+351", iso: "PT", name: "Portugal", flag: "🇵🇹", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+352", iso: "LU", name: "Luxembourg", flag: "🇱🇺", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+353", iso: "IE", name: "Ireland", flag: "🇮🇪", hint: "Format: 8x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+358", iso: "FI", name: "Finland", flag: "🇫🇮", hint: "Format: 4x xxx xxxx", minLen: 9, maxLen: 10 },
  { code: "+380", iso: "UA", name: "Ukraine", flag: "🇺🇦", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+420", iso: "CZ", name: "Czech Republic", flag: "🇨🇿", hint: "Format: 6xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+421", iso: "SK", name: "Slovakia", flag: "🇸🇰", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+852", iso: "HK", name: "Hong Kong", flag: "🇭🇰", hint: "Format: xxxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+855", iso: "KH", name: "Cambodia", flag: "🇰🇭", hint: "Format: 1x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+880", iso: "BD", name: "Bangladesh", flag: "🇧🇩", hint: "Format: 1xxx xxxxxx", minLen: 10, maxLen: 10 },
  { code: "+886", iso: "TW", name: "Taiwan", flag: "🇹🇼", hint: "Format: 9xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+961", iso: "LB", name: "Lebanon", flag: "🇱🇧", hint: "Format: 7x xxx xxx", minLen: 7, maxLen: 8 },
  { code: "+962", iso: "JO", name: "Jordan", flag: "🇯🇴", hint: "Format: 7x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+966", iso: "SA", name: "Saudi Arabia", flag: "🇸🇦", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+971", iso: "AE", name: "UAE", flag: "🇦🇪", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+972", iso: "IL", name: "Israel", flag: "🇮🇱", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+973", iso: "BH", name: "Bahrain", flag: "🇧🇭", hint: "Format: 3xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+974", iso: "QA", name: "Qatar", flag: "🇶🇦", hint: "Format: 3xxx xxxx", minLen: 8, maxLen: 8 },
  { code: "+977", iso: "NP", name: "Nepal", flag: "🇳🇵", hint: "Format: 98x xxx xxxx", minLen: 10, maxLen: 10 },
  { code: "+994", iso: "AZ", name: "Azerbaijan", flag: "🇦🇿", hint: "Format: 5x xxx xxxx", minLen: 9, maxLen: 9 },
  { code: "+995", iso: "GE", name: "Georgia", flag: "🇬🇪", hint: "Format: 5xx xxx xxx", minLen: 9, maxLen: 9 },
  { code: "+998", iso: "UZ", name: "Uzbekistan", flag: "🇺🇿", hint: "Format: 9x xxx xxxx", minLen: 9, maxLen: 9 },
];

// ─── Country Code Selector ────────────────────────────────────────────────────

function CountryCodeSelector({ value, onChange }: { value: CountryCode; onChange: (c: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim() ? COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search)) : COUNTRY_CODES;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setSearch(""); } };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: "0.35rem", height: "100%", padding: "0 0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 4, color: "#FFFFFF", cursor: "pointer", fontSize: "0.85rem", whiteSpace: "nowrap", transition: "border-color 0.2s", minWidth: 72 }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D4AF37"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.3)"; }}>
        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{value.flag}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "0.8rem" }}>{value.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, marginLeft: 2 }}><path d="M2 3.5L5 6.5L8 3.5" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 9999, background: "#0d2d52", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 240, maxHeight: 280, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
            <input ref={searchRef} type="text" placeholder="Search country or code…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 4, padding: "0.35rem 0.6rem", color: "#FFFFFF", fontSize: "0.78rem", fontFamily: "'Inter', sans-serif", outline: "none" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? <p style={{ padding: "0.75rem", color: "rgba(230,230,230,0.4)", fontSize: "0.75rem", textAlign: "center" }}>No results</p> : filtered.map((c) => (
              <button key={c.iso} type="button" onClick={() => { onChange(c); setOpen(false); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.45rem 0.75rem", background: value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.1)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent"; }}>
                <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                <span style={{ color: "#D4AF37", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0, minWidth: 36 }}>{c.code}</span>
                <span style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Lead Capture ─────────────────────────────────────────────────────────────

function LeadCaptureScreen({ onContinue }: { onContinue: (data: LeadData) => void }) {
  const [form, setForm] = useState<LeadData>({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
  const [countryCode, setCountryCode] = useState<CountryCode>(detectCountryFromTimezone());
  const [submitted, setSubmitted] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const emailVerifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmailBlur = async () => {
    if (!form.email) return;
    setEmailVerifying(true); setEmailError(""); setEmailSuggestion(""); setEmailVerified(false);
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (result.valid) { setEmailVerified(true); setEmailError(""); }
    else { setEmailError(result.error); setEmailSuggestion(result.suggestion || ""); setEmailVerified(false); }
  };

  const handleEmailChange = (val: string) => {
    setForm({ ...form, email: val }); setEmailVerified(false); setEmailError(""); setEmailSuggestion("");
    if (emailVerifyTimeout.current) clearTimeout(emailVerifyTimeout.current);
  };

  const getPhoneError = (): string => {
    const digits = form.phone.replace(/\D/g, "");
    if (!digits) return "Required";
    if (digits.length < countryCode.minLen) return `A valid ${countryCode.name} number requires at least ${countryCode.minLen} digits`;
    if (digits.length > countryCode.maxLen) return `A valid ${countryCode.name} number has at most ${countryCode.maxLen} digits`;
    return "";
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const phoneErr = getPhoneError();
    if (!form.firstName.trim() || form.firstName.trim().length < 2 || !form.lastName.trim() || form.lastName.trim().length < 2 || phoneErr || !form.company.trim() || !form.role) { setError("Please complete all fields to continue."); return; }
    setEmailVerifying(true); setEmailError(""); setEmailSuggestion("");
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (!result.valid) { setEmailError(result.error); setEmailSuggestion(result.suggestion || ""); setEmailVerified(false); setError("Please fix the errors above to continue."); return; }
    setEmailVerified(true); setError(""); setLoading(true);
    const payload = { event_type: "form_submitted", tags: "AI-Assessment-Lead", first_name: form.firstName, last_name: form.lastName, email: form.email, phone: normalizePhone(countryCode.code + (form.phone || "")), company: form.company, role: form.role };
    saveToLocalStorage("form_submitted", payload);
    await sendWebhookJson(payload, WEBHOOK_LEAD_URL);
    setLoading(false);
    onContinue({ ...form, phone: normalizePhone(countryCode.code + (form.phone || "")), country_name: countryCode.name, country_iso: countryCode.iso });
  };

  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>Before we begin —</h2>
        <p className="text-sm leading-relaxed" style={{ color: "#E6E6E6" }}>Enter your details to receive your personalized results and AI readiness insights.</p>
      </div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>First Name <span style={{ color: "#E53935" }}>*</span></label>
            <input className="dru-input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={submitted && (!form.firstName.trim() || form.firstName.trim().length < 2) ? { borderColor: "#E53935" } : {}} />
            {submitted && !form.firstName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.firstName.trim() && form.firstName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Last Name <span style={{ color: "#E53935" }}>*</span></label>
            <input className="dru-input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={submitted && (!form.lastName.trim() || form.lastName.trim().length < 2) ? { borderColor: "#E53935" } : {}} />
            {submitted && !form.lastName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.lastName.trim() && form.lastName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Email Address <span style={{ color: "#E53935" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <input className="dru-input" type="email" placeholder="your@email.com" value={form.email} onChange={(e) => handleEmailChange(e.target.value)} onBlur={handleEmailBlur} style={{ ...(emailError ? { borderColor: "#E53935" } : {}), ...(emailVerified ? { borderColor: "#4CAF50" } : {}), paddingRight: (emailVerifying || emailVerified) ? "2.5rem" : undefined }} />
            {emailVerifying && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#D4AF37", fontSize: "0.75rem" }}>Checking…</span>}
            {emailVerified && !emailVerifying && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: "1rem" }}>✓</span>}
          </div>
          {emailError && <div className="text-xs mt-1" style={{ color: "#E53935" }}>{emailError}{emailSuggestion && <button type="button" onClick={() => { setForm({ ...form, email: emailSuggestion }); setEmailSuggestion(""); setEmailError(""); }} style={{ marginLeft: "0.5rem", color: "#D4AF37", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}>Use {emailSuggestion}</button>}</div>}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Phone Number <span style={{ color: "#E53935" }}>*</span></label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", borderRadius: 4, ...((submitted || phoneTouched) && getPhoneError() ? { outline: "1px solid #E53935" } : {}) }}>
            <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
            <input className="dru-input" type="tel" placeholder="555 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => setPhoneTouched(true)} style={{ flex: 1, minWidth: 0, ...((submitted || phoneTouched) && getPhoneError() ? { borderColor: "#E53935" } : {}) }} />
          </div>
          {(submitted || phoneTouched) && getPhoneError() ? <p className="text-xs mt-1" style={{ color: "#E53935", fontFamily: "'Inter', sans-serif" }}>{getPhoneError()}</p> : <p className="text-xs mt-1" style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif" }}>{countryCode.hint}</p>}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Company Name <span style={{ color: "#E53935" }}>*</span></label>
          <input className="dru-input" placeholder="Your organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={submitted && !form.company.trim() ? { borderColor: "#E53935" } : {}} />
          {submitted && !form.company.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Your Role / Title <span style={{ color: "#E53935" }}>*</span></label>
          <select className="dru-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ ...(submitted && !form.role ? { borderColor: "#E53935" } : {}), background: "#0A2342", color: form.role ? "#FFFFFF" : "rgba(230,230,230,0.4)", appearance: "auto" as const, cursor: "pointer" }}>
            <option value="" disabled>Select your role...</option>
            <option value="C-Suite Executive">C-Suite Executive</option>
            <option value="VP / Senior Director">VP / Senior Director</option>
            <option value="Director">Director</option>
            <option value="Team Leader">Team Leader</option>
            <option value="Consultant / Advisor">Consultant / Advisor</option>
            <option value="Other">Other</option>
          </select>
          {submitted && !form.role && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
        </div>
      </div>
      {error && <p className="text-sm mb-4" style={{ color: "#E53935" }}>{error}</p>}
      <button className="btn-gold" onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : "Continue →"}</button>
    </div>
  );
}

// ─── Pillar Screen ────────────────────────────────────────────────────────────

interface PillarScreenProps {
  pillarLetter: string; pillarName: string; subtitle: string; progress: number; progressLabel: string;
  questions: string[]; questionStartIndex: number; scores: Scores;
  onScoreChange: (qIndex: number, value: number) => void; onNext: () => void; nextLabel?: string;
}

function PillarScreen({ pillarLetter, pillarName, subtitle, progress, progressLabel, questions, questionStartIndex, scores, onScoreChange, onNext, nextLabel = "Next →" }: PillarScreenProps) {
  const allAnswered = questions.every((_, i) => scores[questionStartIndex + i] && scores[questionStartIndex + i] > 0);
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: "rgba(212,175,55,0.7)" }}>{progressLabel}</span>
          <span className="text-xs" style={{ color: "rgba(230,230,230,0.4)" }}>{progress}%</span>
        </div>
        <div className="progress-bar-track"><div className="progress-bar-fill" style={{ width: `${progress}%` }} /></div>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>{pillarLetter} — {pillarName}</h2>
        <p className="text-sm" style={{ color: "#E6E6E6" }}>{subtitle}</p>
      </div>
      <div className="gold-divider mb-6" />
      <div className="flex-1">{questions.map((q, i) => <ScoreRow key={i} questionNum={questionStartIndex + i + 1} question={q} value={scores[questionStartIndex + i] || 0} onChange={(v) => onScoreChange(questionStartIndex + i, v)} />)}</div>
      <div className="mt-4">
        {!allAnswered && <p className="text-xs text-center mb-3" style={{ color: "rgba(230,230,230,0.4)" }}>Please answer all questions to continue</p>}
        <button className="btn-gold" onClick={onNext} disabled={!allAnswered} style={{ opacity: allAnswered ? 1 : 0.4 }}>{nextLabel}</button>
      </div>
    </div>
  );
}

// ─── Calculating ──────────────────────────────────────────────────────────────

function CalculatingScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="screen-enter flex flex-col items-center justify-center gap-8" style={{ height: "100%", background: "#0A2342", padding: "2rem" }}>
      <div className="gold-spinner" />
      <div className="text-center">
        <p className="text-lg font-medium mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}>Analyzing your responses</p>
        <p className="text-sm" style={{ color: "rgba(230,230,230,0.6)" }}>across all 5 CLEAR™ pillars...</p>
      </div>
    </div>
  );
}

// ─── Results Transition Block ─────────────────────────────────────────────────

function ResultsTransitionBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>What This Means For You</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.78rem", lineHeight: 1.7 }}>Your results highlight key areas across leadership, alignment, execution, and AI readiness. This gives you visibility into where gaps may exist — but not why they exist or how to fix them.</p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginTop: "0.5rem", fontStyle: "italic" }}>Most leaders stay at this stage — aware of the challenges, but without a clear path forward.</p>
      </div>
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>Your Next Step</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.78rem", lineHeight: 1.7 }}>To move forward, the next step is to go deeper — identify root causes, prioritize what matters most, and gain clarity on what actions to take.</p>
      </div>
      <p style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.68rem", textAlign: "center", fontStyle: "italic", marginBottom: "1rem", lineHeight: 1.5 }}>Your results are available for a limited time to ensure accuracy and relevance.</p>
      <button className="btn-magenta" onClick={onContinue} style={{ marginBottom: "0.75rem" }}>Continue to Diagnostic Options →</button>
    </div>
  );
}

// ─── Expired Screen ───────────────────────────────────────────────────────────

function ExpiredScreen({ onRetake }: { onRetake: () => void }) {
  return (
    <div className="screen-enter flex flex-col items-center justify-center" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem", textAlign: "center" }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem", background: "rgba(212,175,55,0.06)" }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" stroke="#D4AF37" strokeWidth="2" strokeOpacity="0.6"/><path d="M16 9v8l4 4" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.8"/></svg>
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.75rem", fontWeight: 700, color: "#D4AF37", marginBottom: "1rem", lineHeight: 1.2 }}>Your Results Have Expired</h2>
      <p style={{ color: "#E6E6E6", fontSize: "0.85rem", lineHeight: 1.7, maxWidth: 320, marginBottom: "0.75rem" }}>Your AI Readiness score is only valid for 48 hours to ensure accuracy and relevance.</p>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 300, marginBottom: "2rem", fontStyle: "italic" }}>To get your most accurate and current results, take the assessment again — it only takes 3 minutes.</p>
      <button className="btn-gold" onClick={onRetake} style={{ maxWidth: 320 }}>Retake My Assessment →</button>
      <div style={{ marginTop: "2rem" }}><DruLogo className="w-36" /></div>
    </div>
  );
}

// ─── Nudge Banner ─────────────────────────────────────────────────────────────

function NudgeBanner({ onDismiss, onBookNow }: { onDismiss: () => void; onBookNow: () => void }) {
  return (
    <div style={{ background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderBottom: "1px solid rgba(212,175,55,0.4)", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", zIndex: 9998 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.04em", marginBottom: 2 }}>Your results expire soon</div>
        <div style={{ color: "rgba(255,255,255,0.65)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem" }}>Your AI Readiness score expires in less than 12 hours.</div>
      </div>
      <button onClick={onBookNow} style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 4, padding: "0.4rem 0.8rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.04em", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>Reserve Now</button>
      <button onClick={onDismiss} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0, padding: "0.25rem" }}>×</button>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({ lead, scores, onBookCall }: { lead: LeadData; scores: Scores; onBookCall: () => void }) {
  const clarityScore = getPillarScore(scores, 0);
  const leadershipScore = getPillarScore(scores, 3);
  const executionScore = getPillarScore(scores, 6);
  const alignmentScore = getPillarScore(scores, 9);
  const resultsScore = getPillarScore(scores, 12);
  const total = clarityScore + leadershipScore + executionScore + alignmentScore + resultsScore;
  const scaledScore = Math.round((total / 75) * 100);
  const tier = getTier(total);
  const pillars = [
    { name: "Clarity", score: clarityScore },
    { name: "Leadership", score: leadershipScore },
    { name: "Execution", score: executionScore },
    { name: "Alignment", score: alignmentScore },
    { name: "Results", score: resultsScore },
  ];
  const sorted = [...pillars].sort((a, b) => a.score - b.score);
  const topGaps = sorted.filter((p) => p.score < 12).slice(0, 2);
  const strongestPillar = [...pillars].sort((a, b) => b.score - a.score)[0];
  const badgeUrl = BADGE_URLS[tier.label];

  const handleBadgeDownload = async () => {
    if (!badgeUrl) return;
    try {
      const res = await fetch(badgeUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `DRU-CLEAR-Badge-${tier.label}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { window.open(badgeUrl, "_blank"); }
  };

  const BENCHMARK_PERCENTILES: Record<string, number> = { EMERGING: 25, DEVELOPING: 52, ADVANCING: 74, LEADING: 93 };
  const percentile = BENCHMARK_PERCENTILES[tier.label];

  const [displayScore, setDisplayScore] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(false);
  const [oneLineVisible, setOneLineVisible] = useState(false);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    const target = scaledScore;
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setDisplayScore(Math.round(easeOutCubic(progress) * target));
      if (progress < 1) { rafId = requestAnimationFrame(tick); }
      else { setTimeout(() => { setBadgeVisible(true); setTimeout(() => setOneLineVisible(true), 200); }, 300); }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const assessmentShareUrl = "https://assessment.druaiconsulting.com";
  const handleShareScore = async () => {
    const shareText = `I just scored ${scaledScore}/100 on the AI Readiness Assessment! Take yours here: ${assessmentShareUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title: "DRU CLEAR™ AI Readiness Score", text: shareText, url: assessmentShareUrl }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareText); } catch { const el = document.createElement("textarea"); el.value = shareText; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
      setShareLinkCopied(true); setTimeout(() => setShareLinkCopied(false), 2000);
    }
  };

  const [pillarsAnimated, setPillarsAnimated] = useState(false);
  const pillarSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = pillarSectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setPillarsAnimated(true); observer.disconnect(); } }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [showScrollHint, setShowScrollHint] = useState(true);
  const [resultsCopied, setResultsCopied] = useState(false);

  const handleCopyResultsLink = () => {
    const refParam = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
    const url = `https://assessment.druaiconsulting.com${refParam}&score=${scaledScore}&result=${tier.label}`;
    navigator.clipboard.writeText(url).then(() => { setResultsCopied(true); setTimeout(() => setResultsCopied(false), 2500); }).catch(() => { const el = document.createElement("textarea"); el.value = url; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); setResultsCopied(true); setTimeout(() => setResultsCopied(false), 2500); });
    sendWebhook({ event_type: "share_click", channel: "clipboard", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  useEffect(() => {
    const onScroll = () => { if (window.scrollY > 60) setShowScrollHint(false); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const confettiCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const COLORS = ["#D4AF37","#F5E27D","#B8860B","#FFD700","#E8C84A","#FFFFFF"];
    const PARTICLE_COUNT = 90;
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; size: number; rotation: number; rotSpeed: number; alpha: number; shape: "rect" | "circle" };
    const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, () => ({ x: Math.random() * canvas.width, y: -10 - Math.random() * 60, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, color: COLORS[Math.floor(Math.random() * COLORS.length)], size: 5 + Math.random() * 7, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.15, alpha: 1, shape: Math.random() > 0.4 ? "rect" : "circle" }));
    let frame = 0; let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.rotation += p.rotSpeed; if (frame > 40) p.alpha = Math.max(0, p.alpha - 0.012); ctx.save(); ctx.globalAlpha = p.alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color; if (p.shape === "rect") { ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); } else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2.5, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); });
      frame++; if (frame < 130) { animId = requestAnimationFrame(draw); } else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    };
    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  // ── Merged webhook — fires once on results screen ─────────────────────────
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const LIKERT_MAP: Record<number, string> = { 1: "Strongly Disagree", 2: "Disagree", 3: "Neutral", 4: "Agree", 5: "Strongly Agree" };
    const answerLabel = (qIndex: number): string => LIKERT_MAP[scores[qIndex]] || "Not answered";
    const scorePct = (total / 75) * 100;
    const scoreCategory = scorePct <= 33 ? "Low" : scorePct <= 66 ? "Medium" : "High";

    const formatTimestamp = (date: Date, tz: string, label: string): string => {
      const datePart = date.toLocaleDateString("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const timePart = date.toLocaleTimeString("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
      const [mo, dy, yr] = datePart.split("/");
      return `${yr}-${mo}-${dy} ${timePart} ${label}`;
    };

    const now = new Date();
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const offsetMin = -now.getTimezoneOffset();
    const offsetHr = Math.floor(Math.abs(offsetMin) / 60);
    const offsetMn = Math.abs(offsetMin) % 60;
    const offsetLabel = `UTC${offsetMin >= 0 ? "+" : "-"}${String(offsetHr).padStart(2, "0")}${offsetMn ? ":" + String(offsetMn).padStart(2, "0") : ""}`;

    const mergedPayload = {
      event_type: "assessment_completed",
      tags: "Assessment-Completed",
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      phone: normalizePhone(lead.phone || ""),
      company: lead.company,
      role: lead.role,
      ai_country_name: lead.country_name || "",
      ai_country_iso: lead.country_iso || "",
      total_score: scaledScore,
      score_category: scoreCategory,
      tier: tier.label,
      // ─── TOP GAPS — Added for GHL custom field mapping ───────────────────
      top_gaps: topGaps.map((g) => g.name).join(", "),
      // ────────────────────────────────────────────────────────────────────
      assessment_status: "completed",
      completed_at_cst: formatTimestamp(now, "America/Chicago", "CST"),
      completed_at_user: formatTimestamp(now, userTz, offsetLabel),
      user_timezone: userTz,
      ...UTM_PARAMS,
      question_1: answerLabel(0), question_2: answerLabel(1), question_3: answerLabel(2),
      question_4: answerLabel(3), question_5: answerLabel(4), question_6: answerLabel(5),
      question_7: answerLabel(6), question_8: answerLabel(7), question_9: answerLabel(8),
      question_10: answerLabel(9), question_11: answerLabel(10), question_12: answerLabel(11),
      question_13: answerLabel(12), question_14: answerLabel(13), question_15: answerLabel(14),
      timestamp: now.toISOString(),
    };

    saveToLocalStorage("assessment_completed", mergedPayload);
    sendWebhookJson(mergedPayload, WEBHOOK_COMPLETE_URL);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", overflowX: "hidden", padding: "clamp(1rem, 4vw, 1.5rem) clamp(0.875rem, 4vw, 1.25rem) 2rem", maxWidth: 480, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <canvas ref={confettiCanvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9999 }} />
      <div className="flex justify-between items-center mb-3">
        <DruLogo className="w-28" />
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 7 of 9</span>
      </div>
      <div className="flex flex-col items-center mb-4" style={{ gap: "0.75rem" }}>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(230,230,230,0.5)" }}>Your Score</p>
          <div className="font-bold" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1, fontSize: "clamp(2.5rem, 12vw, 3rem)" }}>
            {displayScore}<span style={{ color: "rgba(212,175,55,0.5)", fontSize: "clamp(1.25rem, 6vw, 1.5rem)" }}>/100</span>
          </div>
        </div>
        <div className="font-bold tracking-widest px-4 py-2 rounded" style={{ color: tier.color, border: `1.5px solid ${tier.color}`, fontFamily: "'Inter', sans-serif", background: `${tier.color}18`, fontSize: "clamp(0.8rem, 4vw, 1rem)", letterSpacing: "0.12em", opacity: badgeVisible ? 1 : 0, transform: badgeVisible ? "scale(1)" : "scale(0.8)", transition: "opacity 0.4s ease, transform 0.4s ease" }}>{tier.label}</div>
        {(() => { const oneLiner = TIER_ONE_LINERS[tier.label]; if (!oneLiner) return null; return <p style={{ color: oneLiner.color, fontStyle: "italic", fontSize: "clamp(0.78rem, 3.2vw, 0.88rem)", lineHeight: 1.55, textAlign: "center", maxWidth: 320, margin: "0.1rem 0 0", opacity: oneLineVisible ? 1 : 0, transition: "opacity 0.5s ease", fontFamily: "'Lato', sans-serif" }}>{oneLiner.text}</p>; })()}
      </div>
      <div className="flex justify-center mb-4">
        <button onClick={handleShareScore} style={{ display: "flex", alignItems: "center", gap: "0.45rem", padding: "0.65rem 1.4rem", background: `${tier.color}18`, color: tier.color, border: `1.5px solid ${tier.color}60`, borderRadius: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "clamp(0.8rem, 3.5vw, 0.9rem)", letterSpacing: "0.04em", cursor: "pointer", transition: "background 0.2s, border-color 0.2s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${tier.color}30`; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${tier.color}18`; }}>
          {shareLinkCopied ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>Link Copied!</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>Share Your Score</>)}
        </button>
      </div>
      <p className="text-xs text-center mb-4" style={{ color: "rgba(212,175,55,0.75)", fontStyle: "italic", lineHeight: 1.6, padding: "0 0.5rem" }}>You scored higher than <strong style={{ color: "#D4AF37" }}>{percentile}%</strong> of organizations assessed on AI readiness.</p>
      {showScrollHint && (
        <div className="flex flex-col items-center mb-3" style={{ opacity: 1, transition: "opacity 0.4s ease", pointerEvents: "none" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(212,175,55,0.55)", fontFamily: "'Inter', sans-serif", letterSpacing: "0.06em" }}>scroll to see your full results</p>
          <svg className="scroll-chevron" width="20" height="12" viewBox="0 0 20 12" fill="none"><path d="M2 2L10 10L18 2" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
      {badgeUrl && (
        <div className="flex flex-col items-center mb-4" style={{ gap: "0.4rem", position: "relative", zIndex: 1 }}>
          <button onClick={handleBadgeDownload} title="Tap to save & share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "block", width: "100%", maxWidth: 320 }}>
            <img src={badgeUrl} alt={`${tier.label} tier badge`} loading="eager" width="320" height="168" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} style={{ width: "100%", maxWidth: 320, height: "auto", display: "block", borderRadius: 8, border: `1px solid ${tier.color}40`, boxShadow: `0 4px 24px ${tier.color}20` }} />
          </button>
          <p style={{ color: "rgba(212,175,55,0.55)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Tap to save &amp; share</p>
        </div>
      )}
      <div className="gold-divider mb-3" />
      <div className="mb-4" ref={pillarSectionRef}>
        <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Pillar Breakdown</h3>
        <div className="flex flex-col" style={{ gap: "0.6rem" }}>
          {pillars.map((p, i) => (
            <div key={p.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", gap: "0.25rem" }}>
                <span style={{ color: "#E6E6E6", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{p.name[0]} — {p.name}</span>
                <span style={{ color: "#D4AF37", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>{p.score}/15</span>
              </div>
              <div className="pillar-bar-track" style={{ height: 5 }}>
                <div className="pillar-bar-fill" style={{ width: pillarsAnimated ? `${(p.score / 15) * 100}%` : "0%", transition: pillarsAnimated ? `width 0.8s cubic-bezier(0.215, 0.61, 0.355, 1) ${i * 100}ms` : "none" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="gold-divider mb-3" />
      {strongestPillar && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Your Strongest Pillar</h3>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ color: "#43A047", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>★</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>{strongestPillar.name} — {strongestPillar.score}/15</p>
                <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>{STRENGTH_MESSAGES[strongestPillar.name]}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {topGaps.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(212,175,55,0.7)" }}>Top Gap Areas</h3>
          <div className="flex flex-col gap-2">
            {topGaps.map((g) => (
              <div key={g.name} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#D4AF37", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>⚠</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>{g.name} Gap</p>
                    <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>{GAP_MESSAGES[g.name]}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="dru-card mb-4" style={{ padding: "0.75rem 0.875rem" }}>
        <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.8vw, 0.7rem)", lineHeight: 1.7 }}>{TIER_MESSAGES[tier.label]}</p>
      </div>
      <ResultsTransitionBlock onContinue={onBookCall} />
      <button onClick={handleCopyResultsLink} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.65rem 1rem", marginBottom: "1rem", background: resultsCopied ? "rgba(212,175,55,0.12)" : "transparent", color: resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.7)", border: `1px solid ${resultsCopied ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.2s" }}>
        {resultsCopied ? (<><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>LINK COPIED!</>) : (<><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 1H13V5M13 1L7 7M6 3H2C1.44772 3 1 3.44772 1 4V12C1 12.5523 1.44772 13 2 13H10C10.5523 13 11 12.5523 11 12V8" stroke="rgba(212,175,55,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>COPY MY RESULTS LINK</>)}
      </button>
      <p className="text-center mb-4" style={{ color: "#E6E6E6", fontSize: "0.65rem", lineHeight: 1.6, opacity: 0.6, maxWidth: 400, margin: "0 auto 1rem" }}>This assessment is for informational purposes only and does not constitute professional consulting advice. Results are based on your self-reported responses. For a personalized strategy, book a consultation with DRU AI Consulting.</p>
      <div className="flex items-center justify-center gap-3">
        <DruLogo className="w-24" />
        <div>
          <p className="text-xs" style={{ color: "rgba(230,230,230,0.5)" }}>DRU AI Consulting</p>
          <p className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontSize: "0.65rem" }}>DeAnna R. Upshaw — AI Authority</p>
        </div>
      </div>
    </div>
  );
}

// ─── Diagnose Screen ──────────────────────────────────────────────────────────

function DiagnoseScreen({ lead, scores, onSelectStrategic, onSelectExecutive, onSkipToTransformation }: { lead: LeadData; scores: Scores; onSelectStrategic: () => void; onSelectExecutive: () => void; onSkipToTransformation: () => void }) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const tier = getTier(total);
  const scaledScore = Math.round((total / 75) * 100);
  const [selected, setSelected] = useState<"strategic" | "executive" | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={topRef} className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        <DruLogo className="w-36 max-w-full mb-4" />
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.5rem", lineHeight: 1.2 }}>Your Results Are In.</h2>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.1rem", color: "#FFFFFF", marginBottom: "0.75rem" }}>Now It's Time to Turn Insight Into Action.</p>
        <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.78rem", lineHeight: 1.65, maxWidth: 360, margin: "0 auto" }}>Your scorecard revealed important signals across leadership, alignment, execution, and AI readiness. The next step is to go deeper, identify what is slowing progress, and build the right path forward.</p>
      </div>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", marginBottom: "1.25rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "0.75rem 1rem" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Your Score</p>
          <p style={{ color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{scaledScore}<span style={{ fontSize: "0.9rem", color: "rgba(212,175,55,0.5)" }}>/100</span></p>
        </div>
        <div style={{ width: 1, height: 40, background: "rgba(212,175,55,0.2)" }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Tier</p>
          <p style={{ color: tier.color, fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.08em" }}>{tier.label}</p>
        </div>
      </div>
      <div style={{ marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.5rem", fontFamily: "'Montserrat', sans-serif" }}>What Your Score Really Means</p>
        <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.78rem", lineHeight: 1.65 }}>This free scorecard is designed to reveal patterns, not solve them. True transformation requires a deeper look at your leadership alignment, decision readiness, team execution, and business opportunities.</p>
        <p style={{ color: "rgba(230,230,230,0.55)", fontSize: "0.72rem", lineHeight: 1.6, marginTop: "0.5rem", fontStyle: "italic" }}>Without a deeper diagnostic, most organizations stay aware of the gaps but never address the root causes behind them.</p>
      </div>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.35rem", fontFamily: "'Montserrat', sans-serif" }}>Choose Your Next Step</p>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "1rem" }}>Both options help you move beyond general insight into strategic clarity.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>

        {/* Executive Card — BEST VALUE */}
        <div onClick={() => setSelected("executive")} style={{ background: selected === "executive" ? "rgba(212,175,55,0.08)" : "rgba(255,255,255,0.04)", border: `2px solid ${selected === "executive" ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 10, padding: "1.25rem", cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
          <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#C2185B", color: "#FFFFFF", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", padding: "3px 14px", borderRadius: 20, fontFamily: "'Montserrat', sans-serif", whiteSpace: "nowrap" }}>BEST VALUE</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem", marginTop: "0.25rem" }}>
            <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Montserrat', sans-serif" }}>Executive Diagnostic</p>
            <p style={{ color: "#D4AF37", fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>$4,997</p>
          </div>
          <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.72rem", lineHeight: 1.65, marginBottom: "0.75rem" }}>
            A premium executive-level diagnostic designed for leaders prepared to implement clarity, complemented by a 90-day AI Roadmap, facilitated with DRU AI Transformation Pathway™ to progression.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {[
              "Full executive diagnostic (25–35 additional deeper-level Qs)",
              "Review of The DRU AI Leadership Ecosystem™ Four Frameworks",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#D4AF37", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ color: "#E6E6E6", fontSize: "0.7rem", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                <span style={{ color: "#E6E6E6", fontSize: "0.7rem", lineHeight: 1.5 }}>5C Cultural DNA™ · 5D Leadership™</span>
                <span style={{ color: "#E6E6E6", fontSize: "0.7rem", lineHeight: 1.5 }}>AI Sales Mastery™ · DRU CLEAR™ Flagship Framework</span>
              </div>
            </div>
            {[
              "Executive AI Alignment Report (boardroom-ready)",
              "Comprehensive gap analysis, including risk assessment and identification of opportunity layers",
              "120-min Zoom executive briefing",
              "Executive-level recommendations + sequencing",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#D4AF37", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ color: "#E6E6E6", fontSize: "0.7rem", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          <button className="btn-magenta" onClick={(e) => { e.stopPropagation(); onSelectExecutive(); }} style={{ fontSize: "0.82rem" }}>Choose Executive Diagnostic →</button>
          <p style={{ color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", textAlign: "center", marginTop: "0.4rem", fontStyle: "italic" }}>Leadership teams opt for this choice because it provides them with both the insight and the strategic plan.</p>
        </div>

        {/* Strategic Card */}
        <div onClick={() => setSelected("strategic")} style={{ background: selected === "strategic" ? "rgba(212,175,55,0.06)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${selected === "strategic" ? "rgba(212,175,55,0.6)" : "rgba(212,175,55,0.2)"}`, borderRadius: 10, padding: "1.25rem", cursor: "pointer", transition: "all 0.2s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
            <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem", fontFamily: "'Montserrat', sans-serif" }}>Strategic Diagnostic</p>
            <p style={{ color: "#D4AF37", fontSize: "1.4rem", fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>$3,497</p>
          </div>
          <p style={{ color: "rgba(230,230,230,0.7)", fontSize: "0.72rem", lineHeight: 1.65, marginBottom: "0.75rem" }}>
            Strategic clarity, leadership, and AI choices. A thorough diagnostic designed to help leaders identify the fundamental gaps that affect alignment, execution, facilitated with DRU AI Transformation Pathway™
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "0.75rem" }}>
            {[
              "Expanded diagnostic (20–25 additional deeper-level Qs)",
              "Review of The DRU AI Leadership Ecosystem™ Two Frameworks",
              "5D Leadership™ · DRU CLEAR™ Flagship Framework",
              "Strategic AI Insight Report",
              "Top five gaps and priority ranking",
              "90-min Zoom strategy session",
              "Priority findings and strategic direction",
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "rgba(212,175,55,0.7)", fontSize: "0.7rem", marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ color: "rgba(230,230,230,0.8)", fontSize: "0.7rem", lineHeight: 1.5 }}>{item}</span>
              </div>
            ))}
          </div>
          <button className="btn-magenta" onClick={(e) => { e.stopPropagation(); onSelectStrategic(); }} style={{ fontSize: "0.82rem" }}>Choose Strategic Diagnostic →</button>
          <p style={{ color: "rgba(230,230,230,0.45)", fontSize: "0.65rem", textAlign: "center", marginTop: "0.4rem", fontStyle: "italic" }}>Leadership teams choose this option to gain strategic clarity and identify exactly where to focus first.</p>
        </div>
      </div>

      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.875rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.4rem", fontFamily: "'Montserrat', sans-serif" }}>Why Upgrade From the Free Scorecard?</p>
        <p style={{ color: "rgba(230,230,230,0.7)", fontSize: "0.72rem", lineHeight: 1.65 }}>The free scorecard highlights <em>what</em> may be happening. The diagnostic identifies <em>why</em> it is happening, what it is costing you, and what to do next.</p>
      </div>

      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <button onClick={onSkipToTransformation} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.65)", fontSize: "0.75rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600 }}>→ Not ready yet? Continue to Share Your Results</button>
      </div>
    </div>
  );
}

// ─── Payment Screen ───────────────────────────────────────────────────────────

function PaymentScreen({ tier, price, paymentUrl, onBack }: { tier: "strategic" | "executive"; price: string; paymentUrl: string; onBack: () => void }) {
  const isExecutive = tier === "executive";
  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "rgba(212,175,55,0.7)", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, textAlign: "left", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>← Back to Options</button>
      <DruLogo className="w-32 max-w-full mb-4" />
      <div style={{ background: "rgba(255,255,255,0.04)", border: `1.5px solid ${isExecutive ? "#D4AF37" : "rgba(212,175,55,0.3)"}`, borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        {isExecutive && <div style={{ background: "#C2185B", color: "#FFFFFF", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", padding: "3px 10px", borderRadius: 20, fontFamily: "'Montserrat', sans-serif", display: "inline-block", marginBottom: "0.5rem" }}>BEST VALUE</div>}
        <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.95rem", fontFamily: "'Montserrat', sans-serif", marginBottom: "0.25rem" }}>{isExecutive ? "Executive Diagnostic + 90-Day AI Roadmap" : "Strategic Diagnostic"}</p>
        <p style={{ color: "#D4AF37", fontSize: "1.5rem", fontWeight: 700, fontFamily: "'Playfair Display', serif", marginBottom: "0.75rem" }}>{price}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {(isExecutive ? ["Full executive diagnostic (25–35 Qs)","Full ecosystem review","Executive AI Alignment Report","Custom 90-Day AI Roadmap","90-min executive briefing"] : ["Expanded diagnostic (20–25 Qs)","Strategic Insight Report","Top 5 priority gaps","90-min strategy session"]).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", flexShrink: 0 }}>✓</span>
              <span style={{ color: "rgba(230,230,230,0.8)", fontSize: "0.72rem" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>Complete Your Payment</p>
      <iframe src={paymentUrl} style={{ width: "100%", minHeight: 600, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, background: "#FFFFFF", marginBottom: "1rem" }} title="Secure Payment" allow="payment" />
      <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", textAlign: "center", lineHeight: 1.5 }}>🔒 Secure payment powered by Stripe. Your information is encrypted and protected.</p>
    </div>
  );
}

// ─── Thank You Purchase Screen ────────────────────────────────────────────────

function ThankYouPurchaseScreen({ lead, tier, calendarUrl, onContinue }: { lead: LeadData; tier: "strategic" | "executive"; calendarUrl: string; onContinue: () => void }) {
  const isExecutive = tier === "executive";

  const nextSteps = isExecutive ? [
    "Book your session using the calendar below",
    "You'll receive a confirmation email with your Zoom link",
    "Review your scorecard results before the call",
    "You'll receive a brief pre-session questionnaire to maximize on our time together",
    "Receive your custom 90-Day AI Roadmap within 48 hours after your session",
  ] : [
    "Book your session using the calendar below",
    "You'll receive a confirmation email with your Zoom link",
    "Review your scorecard results before the call",
    "You'll receive a brief pre-session questionnaire to maximize on our time together",
    "Receive your Strategic Insight Report within 48 hours after your session",
  ];

  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <DruLogo className="w-32" />
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(212,175,55,0.08)", boxShadow: "0 0 0 4px rgba(212,175,55,0.08)" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      </div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#D4AF37", marginBottom: "0.75rem", lineHeight: 1.2, textAlign: "center" }}>
        Thank You, Payment Confirmed
      </h2>
      <p style={{ color: "#E6E6E6", fontSize: "0.82rem", lineHeight: 1.7, maxWidth: 340, margin: "0 auto 1.5rem", textAlign: "center" }}>
        {isExecutive
          ? "You are one step closer towards your vision. Book your 120-minute executive briefing below and we'll begin to design your future."
          : "You are one step closer towards your vision. Book your 90-minute strategy session below and we'll begin to design your future."}
      </p>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.18)", borderRadius: 8, padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>What Happens Next</p>
        {nextSteps.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", marginBottom: "0.6rem" }}>
            <span style={{ background: "#D4AF37", color: "#0A2342", fontSize: "0.55rem", fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
            <span style={{ color: "rgba(230,230,230,0.85)", fontSize: "0.75rem", lineHeight: 1.55 }}>{item}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.65, textAlign: "center", fontStyle: "italic", marginBottom: "1.5rem" }}>
        We look forward to partnering with you and adding value.
      </p>
      <div className="gold-divider" style={{ marginBottom: "1.25rem" }} />
      <p style={{ color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "'Montserrat', sans-serif" }}>
        Book Your Session
      </p>
      <iframe
        src={calendarUrl}
        style={{ width: "100%", minHeight: 580, border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8, background: "#FFFFFF", marginBottom: "0.75rem" }}
        title="Book Your Session"
      />
      <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", marginBottom: "1.5rem", lineHeight: 1.5, textAlign: "center" }}>
        Having trouble? <a href={calendarUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#D4AF37", textDecoration: "underline" }}>Open booking page</a>
      </p>
      <button onClick={onContinue} style={{ background: "transparent", border: "none", color: "rgba(212,175,55,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", marginBottom: "1.5rem", display: "block", margin: "0 auto 1.5rem" }}>
        Continue to Share Your Results →
      </button>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.4)", fontSize: "0.65rem" }}>
          Questions? <a href="mailto:support@replies.druaiconsulting.com" style={{ color: "#D4AF37" }}>support@replies.druaiconsulting.com</a>
        </p>
      </div>
    </div>
  );
}

// ─── Share Your Excitement Screen ─────────────────────────────────────────────

function ShareYourExcitementScreen({ lead, scores, onRevisit }: { lead: LeadData; scores: Scores; onRevisit: () => void }) {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const tier = getTier(total);
  const scaledScore = Math.round((total / 75) * 100);

  const refParam = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
  const assessmentUrl = `https://assessment.druaiconsulting.com${refParam}`;
  const shareText = `I just completed my AI Readiness Assessment by DRU AI Consulting and scored ${scaledScore}/100. See how ready YOUR business is for AI — take the free assessment here: ${assessmentUrl}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(assessmentUrl)}&summary=${encodeURIComponent(shareText)}`;
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const linkedInCaption = `Just completed the DRU CLEAR™ AI Readiness Scorecard by DRU AI Consulting and scored ${scaledScore}/100 — ${tier.label} tier.\n\nIf you're a leader wondering whether your organization is truly AI-ready, this 3-minute assessment is worth your time.\n\nTake it here: ${assessmentUrl}\n\n#AIReadiness #DRUClear #AILeadership #DigitalTransformation`;
  const whatsAppCaption = `Hey! I just took the DRU CLEAR™ AI Readiness Scorecard and scored ${scaledScore}/100 (${tier.label} tier). It's a free 3-min assessment that shows how AI-ready your business really is. Worth a look: ${assessmentUrl}`;

  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [colleagueEmail, setColleagueEmail] = useState("");
  const [colleagueSent, setColleagueSent] = useState(false);
  const [colleagueError, setColleagueError] = useState("");
  const [shareConfirmChannel, setShareConfirmChannel] = useState<string | null>(null);
  const shareConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expandedCaption, setExpandedCaption] = useState<string | null>(null);
  const badgeUrl = BADGE_URLS[tier.label];

  const showShareConfirm = (channel: string) => {
    if (shareConfirmTimer.current) clearTimeout(shareConfirmTimer.current);
    setShareConfirmChannel(channel);
    shareConfirmTimer.current = setTimeout(() => setShareConfirmChannel(null), 3500);
  };

  const fireShareWebhook = (channel: string) => {
    showShareConfirm(channel);
    sendWebhook({ event_type: "share_click", channel, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareText); } catch { const el = document.createElement("textarea"); el.value = shareText; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
    sendWebhook({ event_type: "link_copied", channel: "clipboard", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
    fireShareWebhook("clipboard");
  };

  const handleCopyCaption = async (text: string, channel: string) => {
    try { await navigator.clipboard.writeText(text); } catch { const el = document.createElement("textarea"); el.value = text; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    sendWebhook({ event_type: "caption_copied", channel, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const handleColleagueSend = () => {
    if (!colleagueEmail.trim()) { setColleagueError("Please enter an email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(colleagueEmail.trim())) { setColleagueError("Please enter a valid email address."); return; }
    setColleagueError("");
    sendWebhook({ event_type: "referral_email_sent", referrer_email: lead.email, referrer_name: `${lead.firstName} ${lead.lastName}`, referred_email: colleagueEmail.trim(), referral_link: assessmentUrl, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
    setColleagueSent(true);
  };

  const handleFeedback = (rating: "up" | "down") => {
    if (feedback) return;
    setFeedback(rating);
    sendWebhook({ event_type: "feedback", rating, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const shareBtnStyle = (color: string): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: `${color}14`, color: color, border: `1.5px solid ${color}50`, borderRadius: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", textDecoration: "none" });

  return (
    <div className="screen-enter flex flex-col items-center" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", textAlign: "center" }}>
      <div className="flex justify-between items-center w-full mb-4" style={{ maxWidth: 360 }}>
        <DruLogo className="w-28" />
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 9 of 9</span>
      </div>
      <div style={{ width: 72, height: 72, minWidth: 72, minHeight: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem", background: "rgba(212,175,55,0.08)", flexShrink: 0 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1.2, maxWidth: 340 }}>Lead the AI Conversation</h2>
      <p className="text-base mb-2 max-w-xs" style={{ color: "#E6E6E6", lineHeight: 1.6 }}>Position yourself as an AI-forward leader. Share your results, invite others to assess their readiness, and expand the conversation.</p>
      <p className="text-xs mb-6 max-w-xs" style={{ color: "rgba(212,175,55,0.7)", fontStyle: "italic", lineHeight: 1.6 }}>Leaders across industries are using this assessment to benchmark their AI readiness.</p>
      {badgeUrl && (
        <div className="flex flex-col items-center" style={{ gap: "0.4rem", marginBottom: "1.5rem", width: "100%", maxWidth: 340, position: "relative", zIndex: 1 }}>
          <button onClick={async () => { try { const res = await fetch(badgeUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `DRU-CLEAR-Badge-${tier.label}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch { window.open(badgeUrl, "_blank"); } }} title="Tap to save & share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
            <img src={badgeUrl} alt={`${tier.label} tier badge`} loading="eager" style={{ width: "100%", maxWidth: 340, height: "auto", display: "block", borderRadius: 8, border: `1px solid ${tier.color}40`, boxShadow: `0 4px 24px ${tier.color}20` }} />
          </button>
          <p style={{ color: "rgba(212,175,55,0.55)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Save your badge and share your AI readiness score</p>
        </div>
      )}
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>SPREAD THE WORD</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "0.5rem" }}>Know a leader who should take this? Share your link or send it directly.</p>
        <p style={{ color: "rgba(212,175,55,0.65)", fontSize: "0.72rem", fontStyle: "italic", lineHeight: 1.5, marginBottom: "1rem" }}>Your unique referral link is automatically included in every share.</p>
        <div className="flex flex-col gap-2 mb-3">
          <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={shareBtnStyle("#0A66C2")} onClick={() => fireShareWebhook("linkedin")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Share on LinkedIn
          </a>
          <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" style={shareBtnStyle("#25D366")} onClick={() => fireShareWebhook("whatsapp")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Share on WhatsApp
          </a>
          <button onClick={handleCopyLink} style={shareBtnStyle("#FFFFFF")}>
            {copied ? (<><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Link Copied!</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Copy My Referral Link</>)}
          </button>
        </div>
        {shareConfirmChannel && (
          <div style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 6, padding: "0.5rem 0.75rem", marginBottom: "0.75rem", textAlign: "center" }}>
            <p style={{ color: "#D4AF37", fontSize: "0.75rem", margin: 0 }}>✓ Shared via {shareConfirmChannel}! Your referral link is included.</p>
          </div>
        )}
        <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 6, padding: "0.65rem 0.75rem", marginBottom: "0.5rem" }}>
          <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.72rem", lineHeight: 1.6, margin: 0 }}>When someone completes the assessment using your link, it's tracked to you.</p>
          <p style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.68rem", fontStyle: "italic", lineHeight: 1.5, marginTop: "0.35rem", marginBottom: 0 }}>Top referrers may receive exclusive access, private sessions, or strategic bonuses.</p>
        </div>
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>READY-MADE COPY <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.63rem", color: "rgba(230,230,230,0.45)" }}>(Tap to expand)</span></p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.72rem", marginBottom: "0.75rem" }}>Use the captions below to quickly share your results across platforms.</p>
        {[{ id: "linkedin", label: "LinkedIn", color: "#0A66C2", caption: linkedInCaption }, { id: "whatsapp", label: "WhatsApp", color: "#25D366", caption: whatsAppCaption }].map((ch) => (
          <div key={ch.id} style={{ marginBottom: "0.65rem" }}>
            <button onClick={() => setExpandedCaption(expandedCaption === ch.id ? null : ch.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.55rem 0.75rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: expandedCaption === ch.id ? "6px 6px 0 0" : 6, color: "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
              <span style={{ color: ch.color }}>{ch.label}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expandedCaption === ch.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><path d="M2 4L6 8L10 4" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {expandedCaption === ch.id && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "0.65rem 0.75rem" }}>
                <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.7rem", lineHeight: 1.6, marginBottom: "0.5rem", whiteSpace: "pre-line" }}>{ch.caption}</p>
                <button onClick={() => handleCopyCaption(ch.caption, ch.id)} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.75rem", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 4, color: "#D4AF37", fontSize: "0.7rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}>Copy Caption</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Send This to a Colleague</p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>Enter their email and we'll send them your personalized assessment link.</p>
        {!colleagueSent ? (
          <>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="dru-input" type="email" placeholder="colleague@company.com" value={colleagueEmail} onChange={(e) => { setColleagueEmail(e.target.value); setColleagueError(""); }} style={{ flex: 1 }} />
              <button onClick={handleColleagueSend} style={{ padding: "0 1rem", background: "#D4AF37", color: "#0A2342", border: "none", borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap" }}>Send →</button>
            </div>
            {colleagueError && <p style={{ color: "#E53935", fontSize: "0.7rem", marginTop: "0.35rem" }}>{colleagueError}</p>}
          </>
        ) : (
          <div style={{ background: "rgba(67,160,71,0.1)", border: "1px solid rgba(67,160,71,0.3)", borderRadius: 6, padding: "0.65rem 0.75rem" }}>
            <p style={{ color: "#43A047", fontSize: "0.78rem", margin: 0 }}>✓ Invite sent! Your referral link was included.</p>
          </div>
        )}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.75rem" }}>Was this assessment helpful?</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={() => handleFeedback("up")} disabled={!!feedback} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.25rem", background: feedback === "up" ? "rgba(67,160,71,0.15)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${feedback === "up" ? "#43A047" : "rgba(255,255,255,0.15)"}`, borderRadius: 6, color: feedback === "up" ? "#43A047" : "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: feedback ? "default" : "pointer", transition: "all 0.2s" }}>👍 Yes</button>
          <button onClick={() => handleFeedback("down")} disabled={!!feedback} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.25rem", background: feedback === "down" ? "rgba(229,57,53,0.1)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${feedback === "down" ? "#E53935" : "rgba(255,255,255,0.15)"}`, borderRadius: 6, color: feedback === "down" ? "#E53935" : "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: feedback ? "default" : "pointer", transition: "all 0.2s" }}>👎 Not Really</button>
        </div>
        {feedback && <p style={{ color: "rgba(212,175,55,0.7)", fontSize: "0.72rem", marginTop: "0.5rem", fontStyle: "italic" }}>{feedback === "up" ? "Thank you! We're glad it was helpful." : "Thank you for your feedback — we'll keep improving."}</p>}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.75rem", textAlign: "center" }}>
        <button onClick={onRevisit} style={{ background: "none", border: "none", color: "#D4AF37", fontWeight: 700, fontSize: "0.82rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>→ Revisit Your Diagnostic Options</button>
      </div>
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1rem", textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", marginBottom: "0.25rem" }}>Created by DeAnna R. Upshaw — AI Authority</p>
        <a href="https://druaiconsulting.com" target="_blank" rel="noopener noreferrer" style={{ color: "#D4AF37", fontSize: "0.72rem", textDecoration: "underline", textUnderlineOffset: 3 }}>druaiconsulting.com</a>
      </div>
    </div>
  );
}

// ─── Session Storage ──────────────────────────────────────────────────────────

const PROGRESS_KEY = "dru_clear_progress";
const RESUMABLE_SCREENS: Screen[] = ["lead-capture","clarity","leadership","execution","alignment","results-pillar"];

function saveProgress(screen: Screen, lead: LeadData, scores: Scores): void {
  try { sessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ screen, lead, scores, savedAt: new Date().toISOString() })); } catch {}
}

function loadProgress(): { screen: Screen; lead: LeadData; scores: Scores } | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.screen || !RESUMABLE_SCREENS.includes(parsed.screen)) return null;
    return parsed;
  } catch { return null; }
}

function clearProgress(): void {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch {}
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function DruClearApp() {
  const saved = loadProgress();
  const [screen, setScreen] = useState<Screen>(saved?.screen ?? "splash");
  const [lead, setLead] = useState<LeadData>(saved?.lead ?? { firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
  const [scores, setScores] = useState<Scores>(saved?.scores ?? {});
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const expiryStatus = getExpiryStatus();

  const ua = navigator.userAgent;
  const isInStandaloneMode = (window.navigator as any).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  const isMobile = isIos || isAndroid;
  const isSamsungBrowser = /samsungbrowser/i.test(ua);
  const isFirefox = /firefox/i.test(ua) && !/seamonkey/i.test(ua);
  const isEdgeBrowser = /edg\//i.test(ua);
  const isOperaBrowser = /opr\//i.test(ua) || /opera/i.test(ua);
  const isChromeBased = /chrome/i.test(ua) && !/edg\//i.test(ua) && !/samsungbrowser/i.test(ua) && !/opr\//i.test(ua);
  const isIosChrome = isIos && /crios/i.test(ua);
  const isIosFirefox = isIos && /fxios/i.test(ua);
  const isIosEdge = isIos && /edgios/i.test(ua);
  const isIosSafari = isIos && !isIosChrome && !isIosFirefox && !isIosEdge;
  const isDesktop = !isMobile;
  const isDesktopChrome = isDesktop && isChromeBased;
  const isDesktopEdge = isDesktop && isEdgeBrowser;
  const isDesktopFirefox = isDesktop && isFirefox;

  type BrowserInstallInfo = { label: string; steps: string[]; note?: string };
  const getBrowserInstallInfo = (): BrowserInstallInfo | null => {
    if (isInStandaloneMode) return null;
    if (isIosChrome) return { label: "Chrome on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Chrome", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"], note: "The Share button is in Chrome's bottom toolbar." };
    if (isIosFirefox) return { label: "Firefox on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Firefox", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isIosEdge) return { label: "Edge on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Edge", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isIosSafari) return { label: "Safari on iPhone/iPad", steps: ["Tap the Share button (↑) at the bottom of Safari", "Scroll down and tap \"Add to Home Screen\"", "Tap \"Add\" to confirm"] };
    if (isSamsungBrowser) return { label: "Samsung Internet", steps: ["Tap the ☰ menu icon (bottom right)", "Tap \"Add page to\"", "Tap \"Home screen\" and confirm"] };
    if (isFirefox && isAndroid) return { label: "Firefox on Android", steps: ["Tap the ⋯ menu (top right)", "Tap \"Install\"", "Tap \"Add\" to confirm"] };
    if (isEdgeBrowser && isAndroid) return { label: "Edge on Android", steps: ["Tap the ⋯ menu (bottom center)", "Tap \"Add to phone\"", "Tap \"Install\" to confirm"] };
    if (isOperaBrowser && isAndroid) return { label: "Opera on Android", steps: ["Tap the ⋯ menu (bottom right)", "Tap \"Home screen\"", "Tap \"Add\" to confirm"] };
    if (isDesktopChrome) return { label: "Chrome on Desktop", steps: ["Click the install icon (⤓) in the address bar", "Click \"Install\" to confirm"], note: "If no install icon appears, click ⋮ → Save and share → Install page as app." };
    if (isDesktopEdge) return { label: "Edge on Desktop", steps: ["Click the install icon in the address bar", "Click \"Install\" to confirm"], note: "Or click ⋯ → Apps → Install this site as an app." };
    if (isDesktopFirefox) return { label: "Firefox on Desktop", steps: ["Click the install icon (⤓) in the address bar if visible", "Or open Firefox menu (≡) and click \"Install\"", "Click \"Add\" to confirm"], note: "Firefox desktop PWA support requires Firefox 116 or later." };
    return null;
  };

  const browserInstallInfo = getBrowserInstallInfo();
  const needsManualInstructions = browserInstallInfo !== null;
  const [installPromptEvent, setInstallPromptEvent] = useState<Event | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showUpdateAvailable, setShowUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installDismissed, setInstallDismissed] = useState(() => { try { return localStorage.getItem("dru_install_dismissed") === "1"; } catch { return false; } });
  const [showManualBanner, setShowManualBanner] = useState(false);
  const [manualBannerDismissed] = useState(() => { try { return localStorage.getItem("dru_manual_install_dismissed") === "1"; } catch { return false; } });

  const dismissManualBanner = () => { setShowManualBanner(false); try { localStorage.setItem("dru_manual_install_dismissed", "1"); } catch {} };

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPromptEvent(e); if (!installDismissed) setShowInstallBanner(true); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [installDismissed]);

  const handleInstall = async () => {
    if (!installPromptEvent) return;
    (installPromptEvent as any).prompt();
    const { outcome } = await (installPromptEvent as any).userChoice;
    if (outcome === "accepted") { setShowInstallBanner(false); setInstallPromptEvent(null); }
  };

  const dismissInstallBanner = () => { setShowInstallBanner(false); setInstallDismissed(true); try { localStorage.setItem("dru_install_dismissed", "1"); } catch {} };

  useEffect(() => {
    if (needsManualInstructions && !isInStandaloneMode && !manualBannerDismissed && (screen === "results" || screen === "share-your-excitement")) {
      const timer = setTimeout(() => setShowManualBanner(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, needsManualInstructions, isInStandaloneMode, manualBannerDismissed]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        if (reg.waiting) { setWaitingWorker(reg.waiting); setShowUpdateAvailable(true); }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => { if (newWorker.state === "installed" && navigator.serviceWorker.controller) { setWaitingWorker(newWorker); setShowUpdateAvailable(true); } });
        });
      }).catch(() => {});
    }
    flushWebhookQueue();
  }, []);

  useEffect(() => {
    const handleInstalled = () => { sendWebhook({ event_type: "pwa_installed", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, phone: normalizePhone(lead.phone || ""), ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", company: lead.company, role: lead.role, browser: navigator.userAgent, platform: navigator.platform || "", ...UTM_PARAMS, timestamp: new Date().toISOString() }); };
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, [lead]);

  useEffect(() => {
    if (screen === "results") saveExpiryTimestamp();
    if (screen === "splash") clearExpiryTimestamp();
  }, [screen]);

  useEffect(() => {
    if (RESUMABLE_SCREENS.includes(screen)) { saveProgress(screen, lead, scores); }
    else if (screen === "results" || screen === "calculating") { clearProgress(); }
  }, [screen, lead, scores]);

  const updateScore = (qIndex: number, value: number) => { setScores((prev) => ({ ...prev, [qIndex]: value })); };
  const appRef = useRef<HTMLDivElement>(null);
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const goTo = (s: Screen) => {
    setScreen(s);
    setTimeout(() => {
      topAnchorRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }, 50);
  };

  return (
    <div ref={appRef} style={{ minHeight: "100dvh", width: "100%", background: "#0A2342", display: "flex", flexDirection: "column", overflowX: "hidden", position: "relative" }}>
      <div ref={topAnchorRef} style={{ height: 0, overflow: "hidden", position: "absolute", top: 0, left: 0 }} aria-hidden="true" />
      <div key={screen} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {screen === "splash" && <SplashScreen onDone={() => goTo("welcome")} />}
      {screen === "welcome" && <WelcomeScreen onStart={() => goTo("lead-capture")} />}
      {screen === "lead-capture" && <LeadCaptureScreen onContinue={(data) => { setLead(data); goTo("clarity"); }} />}
      {screen === "clarity" && <PillarScreen pillarLetter="C" pillarName="CLARITY" subtitle="AI Vision & Strategic Direction" progress={20} progressLabel="Pillar 1 of 5" questions={["Our organization has a clearly defined AI vision that connects to our overall business strategy.","Leaders and teams across the organization understand why we are pursuing AI and what success looks like.","We have identified specific strategic priorities where AI will have the greatest business impact."]} questionStartIndex={0} scores={scores} onScoreChange={updateScore} onNext={() => goTo("leadership")} />}
      {screen === "leadership" && <PillarScreen pillarLetter="L" pillarName="LEADERSHIP" subtitle="Executive AI Fluency & Sponsorship" progress={40} progressLabel="Pillar 2 of 5" questions={["Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.","There is a designated executive sponsor who is accountable for driving AI transformation.","Our leadership team actively participates in AI learning, development, and decision-making."]} questionStartIndex={3} scores={scores} onScoreChange={updateScore} onNext={() => goTo("execution")} />}
      {screen === "execution" && <PillarScreen pillarLetter="E" pillarName="EXECUTION" subtitle="Operational AI Implementation Capacity" progress={60} progressLabel="Pillar 3 of 5" questions={["We have identified specific business processes where AI can deliver measurable impact.","Our teams have the skills, tools, and resources needed to implement AI solutions today.","We have completed at least one AI pilot or proof of concept in the past 12 months."]} questionStartIndex={6} scores={scores} onScoreChange={updateScore} onNext={() => goTo("alignment")} />}
      {screen === "alignment" && <PillarScreen pillarLetter="A" pillarName="ALIGNMENT" subtitle="Cross-Functional Strategic Coherence" progress={80} progressLabel="Pillar 4 of 5" questions={["Our AI initiatives are aligned with our overall business goals and strategic plan.","There is clear and consistent communication between departments about AI priorities and progress.","Our AI efforts are coordinated across teams and business units rather than operating in silos."]} questionStartIndex={9} scores={scores} onScoreChange={updateScore} onNext={() => goTo("results-pillar")} />}
      {screen === "results-pillar" && <PillarScreen pillarLetter="R" pillarName="RESULTS" subtitle="Measurement, Tracking & Return on Investment" progress={100} progressLabel="Pillar 5 of 5" questions={["We have defined clear Key Performance Indicators to measure the success of our AI initiatives.","We can demonstrate measurable return on investment from at least one AI-related initiative.","We have a system in place to regularly track and report AI progress to leadership."]} questionStartIndex={12} scores={scores} onScoreChange={updateScore} onNext={() => goTo("calculating")} nextLabel="See My Results →" />}
      {screen === "calculating" && <CalculatingScreen onDone={() => goTo("results")} />}

      {screen === "results" && expiryStatus === "expired" && <ExpiredScreen onRetake={() => { clearExpiryTimestamp(); clearProgress(); setScores({}); setLead({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" }); goTo("welcome"); }} />}
      {screen === "results" && expiryStatus !== "expired" && (
        <>
          {expiryStatus === "nudge" && !nudgeDismissed && <NudgeBanner onDismiss={() => setNudgeDismissed(true)} onBookNow={() => goTo("diagnose")} />}
          <ResultsScreen lead={lead} scores={scores} onBookCall={() => goTo("diagnose")} />
        </>
      )}

      {screen === "diagnose" && expiryStatus === "expired" && <ExpiredScreen onRetake={() => { clearExpiryTimestamp(); clearProgress(); setScores({}); setLead({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" }); goTo("welcome"); }} />}
      {screen === "diagnose" && expiryStatus !== "expired" && (
        <>
          {expiryStatus === "nudge" && !nudgeDismissed && <NudgeBanner onDismiss={() => setNudgeDismissed(true)} onBookNow={() => goTo("diagnose")} />}
          <DiagnoseScreen lead={lead} scores={scores} onSelectStrategic={() => goTo("payment-strategic")} onSelectExecutive={() => goTo("payment-executive")} onSkipToTransformation={() => goTo("share-your-excitement")} />
        </>
      )}
      {screen === "payment-strategic" && (() => { window.location.href = PAYMENT_STRATEGIC_URL; return null; })()}
      {screen === "payment-executive" && (() => { window.location.href = PAYMENT_EXECUTIVE_URL; return null; })()}
      {screen === "thankyou-strategic" && <ThankYouPurchaseScreen lead={lead} tier="strategic" calendarUrl={CALENDAR_STRATEGIC_URL} onContinue={() => goTo("share-your-excitement")} />}
      {screen === "thankyou-executive" && <ThankYouPurchaseScreen lead={lead} tier="executive" calendarUrl={CALENDAR_EXECUTIVE_URL} onContinue={() => goTo("share-your-excitement")} />}
      {screen === "expired" && <ExpiredScreen onRetake={() => { clearExpiryTimestamp(); clearProgress(); setScores({}); setLead({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" }); goTo("welcome"); }} />}
      {screen === "share-your-excitement" && <ShareYourExcitementScreen lead={lead} scores={scores} onRevisit={() => goTo("diagnose")} />}
      </div>

      {/* PWA Update Banner */}
      {showUpdateAvailable && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderBottom: "1px solid rgba(212,175,55,0.4)", padding: "0.75rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em" }}>Update available</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem" }}>A new version of DRU CLEAR™ is ready</div>
          </div>
          <button onClick={() => { waitingWorker?.postMessage({ type: "SKIP_WAITING" }); window.location.reload(); }} style={{ background: "#D4AF37", color: "#0A1628", border: "none", borderRadius: 4, padding: "0.45rem 0.9rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", flexShrink: 0 }}>TAP TO REFRESH</button>
          <button onClick={() => setShowUpdateAvailable(false)} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "1.1rem", flexShrink: 0 }}>×</button>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderTop: "1px solid rgba(212,175,55,0.4)", padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-android-192_87c8fd3a.png" alt="DRU CLEAR™" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em", marginBottom: 2 }}>Add to Home Screen</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.7rem", letterSpacing: "0.02em" }}>Save this app for instant access to your Leadership with AI transformation</div>
          </div>
          <button onClick={handleInstall} style={{ background: "#D4AF37", color: "#0A1628", border: "none", borderRadius: 4, padding: "0.45rem 0.9rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", flexShrink: 0 }}>INSTALL</button>
          <button onClick={dismissInstallBanner} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "0.25rem", flexShrink: 0, fontSize: "1.1rem", lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Manual Install Banner */}
      {showManualBanner && browserInstallInfo && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "linear-gradient(135deg, #0A1628 0%, #0D1F3C 100%)", borderTop: "1px solid rgba(212,175,55,0.4)", padding: "1rem 1.25rem 1.5rem", boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-android-192_87c8fd3a.png" alt="DRU CLEAR™" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.04em", marginBottom: 2 }}>Save this app for instant access to your Leadership with AI Transformation</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.65rem", letterSpacing: "0.02em" }}>{browserInstallInfo.label}</div>
            </div>
            <button onClick={dismissManualBanner} aria-label="Dismiss" style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: "0.25rem", flexShrink: 0, fontSize: "1.1rem", lineHeight: 1, marginTop: "-2px" }}>×</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 6, padding: "0.65rem 0.75rem" }}>
            {browserInstallInfo.steps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.65rem", minWidth: 16, marginTop: 1 }}>{i + 1}.</span>
                <span style={{ color: "rgba(255,255,255,0.75)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", letterSpacing: "0.02em", lineHeight: 1.5 }}>{step}</span>
              </div>
            ))}
          </div>
          {browserInstallInfo.note && (
            <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <span style={{ color: "#D4AF37", fontSize: "0.7rem", flexShrink: 0, marginTop: 1 }}>&#9432;</span>
              <span style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.63rem", letterSpacing: "0.02em", lineHeight: 1.5, fontStyle: "italic" }}>{browserInstallInfo.note}</span>
            </div>
          )}
        </div>
      )}

      {screen !== "splash" && screen !== "calculating" && (
        <footer style={{ textAlign: "center", padding: "0.75rem 1rem", color: "rgba(255,255,255,0.25)", fontFamily: "'Montserrat', sans-serif", fontWeight: 400, fontSize: "0.65rem", letterSpacing: "0.04em", background: "transparent" }}>
          © 2026 DRU CLEAR™ &nbsp;·&nbsp; All Rights Reserved &nbsp;·&nbsp; DRU AI Consulting
        </footer>
      )}
    </div>
  );
}
