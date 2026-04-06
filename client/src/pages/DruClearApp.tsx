/**
 * DRU CLEAR™ AI Readiness Scorecard PWA
 * Design: Executive Prestige — Dark Luxury
 * Background: #0A2342 | Gold: #D4AF37 | Magenta CTA: #C2185B
 * Fonts: Playfair Display (headings) + Inter (body)
 */

import { useState, useEffect, useRef } from "react";

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
  | "thank-you";

interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
}

interface Scores {
  [key: number]: number; // question index → score 1-5
}

// ─── Config ──────────────────────────────────────────────────────────────────

// WEBHOOK CONFIGURATION — GoHighLevel
const WEBHOOK_CONFIG = {
  url: "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/cc8e9b00-5fd6-4f5c-9965-36094289b7ee",
};

// ─── Webhook & Storage ───────────────────────────────────────────────────────

// ─── Phone Normalization ─────────────────────────────────────────────────────
// Strips all non-digit characters so GHL always receives a clean number.
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

// ─── Webhook Retry Queue ─────────────────────────────────────────────────────
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

// Internal: sends without queueing (used by both sendWebhook and flushWebhookQueue)
async function sendWebhookDirect(payload: Record<string, unknown>): Promise<boolean> {
  if (!WEBHOOK_CONFIG.url) return false;
  try {
    // Flatten all payload fields into URL query parameters.
    // GHL webhook endpoints parse query params reliably regardless of body.
    // text/plain avoids a CORS preflight; body is intentionally empty.
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) {
        // Arrays (e.g. topGaps) become comma-separated strings for GHL readability
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
    return res.ok || res.status < 500; // treat 2xx/4xx as delivered; 5xx = retry
  } catch {
    return false;
  }
}

async function sendWebhook(payload: Record<string, unknown>): Promise<boolean> {
  const ok = await sendWebhookDirect(payload);
  if (!ok) {
    // Network failure or server error — queue for retry on next app load
    enqueueWebhook(payload);
  }
  return ok;
}

function saveToLocalStorage(key: string, data: object) {
  try {
    const existing = JSON.parse(localStorage.getItem("dru_clear_submissions") || "[]");
    existing.push({ key, data, savedAt: new Date().toISOString() });
    localStorage.setItem("dru_clear_submissions", JSON.stringify(existing));
  } catch {}
}

// ─── UTM Parameter Capture ─────────────────────────────────────────────────────
// Read UTM params from the URL once on page load and cache them.
// They persist for the full session so they are available when webhooks fire.
interface UtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referral_code: string; // ?ref= param — email of the promoter who shared the link
}

function captureUtmParams(): UtmParams {
  const p = new URLSearchParams(window.location.search);
  return {
    utm_source: p.get("utm_source") || "",
    utm_medium: p.get("utm_medium") || "",
    utm_campaign: p.get("utm_campaign") || "",
    utm_content: p.get("utm_content") || "",
    utm_term: p.get("utm_term") || "",
    referral_code: p.get("ref") || "", // populated when a promoter shares their result
  };
}

// Captured once at module load time so they are never lost after navigation
const UTM_PARAMS: UtmParams = captureUtmParams();

// ─── Score Utilities ─────────────────────────────────────────────────────────

function getPillarScore(scores: Scores, startQ: number): number {
  return (scores[startQ] || 0) + (scores[startQ + 1] || 0) + (scores[startQ + 2] || 0);
}

function getTier(total: number): { label: string; className: string; color: string } {
  // Thresholds based on 100-point scaled score: EMERGING 0–40, DEVELOPING 41–60, ADVANCING 61–80, LEADING 81–100
  const scaled = Math.round((total / 75) * 100);
  if (scaled <= 40) return { label: "EMERGING", className: "tier-emerging", color: "#E53935" };
  if (scaled <= 60) return { label: "DEVELOPING", className: "tier-developing", color: "#D4AF37" };
  if (scaled <= 80) return { label: "ADVANCING", className: "tier-advancing", color: "#1E88E5" };
  return { label: "LEADING", className: "tier-leading", color: "#43A047" };
}

const GAP_MESSAGES: Record<string, string> = {
  Clarity:
    "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership:
    "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution:
    "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment:
    "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results:
    "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};

const TIER_MESSAGES: Record<string, string> = {
  EMERGING:
    "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING:
    "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING:
    "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING:
    "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};

const BOOKING_BASE_URL =
  "https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation";

function buildBookingUrl(lead: LeadData): string {
  const firstName = lead.firstName || "";
  const lastName = lead.lastName || "";
  const params = new URLSearchParams({
    utm_source: "pwa",
    utm_medium: "scorecard",
    utm_campaign: "ai-readiness",
    first_name: firstName,
    last_name: lastName,
    email: lead.email,
    company: lead.company,
  });
  return `${BOOKING_BASE_URL}?${params.toString()}`;
}

// ─── Logo Component ───────────────────────────────────────────────────────────

const LOGO_CDN =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/dru-clear-logo-transparent_fdbc9d32.png";

const HEADSHOT_CDN =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/deanna-headshot_31437bb8.jpg";

function DruLogo({ className = "" }: { className?: string }) {
  return (
    <img
      src={LOGO_CDN}
      alt="DRU CLEAR™ Logo"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

// ─── Score Button Row ─────────────────────────────────────────────────────────

const LIKERT_LABELS = ["Strongly\nDisagree", "Disagree", "Neutral", "Agree", "Strongly\nAgree"];

function ScoreRow({
  questionNum,
  question,
  value,
  onChange,
}: {
  questionNum: number;
  question: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium mb-3" style={{ color: "#E6E6E6", lineHeight: 1.5 }}>
        <span style={{ color: "#D4AF37", marginRight: "0.4em" }}>{questionNum}.</span>
        {question}
      </p>
      {/* Likert scale with full labels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            className={`score-btn${value === n ? " selected" : ""}`}
            onClick={() => onChange(n)}
            aria-label={LIKERT_LABELS[n - 1].replace("\n", " ")}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", height: "auto" }}
          >
            <span style={{ fontSize: "1rem", fontWeight: 700, lineHeight: 1 }}>{n}</span>
            <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center", whiteSpace: "pre-line", opacity: 0.85, fontFamily: "'Inter', sans-serif" }}>
              {LIKERT_LABELS[n - 1]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Screen: Splash ───────────────────────────────────────────────────────────

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="screen-enter flex flex-col items-center justify-between"
      style={{
        height: "100%",
        background: "#0A2342",
        padding: "3rem 2rem",
      }}
    >
      <div />
      <div className="flex flex-col items-center gap-6">
        <DruLogo className="w-72 max-w-full" />
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

// ─── Screen: Welcome ─────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Header */}
      <div className="flex flex-col items-center mb-6">
        <DruLogo className="w-48 max-w-full mb-4" />

        {/* Headshot */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "2.5px solid #D4AF37",
            boxShadow: "0 0 0 4px rgba(212,175,55,0.15), 0 4px 20px rgba(0,0,0,0.4)",
            overflow: "hidden",
            marginBottom: "1.25rem",
            flexShrink: 0,
          }}
        >
          <img
            src={HEADSHOT_CDN}
            alt="DeAnna R. Upshaw"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
        </div>

        <h1
          className="text-3xl font-bold text-center mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          DeAnna R. Upshaw
        </h1>
        <p className="text-lg font-medium text-center mb-1" style={{ color: "#FFFFFF" }}>
          AI Authority
        </p>
        <p className="text-sm text-center" style={{ color: "#E6E6E6" }}>
          CEO, DRU AI Consulting
        </p>
      </div>

      <div className="gold-divider mb-6" />

      <p
        className="text-center text-sm mb-6 italic"
        style={{ color: "#E6E6E6", fontFamily: "'Playfair Display', serif" }}
      >
        Your Trusted Advisor &amp; Strategist
      </p>

      <p className="text-sm leading-relaxed mb-8" style={{ color: "#E6E6E6" }}>
        How ready is your organization for the AI era? Take the free{" "}
        <strong style={{ color: "#D4AF37" }}>DRU CLEAR™ AI Readiness Scorecard</strong> and find
        out in 3 minutes.
      </p>

      <button className="btn-gold" onClick={onStart}>
        Start Your Assessment →
      </button>
    </div>
  );
}

// ─── Screen: Lead Capture ─────────────────────────────────────────────────────

// ─── Email Verification Utilities ───────────────────────────────────────────

// Comprehensive list of disposable/throwaway email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","guerrillamail.net","guerrillamail.org",
  "guerrillamail.biz","guerrillamail.de","guerrillamail.info","guerrillamailblock.com",
  "tempmail.com","temp-mail.org","temp-mail.io","throwam.com","throwaway.email",
  "trashmail.com","trashmail.me","trashmail.net","trashmail.at","trashmail.io",
  "trashmail.xyz","dispostable.com","maildrop.cc","yopmail.com","yopmail.fr",
  "cool.fr.nf","jetable.fr.nf","nospam.ze.tc","nomail.xl.cx","mega.zik.dj",
  "speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf","monemail.fr.nf",
  "monmail.fr.nf","sharklasers.com","guerrillamailblock.com","grr.la",
  "guerrillamail.info","spam4.me","spamgourmet.com","spamgourmet.net",
  "spamgourmet.org","spamgourmet.com","spamhereplease.com","spamspot.com",
  "spamthis.co.uk","spamtroll.net","spamtrap.ro","spamwc.de","spamwc.ga",
  "spamwc.gq","spamwc.ml","spamwc.cf","fakeinbox.com","fakeinbox.net",
  "fakeinbox.org","fakemail.fr","fakemail.net","fakemailgenerator.com",
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.de",
  "10minutemail.co.uk","10minutemail.co.za","10minutemail.info","10minutemail.us",
  "10minutemail.be","10minutemail.cf","10minutemail.ga","10minutemail.gq",
  "10minutemail.ml","10minutemail.ru","10minemail.com","20minutemail.com",
  "20minutemail.it","mailnull.com","mailnew.com","mailnesia.com","mailnull.com",
  "mailscrap.com","mailseal.de","mailshell.com","mailsiphon.com","mailslite.com",
  "mailtemp.info","mailtome.de","mailtothis.com","mailzilla.com","mailzilla.org",
  "mohmal.com","mytemp.email","mytempmail.com","nada.email","nada.ltd",
  "nowmymail.com","objectmail.com","obobbo.com","odaymail.com","oneoffmail.com",
  "onewaymail.com","online.ms","onqin.com","opayq.com","ordinaryamerican.net",
  "otherinbox.com","ourklips.com","outlawspam.com","owlpic.com","pecinan.com",
  "pecinan.net","pecinan.org","pepbot.com","pfui.ru","pimpedupmyspace.com",
  "pjjkp.com","plexolan.de","poczta.onet.pl","politikerclub.de","poofy.org",
  "pookmail.com","pop3.xyz","postacin.com","privacy.net","privatdemail.net",
  "proxymail.eu","prtnx.com","punkass.com","putthisinyourspamdatabase.com",
  "qq.com","quickinbox.com","rcpt.at","recode.me","recursor.net","regbypass.com",
  "regbypass.comsafe-mail.net","rejectmail.com","rklips.com","rmqkr.net",
  "royal.net","rppkn.com","rtrtr.com","s0ny.net","safe-mail.net","safersignup.de",
  "safetymail.info","safetypost.de","sandelf.de","sanfinder.com","sanim.net",
  "sast.ro","saynotospams.com","schafmail.de","schrott-email.de","secretemail.de",
  "secure-mail.biz","selfdestructingmail.com","sendspamhere.com","senseless-entertainment.com",
  "services391.com","sharklasers.com","shieldedmail.com","shiftmail.com",
  "shitmail.me","shitmail.org","shitware.nl","shmeriously.com","shortmail.net",
  "sibmail.com","sinnlos-mail.de","slapsfromlastnight.com","slaskpost.se",
  "slopsbox.com","smellfear.com","smwg.info","snakemail.com","sneakemail.com",
  "sneakmail.de","snkmail.com","sofimail.com","sofort-mail.de","sogetthis.com",
  "soisz.com","sol.dk","spam.la","spam.su","spam4.me","spamavert.com",
  "spambob.com","spambob.net","spambob.org","spambog.com","spambog.de",
  "spambog.ru","spambox.info","spambox.irishspringrealty.com","spambox.us",
  "spamcannon.com","spamcannon.net","spamcero.com","spamcon.org","spamcorptastic.com",
  "spamcowboy.com","spamcowboy.net","spamcowboy.org","spamday.com","spamex.com",
  "spamfree24.de","spamfree24.eu","spamfree24.info","spamfree24.net","spamfree24.org",
  "spamgoes.in","spamgourmet.com","spamgourmet.net","spamgourmet.org",
  "spamherelots.com","spamhereplease.com","spamhole.com","spamify.com",
  "spaminator.de","spamkill.info","spaml.com","spaml.de","spammotel.com",
  "spamobox.com","spamoff.de","spamslicer.com","spamspot.com","spamstack.net",
  "spamthis.co.uk","spamthisplease.com","spamtrail.com","spamtrap.ro",
  "spamtroll.net","spamwc.de","spamwc.ga","spamwc.gq","spamwc.ml","spamwc.cf",
  "speed.1s.fr","supergreatmail.com","supermailer.jp","superrito.com",
  "superstachel.de","suremail.info","svk.jp","sweetxxx.de","tafmail.com",
  "tagyourself.com","talkinator.com","tapchicuoihoi.com","teewars.org",
  "teleworm.com","teleworm.us","tempalias.com","tempe-mail.com","tempemail.biz",
  "tempemail.com","tempemail.net","tempemail.org","tempinbox.co.uk","tempinbox.com",
  "tempmail.eu","tempmail.it","tempmail2.com","tempmaildemo.com","tempmailer.com",
  "tempmailer.de","tempomail.fr","temporaryemail.net","temporaryemail.us",
  "temporaryforwarding.com","temporaryinbox.com","temporarymailaddress.com",
  "tempthe.net","thankyou2010.com","thc.st","thelimestones.com","thisisnotmyrealemail.com",
  "throam.com","throwam.com","throwaway.email","throwam.com","tilien.com",
  "tittbit.in","tizi.com","tmailinator.com","toomail.biz","topranklist.de",
  "tradermail.info","trash-mail.at","trash-mail.com","trash-mail.de","trash-mail.ga",
  "trash-mail.gq","trash-mail.io","trash-mail.me","trash-mail.ml","trash-mail.net",
  "trash-mail.tk","trash2009.com","trash2010.com","trash2011.com","trashdevil.com",
  "trashdevil.de","trashemail.de","trashmail.at","trashmail.com","trashmail.de",
  "trashmail.io","trashmail.me","trashmail.net","trashmail.org","trashmail.xyz",
  "trashmailer.com","trashspam.com","trbvm.com","trillianpro.com","trmailbox.com",
  "trollproject.com","trtt.net","turual.com","twinmail.de","tyldd.com",
  "uggsrock.com","umail.net","unlimit.com","unmail.ru","uroid.com",
  "us.af","username.e4ward.com","utiket.us","uu.gl","uwork4.us",
  "venompen.com","veryrealemail.com","vidchart.com","viditag.com","viewcastmedia.com",
  "viewcastmedia.net","viewcastmedia.org","viralplays.com","vkcode.ru","vomoto.com",
  "vpn.st","vsimcard.com","vubby.com","walala.org","walkmail.net","walkmail.ru",
  "webemail.me","webm4il.info","wegwerfadresse.de","wegwerfemail.com",
  "wegwerfemail.de","wegwerfemail.net","wegwerfemail.org","wegwerfmail.de",
  "wegwerfmail.info","wegwerfmail.net","wegwerfmail.org","wetrainbayarea.com",
  "wetrainbayarea.org","wh4f.org","whyspam.me","wickmail.net","wilemail.com",
  "willhackforfood.biz","willselfdestruct.com","winemaven.info","wronghead.com",
  "wuzupmail.net","www.e4ward.com","www.gishpuppy.com","www.mailinator.com",
  "wwwnew.eu","x.ip6.li","xagloo.com","xemaps.com","xents.com","xmaily.com",
  "xoxy.net","xyzfree.net","yapped.net","yeah.net","yep.it","yogamaven.com",
  "yopmail.com","yopmail.fr","yopmail.pp.ua","yourdomain.com","yuurok.com",
  "z1p.biz","za.com","zehnminuten.de","zehnminutenmail.de","zetmail.com",
  "zippymail.info","zoaxe.com","zoemail.com","zoemail.net","zoemail.org",
  "zomg.info","zxcv.com","zxcvbnm.com","zzz.com",
  // Common typo domains to catch and suggest corrections
  "gmial.com","gmal.com","gmai.com","gmali.com","gmaill.com","gmaio.com",
  "yahooo.com","yahho.com","yaho.com","yahooo.co.uk","yhaoo.com",
  "hotmial.com","hotmal.com","hotmai.com","hotmaill.com","hotmali.com",
  "outlok.com","outloo.com","outloook.com","outlookk.com",
]);

// Typo correction suggestions for common domains
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmaio.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outloook.com": "outlook.com",
  "outlookk.com": "outlook.com",
};

// Check MX records via Cloudflare DNS-over-HTTPS
async function checkMxRecord(domain: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { Accept: "application/dns-json" } }
    );
    if (!res.ok) return true; // fail open if DNS unreachable
    const data = await res.json();
    // Status 0 = NOERROR, check if Answer array has real MX records
    // Reject null MX records like "0 ." which mean "no mail server"
    if (data.Status !== 0 || !Array.isArray(data.Answer) || data.Answer.length === 0) return false;
    const hasRealMx = data.Answer.some((rec: { data: string }) => {
      const d = (rec.data || "").trim();
      // Null MX: "0 ." or just "." means explicitly no mail server
      return d !== "." && d !== "0 ." && !d.endsWith(" .");
    });
    return hasRealMx;
  } catch {
    return true; // fail open on network error
  }
}

// Full email verification: format → typo → disposable → MX
async function verifyEmail(email: string): Promise<{ valid: boolean; error: string; suggestion?: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { valid: false, error: "Required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  const domain = trimmed.split("@")[1];
  // Check for typos
  if (DOMAIN_TYPOS[domain]) {
    return { valid: false, error: `Did you mean ${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}?`, suggestion: `${trimmed.split("@")[0]}@${DOMAIN_TYPOS[domain]}` };
  }
  // Check disposable
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: "Disposable email addresses are not accepted. Please use your work or personal email." };
  }
  // Check MX record
  const hasMx = await checkMxRecord(domain);
  if (!hasMx) {
    return { valid: false, error: `No mail server found for "${domain}". Please check your email address.` };
  }
  return { valid: true, error: "" };
}

function LeadCaptureScreen({
  onContinue,
}: {
  onContinue: (data: LeadData) => void;
}) {
  const [form, setForm] = useState<LeadData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    role: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const emailVerifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time email verification on blur
  const handleEmailBlur = async () => {
    if (!form.email) return;
    setEmailVerifying(true);
    setEmailError("");
    setEmailSuggestion("");
    setEmailVerified(false);
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (result.valid) {
      setEmailVerified(true);
      setEmailError("");
    } else {
      setEmailError(result.error);
      setEmailSuggestion(result.suggestion || "");
      setEmailVerified(false);
    }
  };

  // Reset verification state when email changes
  const handleEmailChange = (val: string) => {
    setForm({ ...form, email: val });
    setEmailVerified(false);
    setEmailError("");
    setEmailSuggestion("");
    if (emailVerifyTimeout.current) clearTimeout(emailVerifyTimeout.current);
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!form.firstName.trim() || form.firstName.trim().length < 2 || !form.lastName.trim() || form.lastName.trim().length < 2 || !form.phone.trim() || !form.company.trim() || !form.role) {
      setError("Please complete all fields to continue.");
      return;
    }
    // Always verify email on submit
    setEmailVerifying(true);
    setEmailError("");
    setEmailSuggestion("");
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (!result.valid) {
      setEmailError(result.error);
      setEmailSuggestion(result.suggestion || "");
      setEmailVerified(false);
      setError("Please fix the errors above to continue.");
      return;
    }
    setEmailVerified(true);
    setError("");
    setLoading(true);

    const payload = {
      event: "lead_capture",
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: normalizePhone(form.phone || ""),
      company: form.company,
      role: form.role,
      // UTM attribution
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    };

    saveToLocalStorage("lead_capture", payload);
    await sendWebhook(payload);

    setLoading(false);
    onContinue(form);
  };

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2.5rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div className="mb-8">
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}
        >
          Before we begin —
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#E6E6E6" }}>
          Enter your details to receive your personalized results and AI readiness insights.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
              First Name <span style={{ color: "#E53935" }}>*</span>
            </label>
            <input
              className="dru-input"
              placeholder="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              style={submitted && (!form.firstName.trim() || form.firstName.trim().length < 2) ? { borderColor: "#E53935" } : {}}
            />
            {submitted && !form.firstName.trim() && (
              <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>
            )}
            {submitted && form.firstName.trim() && form.firstName.trim().length < 2 && (
              <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>
            )}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
              Last Name <span style={{ color: "#E53935" }}>*</span>
            </label>
            <input
              className="dru-input"
              placeholder="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              style={submitted && (!form.lastName.trim() || form.lastName.trim().length < 2) ? { borderColor: "#E53935" } : {}}
            />
            {submitted && !form.lastName.trim() && (
              <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>
            )}
            {submitted && form.lastName.trim() && form.lastName.trim().length < 2 && (
              <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Email Address <span style={{ color: "#E53935" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="dru-input"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={handleEmailBlur}
              style={{
                ...(emailError ? { borderColor: "#E53935" } : {}),
                ...(emailVerified ? { borderColor: "#4CAF50" } : {}),
                paddingRight: (emailVerifying || emailVerified) ? "2.5rem" : undefined,
              }}
            />
            {emailVerifying && (
              <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#D4AF37", fontSize: "0.75rem" }}>
                Checking…
              </span>
            )}
            {emailVerified && !emailVerifying && (
              <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: "1rem" }}>
                ✓
              </span>
            )}
          </div>
          {emailError && (
            <div className="text-xs mt-1" style={{ color: "#E53935" }}>
              {emailError}
              {emailSuggestion && (
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, email: emailSuggestion }); setEmailSuggestion(""); setEmailError(""); }}
                  style={{ marginLeft: "0.5rem", color: "#D4AF37", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                >
                  Use {emailSuggestion}
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Phone Number <span style={{ color: "#E53935" }}>*</span>
          </label>
          <input
            className="dru-input"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            style={submitted && !form.phone.trim() ? { borderColor: "#E53935" } : {}}
          />
          {submitted && !form.phone.trim() && (
            <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Company Name <span style={{ color: "#E53935" }}>*</span>
          </label>
          <input
            className="dru-input"
            placeholder="Your organization"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            style={submitted && !form.company.trim() ? { borderColor: "#E53935" } : {}}
          />
          {submitted && !form.company.trim() && (
            <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Your Role / Title <span style={{ color: "#E53935" }}>*</span>
          </label>
          <select
            className="dru-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{
              ...(submitted && !form.role ? { borderColor: "#E53935" } : {}),
              background: "#0A2342",
              color: form.role ? "#FFFFFF" : "rgba(230,230,230,0.4)",
              appearance: "auto" as const,
              cursor: "pointer",
            }}
          >
            <option value="" disabled>Select your role...</option>
            <option value="C-Suite Executive">C-Suite Executive</option>
            <option value="VP / Senior Director">VP / Senior Director</option>
            <option value="Director">Director</option>
            <option value="Team Leader">Team Leader</option>
            <option value="Consultant / Advisor">Consultant / Advisor</option>
            <option value="Other">Other</option>
          </select>
          {submitted && !form.role && (
            <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm mb-4" style={{ color: "#E53935" }}>
          {error}
        </p>
      )}

      <button className="btn-gold" onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Continue →"}
      </button>
    </div>
  );
}

// ─── Screen: Scorecard Pillar ─────────────────────────────────────────────────

interface PillarScreenProps {
  pillarLetter: string;
  pillarName: string;
  subtitle: string;
  progress: number;
  progressLabel: string;
  questions: string[];
  questionStartIndex: number;
  scores: Scores;
  onScoreChange: (qIndex: number, value: number) => void;
  onNext: () => void;
  nextLabel?: string;
}

function PillarScreen({
  pillarLetter,
  pillarName,
  subtitle,
  progress,
  progressLabel,
  questions,
  questionStartIndex,
  scores,
  onScoreChange,
  onNext,
  nextLabel = "Next →",
}: PillarScreenProps) {
  const allAnswered = questions.every(
    (_, i) => scores[questionStartIndex + i] && scores[questionStartIndex + i] > 0
  );

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2rem 1.5rem 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Progress */}
      <div className="mb-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: "rgba(212,175,55,0.7)" }}>
            {progressLabel}
          </span>
          <span className="text-xs" style={{ color: "rgba(230,230,230,0.4)" }}>
            {progress}%
          </span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}
        >
          {pillarLetter} — {pillarName}
        </h2>
        <p className="text-sm" style={{ color: "#E6E6E6" }}>
          {subtitle}
        </p>
      </div>

      <div className="gold-divider mb-6" />

      {/* Questions */}
      <div className="flex-1">
        {questions.map((q, i) => (
          <ScoreRow
            key={i}
            questionNum={questionStartIndex + i + 1}
            question={q}
            value={scores[questionStartIndex + i] || 0}
            onChange={(v) => onScoreChange(questionStartIndex + i, v)}
          />
        ))}
      </div>

      <div className="mt-4">
        {!allAnswered && (
          <p className="text-xs text-center mb-3" style={{ color: "rgba(230,230,230,0.4)" }}>
            Please answer all questions to continue
          </p>
        )}
        <button
          className="btn-gold"
          onClick={onNext}
          disabled={!allAnswered}
          style={{ opacity: allAnswered ? 1 : 0.4 }}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Screen: Calculating ─────────────────────────────────────────────────────

function CalculatingScreen({ onDone }: { onDone: () => void }) {
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
        <p
          className="text-lg font-medium mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF" }}
        >
          Analyzing your responses
        </p>
        <p className="text-sm" style={{ color: "rgba(230,230,230,0.6)" }}>
          across all 5 CLEAR™ pillars...
        </p>
      </div>
    </div>
  );
}

// ─── Screen: Results ─────────────────────────────────────────────────────────

function ResultsScreen({
  lead,
  scores,
  onBookCall,
}: {
  lead: LeadData;
  scores: Scores;
  onBookCall: () => void;
}) {
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
  // Only show gaps for pillars scoring below 80% (< 12/15)
  const topGaps = sorted.filter((p) => p.score < 12).slice(0, 2);

  const ctaLabel = "Take The Next Step →";

  const bookingUrl = buildBookingUrl(lead);

  // Send results webhook on mount
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current) return;
    sentRef.current = true;

    const payload = {
      event: "scorecard_complete",
      // Contact identity — all fields needed for GHL to create/update a contact
      first_name: lead.firstName,
      last_name: lead.lastName,
      full_name: `${lead.firstName} ${lead.lastName}`.trim(),
      email: lead.email,
      phone: normalizePhone(lead.phone || ""),
      company: lead.company,
      role: lead.role,
      // Scorecard results — used to trigger tier-based email workflows in GHL
      score: scaledScore,
      result: tier.label,
      result_message: TIER_MESSAGES[tier.label] || "",
      top_gaps: topGaps.map((g) => g.name),
      top_gap_1: topGaps[0]?.name || "",
      top_gap_2: topGaps[1]?.name || "",
      top_gap_1_message: topGaps[0] ? GAP_MESSAGES[topGaps[0].name] || "" : "",
      top_gap_2_message: topGaps[1] ? GAP_MESSAGES[topGaps[1].name] || "" : "",
      // Individual pillar scores (0–15 each)
      pillar_clarity: clarityScore,
      pillar_leadership: leadershipScore,
      pillar_execution: executionScore,
      pillar_alignment: alignmentScore,
      pillar_results: resultsScore,
      raw_score: total,
      // UTM attribution
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    };

    saveToLocalStorage("scorecard_complete", payload);
    sendWebhook(payload);
  }, []);

  return (
    <div
      className="screen-enter flex flex-col"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "1.5rem 1.25rem 1.5rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Overall Score — compact row layout */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(230,230,230,0.5)" }}>
            Your Score
          </p>
          <div
            className="count-up text-5xl font-bold"
            style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1 }}
          >
            {scaledScore}
            <span className="text-2xl" style={{ color: "rgba(212,175,55,0.5)" }}>
              /100
            </span>
          </div>
        </div>
        <div
          className="text-lg font-bold tracking-widest px-4 py-2 rounded"
          style={{ color: tier.color, border: `1.5px solid ${tier.color}`, fontFamily: "'Inter', sans-serif", background: `${tier.color}18` }}
        >
          {tier.label}
        </div>
      </div>

      <div className="gold-divider mb-3" />

      {/* Pillar Breakdown — compact */}
      <div className="mb-3">
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: "rgba(212,175,55,0.7)" }}
        >
          Pillar Breakdown
        </h3>
        <div className="flex flex-col gap-2">
          {pillars.map((p) => (
            <div key={p.name}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium" style={{ color: "#E6E6E6" }}>
                  {p.name[0]} — {p.name}
                </span>
                <span className="text-xs font-semibold" style={{ color: "#D4AF37" }}>
                  {p.score}/15
                </span>
              </div>
              <div className="pillar-bar-track" style={{ height: 5 }}>
                <div
                  className="pillar-bar-fill"
                  style={{ width: `${(p.score / 15) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="gold-divider mb-3" />

      {/* Top Gap Areas — compact */}
      {topGaps.length > 0 && (
        <div className="mb-3">
          <h3
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(212,175,55,0.7)" }}
          >
            Top Gap Areas
          </h3>
          <div className="flex flex-col gap-2">
            {topGaps.map((g) => (
              <div key={g.name} className="dru-card" style={{ padding: "0.6rem 0.75rem" }}>
                <div className="flex items-start gap-2">
                  <span style={{ color: "#D4AF37", fontSize: "0.85rem", marginTop: 1 }}>⚠</span>
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#FFFFFF" }}>
                      {g.name} Gap
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#E6E6E6", fontSize: "0.7rem" }}>
                      {GAP_MESSAGES[g.name]}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tier Message — compact */}
      <div className="dru-card mb-3" style={{ padding: "0.6rem 0.75rem" }}>
        <p className="text-xs leading-relaxed" style={{ color: "#E6E6E6", fontSize: "0.7rem" }}>
          {TIER_MESSAGES[tier.label]}
        </p>
      </div>

      {/* CTA */}
      <button
        className="btn-magenta mb-4"
        onClick={onBookCall}
      >
        {ctaLabel}
      </button>

      {/* Disclaimer */}
      <p
        className="text-center mb-4"
        style={{
          color: "#E6E6E6",
          fontSize: "0.65rem",
          lineHeight: 1.6,
          opacity: 0.6,
          maxWidth: 400,
          margin: "0 auto 1rem",
        }}
      >
        This assessment is for informational purposes only and does not constitute professional consulting advice. Results are based on your self-reported responses. For a personalized strategy, book a consultation with DRU AI Consulting.
      </p>

      {/* Footer — minimal */}
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

// ─── Thank You Screen ────────────────────────────────────────────────────────

function ThankYouScreen({ lead, scores }: { lead: LeadData; scores: Scores }) {
  // Build share content from the user's actual tier
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const tier = getTier(total);
  const scaledScore = Math.round((total / 75) * 100);
  const [copied, setCopied] = useState(false);

  // Referral URL: appends ?ref=<email> so referred visitors are attributed to this promoter
  const refParam = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
  const assessmentUrl = `${window.location.origin}${refParam}`;
  const shareText = `I just completed the DRU CLEAR™ AI Readiness Assessment and scored ${scaledScore}/100 — ${tier.label} tier. Find out where your organization stands: ${assessmentUrl}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(assessmentUrl)}&summary=${encodeURIComponent(shareText)}`;
  const emailSubject = encodeURIComponent(`My DRU CLEAR™ AI Readiness Score: ${scaledScore}/100 — ${tier.label}`);
  const emailBody = encodeURIComponent(`${shareText}\n\nTake the free assessment at: ${assessmentUrl}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  // Fire a lightweight webhook to GHL when a user clicks any share button
  const fireShareWebhook = (channel: string) => {
    sendWebhook({
      event: "share_click",
      channel,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      score: scaledScore,
      result: tier.label,
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      fireShareWebhook("clipboard");
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {});
  };

  return (
    <div
      className="screen-enter flex flex-col items-center justify-center"
      style={{
        height: "100%",
        background: "#0A2342",
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      {/* Gold checkmark circle */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          border: "2px solid #D4AF37",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          background: "rgba(212,175,55,0.08)",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Headline */}
      <h2
        className="text-3xl font-bold mb-3"
        style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1.2 }}
      >
        You're One Step Closer to Clarity.
      </h2>

      {/* Subtext */}
      <p
        className="text-base mb-8 max-w-xs"
        style={{ color: "#E6E6E6", lineHeight: 1.6 }}
      >
        Now that you've reviewed your insights, let's move forward together.
      </p>

      {/* Book CTA Button */}
      <a
        href="https://api.aiforbusiness.com/widget/bookings/dru-clear-ai-readiness-consultation"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          width: "100%",
          maxWidth: 320,
          marginBottom: "2rem",
          padding: "0.875rem 1.5rem",
          background: "#C2185B",
          color: "#FFFFFF",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: "0.95rem",
          letterSpacing: "0.04em",
          textAlign: "center",
          textDecoration: "none",
          borderRadius: 4,
          boxShadow: "0 4px 16px rgba(194,24,91,0.35)",
          transition: "background 0.2s, box-shadow 0.2s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#AD1457"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#C2185B"; }}
      >
        Book Your Free Clarity Call
      </a>

      {/* Share Section */}
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          marginBottom: "2rem",
          padding: "1.25rem 1.5rem",
          background: "rgba(212,175,55,0.06)",
          border: "1px solid rgba(212,175,55,0.2)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        <p
          style={{
            color: "rgba(230,230,230,0.6)",
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "0.875rem",
            fontFamily: "'Montserrat', sans-serif",
            fontWeight: 600,
          }}
        >
          Share Your Results
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          {/* LinkedIn */}
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireShareWebhook("linkedin")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1rem",
              background: "#0A66C2",
              color: "#FFFFFF",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              textDecoration: "none",
              borderRadius: 4,
              letterSpacing: "0.02em",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#004182"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0A66C2"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </a>
          {/* Email */}
          <a
            href={emailUrl}
            onClick={() => fireShareWebhook("email")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 1rem",
              background: "transparent",
              color: "#D4AF37",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              textDecoration: "none",
              borderRadius: 4,
              border: "1px solid rgba(212,175,55,0.4)",
              letterSpacing: "0.02em",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#D4AF37"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(212,175,55,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Email
          </a>
          {/* Copy to Clipboard */}
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.9rem",
              background: copied ? "rgba(212,175,55,0.18)" : "transparent",
              color: copied ? "#D4AF37" : "rgba(230,230,230,0.5)",
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              fontSize: "0.78rem",
              border: `1px solid ${copied ? "rgba(212,175,55,0.6)" : "rgba(230,230,230,0.2)"}`,
              borderRadius: 4,
              letterSpacing: "0.02em",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 48, height: 1, background: "rgba(212,175,55,0.3)", marginBottom: "2rem" }} />

      {/* Logo */}
      <DruLogo className="w-48 max-w-full mb-3" />

      {/* Powered by */}
      <p className="text-xs mb-1" style={{ color: "rgba(230,230,230,0.5)" }}>Powered by DRU AI Consulting</p>

      {/* Website link */}
      <a
        href="https://druaiconsulting.com"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs"
        style={{ color: "#D4AF37", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        druaiconsulting.com
      </a>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

// ─── SessionStorage Progress Save ────────────────────────────────────────────────────
const PROGRESS_KEY = "dru_clear_progress";

// Screens that are safe to resume at (not transient)
const RESUMABLE_SCREENS: Screen[] = [
  "lead-capture",
  "clarity",
  "leadership",
  "execution",
  "alignment",
  "results-pillar",
];

function saveProgress(screen: Screen, lead: LeadData, scores: Scores): void {
  try {
    sessionStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ screen, lead, scores, savedAt: new Date().toISOString() })
    );
  } catch {}
}

function loadProgress(): { screen: Screen; lead: LeadData; scores: Scores } | null {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.screen || !RESUMABLE_SCREENS.includes(parsed.screen)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearProgress(): void {
  try { sessionStorage.removeItem(PROGRESS_KEY); } catch {}
}

export default function DruClearApp() {
  // Restore from sessionStorage if a previous in-progress session exists
  const saved = loadProgress();

  const [screen, setScreen] = useState<Screen>(saved?.screen ?? "splash");
  const [lead, setLead] = useState<LeadData>(
    saved?.lead ?? { firstName: "", lastName: "", email: "", phone: "", company: "", role: "" }
  );
  const [scores, setScores] = useState<Scores>(saved?.scores ?? {});

  // Register service worker + flush any queued webhooks from previous sessions
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Retry any webhooks that failed due to network issues in a previous session
    flushWebhookQueue();
  }, []);

  // Persist progress to sessionStorage whenever screen, lead, or scores change
  useEffect(() => {
    if (RESUMABLE_SCREENS.includes(screen)) {
      saveProgress(screen, lead, scores);
    } else if (screen === "results" || screen === "thank-you" || screen === "calculating") {
      // Assessment complete — clear saved progress so next visit starts fresh
      clearProgress();
    }
  }, [screen, lead, scores]);

  const updateScore = (qIndex: number, value: number) => {
    setScores((prev) => ({ ...prev, [qIndex]: value }));
  };

  const goTo = (s: Screen) => setScreen(s);

  return (
    <div
      style={{
        height: "100dvh",
        width: "100%",
        background: "#0A2342",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {screen === "splash" && <SplashScreen onDone={() => goTo("welcome")} />}

      {screen === "welcome" && <WelcomeScreen onStart={() => goTo("lead-capture")} />}

      {screen === "lead-capture" && (
        <LeadCaptureScreen
          onContinue={(data) => {
            setLead(data);
            goTo("clarity");
          }}
        />
      )}

      {screen === "clarity" && (
        <PillarScreen
          pillarLetter="C"
          pillarName="CLARITY"
          subtitle="AI Vision & Strategic Direction"
          progress={20}
          progressLabel="Pillar 1 of 5"
          questions={[
            "Our organization has a clearly defined AI vision that connects to our overall business strategy.",
            "Leaders and teams across the organization understand why we are pursuing AI and what success looks like.",
            "We have identified specific strategic priorities where AI will have the greatest business impact.",
          ]}
          questionStartIndex={0}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("leadership")}
        />
      )}

      {screen === "leadership" && (
        <PillarScreen
          pillarLetter="L"
          pillarName="LEADERSHIP"
          subtitle="Executive AI Fluency & Sponsorship"
          progress={40}
          progressLabel="Pillar 2 of 5"
          questions={[
            "Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.",
            "There is a designated executive sponsor who is accountable for driving AI transformation.",
            "Our leadership team actively participates in AI learning, development, and decision-making.",
          ]}
          questionStartIndex={3}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("execution")}
        />
      )}

      {screen === "execution" && (
        <PillarScreen
          pillarLetter="E"
          pillarName="EXECUTION"
          subtitle="Operational AI Implementation Capacity"
          progress={60}
          progressLabel="Pillar 3 of 5"
          questions={[
            "We have identified specific business processes where AI can deliver measurable impact.",
            "Our teams have the skills, tools, and resources needed to implement AI solutions today.",
            "We have completed at least one AI pilot or proof of concept in the past 12 months.",
          ]}
          questionStartIndex={6}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("alignment")}
        />
      )}

      {screen === "alignment" && (
        <PillarScreen
          pillarLetter="A"
          pillarName="ALIGNMENT"
          subtitle="Cross-Functional Strategic Coherence"
          progress={80}
          progressLabel="Pillar 4 of 5"
          questions={[
            "Our AI initiatives are aligned with our overall business goals and strategic plan.",
            "There is clear and consistent communication between departments about AI priorities and progress.",
            "Our AI efforts are coordinated across teams and business units rather than operating in silos.",
          ]}
          questionStartIndex={9}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("results-pillar")}
        />
      )}

      {screen === "results-pillar" && (
        <PillarScreen
          pillarLetter="R"
          pillarName="RESULTS"
          subtitle="Measurement, Tracking & Return on Investment"
          progress={100}
          progressLabel="Pillar 5 of 5"
          questions={[
            "We have defined clear Key Performance Indicators to measure the success of our AI initiatives.",
            "We can demonstrate measurable return on investment from at least one AI-related initiative.",
            "We have a system in place to regularly track and report AI progress to leadership.",
          ]}
          questionStartIndex={12}
          scores={scores}
          onScoreChange={updateScore}
          onNext={() => goTo("calculating")}
          nextLabel="See My Results →"
        />
      )}

      {screen === "calculating" && <CalculatingScreen onDone={() => goTo("results")} />}

      {screen === "results" && <ResultsScreen lead={lead} scores={scores} onBookCall={() => window.open("https://druaiconsulting.com/appointment", "_blank", "noopener,noreferrer")} />}

      {screen === "thank-you" && <ThankYouScreen lead={lead} scores={scores} />}
    </div>
  );
}
