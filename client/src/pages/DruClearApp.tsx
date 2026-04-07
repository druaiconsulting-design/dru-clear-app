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
  | "thank-you";

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

const STRENGTH_MESSAGES: Record<string, string> = {
  Clarity:
    "Your AI vision is clearly defined and connected to your business strategy — a critical foundation that most organizations struggle to establish.",
  Leadership:
    "Your executive team is AI-fluent and actively sponsoring transformation — the single most important driver of successful AI adoption.",
  Execution:
    "Your teams have the skills, tools, and processes to implement AI effectively — turning strategy into measurable results.",
  Alignment:
    "Your departments operate as a unified AI front with clear communication and coordinated priorities — rare and powerful.",
  Results:
    "You measure, track, and demonstrate AI ROI consistently — giving you the credibility and data to scale confidently.",
};

const BADGE_URLS: Record<string, string> = {
  EMERGING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-emerging_6233aed6.png",
  DEVELOPING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-developing_226a8643.png",
  ADVANCING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-advancing_d5ded127.png",
  LEADING: "https://d2xsxph8kpxj0f.cloudfront.net/310519663512997684/3v5s3xyNxqpHhQbaaqucFJ/og-badge-leading_3fa87f71.png",
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

// ─── Country Code Data ───────────────────────────────────────────────────────

interface CountryCode {
  code: string;   // dial code e.g. "+1"
  iso: string;    // ISO 3166-1 alpha-2 e.g. "US"
  name: string;   // display name
  flag: string;   // emoji flag
  hint: string;   // format hint shown below input e.g. "Format: (555) 000-0000"
  minLen: number; // minimum local digits (after stripping country code)
  maxLen: number; // maximum local digits
}

// ─── Timezone → ISO country detection ──────────────────────────────────────
const TIMEZONE_TO_ISO: Record<string, string> = {
  // Americas
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "Pacific/Honolulu": "US", "America/Detroit": "US", "America/Indiana/Indianapolis": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Montreal": "CA",
  "America/Winnipeg": "CA", "America/Edmonton": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Monterrey": "MX", "America/Tijuana": "MX",
  "America/Sao_Paulo": "BR", "America/Manaus": "BR", "America/Belem": "BR",
  "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO",
  "America/Lima": "PE", "America/Santiago": "CL", "America/Caracas": "VE",
  "America/La_Paz": "BO", "America/Asuncion": "PY", "America/Montevideo": "UY",
  "America/Guayaquil": "EC", "America/Havana": "CU", "America/Nassau": "BS",
  "America/Jamaica": "JM", "America/Port-au-Prince": "HT", "America/Santo_Domingo": "DO",
  "America/Puerto_Rico": "PR", "America/Panama": "PA", "America/Costa_Rica": "CR",
  "America/Guatemala": "GT", "America/Tegucigalpa": "HN", "America/Managua": "NI",
  "America/El_Salvador": "SV", "America/Belize": "BZ",
  // Europe
  "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Lisbon": "PT",
  "Europe/Madrid": "ES", "Europe/Paris": "FR", "Europe/Brussels": "BE",
  "Europe/Amsterdam": "NL", "Europe/Berlin": "DE", "Europe/Vienna": "AT",
  "Europe/Zurich": "CH", "Europe/Rome": "IT", "Europe/Vatican": "VA",
  "Europe/Copenhagen": "DK", "Europe/Stockholm": "SE", "Europe/Oslo": "NO",
  "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
  "Europe/Budapest": "HU", "Europe/Bratislava": "SK", "Europe/Bucharest": "RO",
  "Europe/Sofia": "BG", "Europe/Athens": "GR", "Europe/Istanbul": "TR",
  "Europe/Kiev": "UA", "Europe/Minsk": "BY", "Europe/Riga": "LV",
  "Europe/Tallinn": "EE", "Europe/Vilnius": "LT", "Europe/Moscow": "RU",
  "Europe/Belgrade": "RS", "Europe/Zagreb": "HR", "Europe/Ljubljana": "SI",
  "Europe/Sarajevo": "BA", "Europe/Skopje": "MK", "Europe/Podgorica": "ME",
  "Europe/Tirane": "AL", "Europe/Nicosia": "CY", "Europe/Malta": "MT",
  "Europe/Luxembourg": "LU", "Europe/Monaco": "MC", "Europe/Andorra": "AD",
  "Europe/San_Marino": "SM", "Europe/Vaduz": "LI", "Atlantic/Reykjavik": "IS",
  // Asia-Pacific
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW", "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY", "Asia/Bangkok": "TH", "Asia/Jakarta": "ID",
  "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN", "Asia/Rangoon": "MM",
  "Asia/Dhaka": "BD", "Asia/Colombo": "LK", "Asia/Kolkata": "IN",
  "Asia/Karachi": "PK", "Asia/Kabul": "AF", "Asia/Tehran": "IR",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Kuwait": "KW",
  "Asia/Qatar": "QA", "Asia/Bahrain": "BH", "Asia/Muscat": "OM",
  "Asia/Baghdad": "IQ", "Asia/Beirut": "LB", "Asia/Damascus": "SY",
  "Asia/Amman": "JO", "Asia/Jerusalem": "IL", "Asia/Nicosia": "CY",
  "Asia/Tbilisi": "GE", "Asia/Yerevan": "AM", "Asia/Baku": "AZ",
  "Asia/Tashkent": "UZ", "Asia/Almaty": "KZ", "Asia/Bishkek": "KG",
  "Asia/Dushanbe": "TJ", "Asia/Ashgabat": "TM", "Asia/Kathmandu": "NP",
  "Asia/Thimphu": "BT", "Asia/Ulaanbaatar": "MN", "Asia/Pyongyang": "KP",
  "Asia/Macau": "MO", "Asia/Phnom_Penh": "KH", "Asia/Vientiane": "LA",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU",
  "Australia/Perth": "AU", "Australia/Adelaide": "AU", "Australia/Darwin": "AU",
  "Pacific/Auckland": "NZ", "Pacific/Fiji": "FJ", "Pacific/Guam": "GU",
  // Africa & Middle East
  "Africa/Cairo": "EG", "Africa/Johannesburg": "ZA", "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE", "Africa/Accra": "GH", "Africa/Addis_Ababa": "ET",
  "Africa/Casablanca": "MA", "Africa/Tunis": "TN", "Africa/Algiers": "DZ",
  "Africa/Tripoli": "LY", "Africa/Khartoum": "SD", "Africa/Dar_es_Salaam": "TZ",
  "Africa/Kampala": "UG", "Africa/Lusaka": "ZM", "Africa/Harare": "ZW",
  "Africa/Maputo": "MZ", "Africa/Luanda": "AO", "Africa/Kinshasa": "CD",
  "Africa/Abidjan": "CI", "Africa/Dakar": "SN", "Africa/Bamako": "ML",
};

function detectCountryFromTimezone(): CountryCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const iso = TIMEZONE_TO_ISO[tz];
    if (iso) {
      const found = COUNTRY_CODES.find((c) => c.iso === iso);
      if (found) return found;
    }
  } catch {}
  return COUNTRY_CODES[0]; // fallback to +1 US
}

const COUNTRY_CODES: CountryCode[] = [
  { code: "+1",   iso: "US", name: "United States",             flag: "🇺🇸", hint: "Format: (555) 000-0000",     minLen: 10, maxLen: 10 },
  { code: "+1",   iso: "CA", name: "Canada",                    flag: "🇨🇦", hint: "Format: (555) 000-0000",     minLen: 10, maxLen: 10 },
  { code: "+7",   iso: "RU", name: "Russia",                    flag: "🇷🇺", hint: "Format: 9xx xxx xx xx",       minLen: 10, maxLen: 10 },
  { code: "+20",  iso: "EG", name: "Egypt",                     flag: "🇪🇬", hint: "Format: 1x xxxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+27",  iso: "ZA", name: "South Africa",              flag: "🇿🇦", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+30",  iso: "GR", name: "Greece",                    flag: "🇬🇷", hint: "Format: 6xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+31",  iso: "NL", name: "Netherlands",               flag: "🇳🇱", hint: "Format: 6 xxxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+32",  iso: "BE", name: "Belgium",                   flag: "🇧🇪", hint: "Format: 4xx xx xx xx",        minLen: 9,  maxLen: 9  },
  { code: "+33",  iso: "FR", name: "France",                    flag: "🇫🇷", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+34",  iso: "ES", name: "Spain",                     flag: "🇪🇸", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+36",  iso: "HU", name: "Hungary",                   flag: "🇭🇺", hint: "Format: 20 xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+39",  iso: "IT", name: "Italy",                     flag: "🇮🇹", hint: "Format: 3xx xxx xxxx",        minLen: 9,  maxLen: 11 },
  { code: "+40",  iso: "RO", name: "Romania",                   flag: "🇷🇴", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+41",  iso: "CH", name: "Switzerland",               flag: "🇨🇭", hint: "Format: 7x xxx xx xx",        minLen: 9,  maxLen: 9  },
  { code: "+43",  iso: "AT", name: "Austria",                   flag: "🇦🇹", hint: "Format: 6xx xxxxxx",          minLen: 7,  maxLen: 13 },
  { code: "+44",  iso: "GB", name: "United Kingdom",            flag: "🇬🇧", hint: "Format: 07xxx xxxxxx",        minLen: 10, maxLen: 10 },
  { code: "+45",  iso: "DK", name: "Denmark",                   flag: "🇩🇰", hint: "Format: xx xx xx xx",         minLen: 8,  maxLen: 8  },
  { code: "+46",  iso: "SE", name: "Sweden",                    flag: "🇸🇪", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+47",  iso: "NO", name: "Norway",                    flag: "🇳🇴", hint: "Format: xxx xx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+48",  iso: "PL", name: "Poland",                    flag: "🇵🇱", hint: "Format: xxx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+49",  iso: "DE", name: "Germany",                   flag: "🇩🇪", hint: "Format: 1xx xxxxxxxx",        minLen: 10, maxLen: 12 },
  { code: "+51",  iso: "PE", name: "Peru",                      flag: "🇵🇪", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+52",  iso: "MX", name: "Mexico",                    flag: "🇲🇽", hint: "Format: 1xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+53",  iso: "CU", name: "Cuba",                      flag: "🇨🇺", hint: "Format: 5x xxx xxxx",         minLen: 8,  maxLen: 8  },
  { code: "+54",  iso: "AR", name: "Argentina",                 flag: "🇦🇷", hint: "Format: 9 11 xxxx xxxx",      minLen: 10, maxLen: 10 },
  { code: "+55",  iso: "BR", name: "Brazil",                    flag: "🇧🇷", hint: "Format: 11 9xxxx xxxx",       minLen: 10, maxLen: 11 },
  { code: "+56",  iso: "CL", name: "Chile",                     flag: "🇨🇱", hint: "Format: 9 xxxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+57",  iso: "CO", name: "Colombia",                  flag: "🇨🇴", hint: "Format: 3xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+58",  iso: "VE", name: "Venezuela",                 flag: "🇻🇪", hint: "Format: 4xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+60",  iso: "MY", name: "Malaysia",                  flag: "🇲🇾", hint: "Format: 1x xxxx xxxx",        minLen: 9,  maxLen: 10 },
  { code: "+61",  iso: "AU", name: "Australia",                 flag: "🇦🇺", hint: "Format: 4xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+62",  iso: "ID", name: "Indonesia",                 flag: "🇮🇩", hint: "Format: 8xx xxxx xxxx",       minLen: 9,  maxLen: 12 },
  { code: "+63",  iso: "PH", name: "Philippines",               flag: "🇵🇭", hint: "Format: 9xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+64",  iso: "NZ", name: "New Zealand",               flag: "🇳🇿", hint: "Format: 2x xxx xxxx",         minLen: 8,  maxLen: 10 },
  { code: "+65",  iso: "SG", name: "Singapore",                 flag: "🇸🇬", hint: "Format: 8xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+66",  iso: "TH", name: "Thailand",                  flag: "🇹🇭", hint: "Format: 8x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+81",  iso: "JP", name: "Japan",                     flag: "🇯🇵", hint: "Format: 9x xxxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+82",  iso: "KR", name: "South Korea",               flag: "🇰🇷", hint: "Format: 10x xxxx xxxx",       minLen: 9,  maxLen: 10 },
  { code: "+84",  iso: "VN", name: "Vietnam",                   flag: "🇻🇳", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 10 },
  { code: "+86",  iso: "CN", name: "China",                     flag: "🇨🇳", hint: "Format: 1xx xxxx xxxx",       minLen: 11, maxLen: 11 },
  { code: "+90",  iso: "TR", name: "Turkey",                    flag: "🇹🇷", hint: "Format: 5xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+91",  iso: "IN", name: "India",                     flag: "🇮🇳", hint: "Format: 9xxxx xxxxx",         minLen: 10, maxLen: 10 },
  { code: "+92",  iso: "PK", name: "Pakistan",                  flag: "🇵🇰", hint: "Format: 3xx xxxxxxx",         minLen: 10, maxLen: 10 },
  { code: "+93",  iso: "AF", name: "Afghanistan",               flag: "🇦🇫", hint: "Format: 7xx xxx xxxx",        minLen: 9,  maxLen: 9  },
  { code: "+94",  iso: "LK", name: "Sri Lanka",                 flag: "🇱🇰", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+95",  iso: "MM", name: "Myanmar",                   flag: "🇲🇲", hint: "Format: 9x xxx xxxx",         minLen: 7,  maxLen: 9  },
  { code: "+98",  iso: "IR", name: "Iran",                      flag: "🇮🇷", hint: "Format: 9xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+212", iso: "MA", name: "Morocco",                   flag: "🇲🇦", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+213", iso: "DZ", name: "Algeria",                   flag: "🇩🇿", hint: "Format: 5xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+216", iso: "TN", name: "Tunisia",                   flag: "🇹🇳", hint: "Format: 2x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+218", iso: "LY", name: "Libya",                     flag: "🇱🇾", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+220", iso: "GM", name: "Gambia",                    flag: "🇬🇲", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+221", iso: "SN", name: "Senegal",                   flag: "🇸🇳", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+222", iso: "MR", name: "Mauritania",                flag: "🇲🇷", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+223", iso: "ML", name: "Mali",                      flag: "🇲🇱", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+224", iso: "GN", name: "Guinea",                    flag: "🇬🇳", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+225", iso: "CI", name: "Ivory Coast",               flag: "🇨🇮", hint: "Format: xx xx xx xxxx",       minLen: 10, maxLen: 10 },
  { code: "+226", iso: "BF", name: "Burkina Faso",              flag: "🇧🇫", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+227", iso: "NE", name: "Niger",                     flag: "🇳🇪", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+228", iso: "TG", name: "Togo",                      flag: "🇹🇬", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+229", iso: "BJ", name: "Benin",                     flag: "🇧🇯", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+230", iso: "MU", name: "Mauritius",                 flag: "🇲🇺", hint: "Format: 5xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+231", iso: "LR", name: "Liberia",                   flag: "🇱🇷", hint: "Format: xxx xxx xxx",         minLen: 7,  maxLen: 9  },
  { code: "+232", iso: "SL", name: "Sierra Leone",              flag: "🇸🇱", hint: "Format: xx xxxxxx",           minLen: 8,  maxLen: 8  },
  { code: "+233", iso: "GH", name: "Ghana",                     flag: "🇬🇭", hint: "Format: 2x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+234", iso: "NG", name: "Nigeria",                   flag: "🇳🇬", hint: "Format: 8xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+235", iso: "TD", name: "Chad",                      flag: "🇹🇩", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+236", iso: "CF", name: "Central African Republic",  flag: "🇨🇫", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+237", iso: "CM", name: "Cameroon",                  flag: "🇨🇲", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+238", iso: "CV", name: "Cape Verde",                flag: "🇨🇻", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+239", iso: "ST", name: "São Tomé and Príncipe",     flag: "🇸🇹", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+240", iso: "GQ", name: "Equatorial Guinea",         flag: "🇬🇶", hint: "Format: xxx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+241", iso: "GA", name: "Gabon",                     flag: "🇬🇦", hint: "Format: xx xx xxxx",          minLen: 7,  maxLen: 8  },
  { code: "+242", iso: "CG", name: "Republic of the Congo",     flag: "🇨🇬", hint: "Format: xx xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+243", iso: "CD", name: "DR Congo",                  flag: "🇨🇩", hint: "Format: 8xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+244", iso: "AO", name: "Angola",                    flag: "🇦🇴", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+245", iso: "GW", name: "Guinea-Bissau",             flag: "🇬🇼", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+246", iso: "IO", name: "British Indian Ocean Territory", flag: "🇮🇴", hint: "Format: xxx xxxx",       minLen: 7,  maxLen: 7  },
  { code: "+248", iso: "SC", name: "Seychelles",                flag: "🇸🇨", hint: "Format: x xx xxxx",           minLen: 7,  maxLen: 7  },
  { code: "+249", iso: "SD", name: "Sudan",                     flag: "🇸🇩", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+250", iso: "RW", name: "Rwanda",                    flag: "🇷🇼", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+251", iso: "ET", name: "Ethiopia",                  flag: "🇪🇹", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+252", iso: "SO", name: "Somalia",                   flag: "🇸🇴", hint: "Format: xxx xxx xxx",         minLen: 7,  maxLen: 9  },
  { code: "+253", iso: "DJ", name: "Djibouti",                  flag: "🇩🇯", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+254", iso: "KE", name: "Kenya",                     flag: "🇰🇪", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+255", iso: "TZ", name: "Tanzania",                  flag: "🇹🇿", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+256", iso: "UG", name: "Uganda",                    flag: "🇺🇬", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+257", iso: "BI", name: "Burundi",                   flag: "🇧🇮", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+258", iso: "MZ", name: "Mozambique",                flag: "🇲🇿", hint: "Format: 8x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+260", iso: "ZM", name: "Zambia",                    flag: "🇿🇲", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+261", iso: "MG", name: "Madagascar",                flag: "🇲🇬", hint: "Format: 3x xx xxxxx",         minLen: 9,  maxLen: 9  },
  { code: "+262", iso: "RE", name: "Réunion",                   flag: "🇷🇪", hint: "Format: 692 xx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+263", iso: "ZW", name: "Zimbabwe",                  flag: "🇿🇼", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+264", iso: "NA", name: "Namibia",                   flag: "🇳🇦", hint: "Format: 8x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+265", iso: "MW", name: "Malawi",                    flag: "🇲🇼", hint: "Format: 8xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+266", iso: "LS", name: "Lesotho",                   flag: "🇱🇸", hint: "Format: 5xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+267", iso: "BW", name: "Botswana",                  flag: "🇧🇼", hint: "Format: 7x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+268", iso: "SZ", name: "Eswatini",                  flag: "🇸🇿", hint: "Format: 7xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+269", iso: "KM", name: "Comoros",                   flag: "🇰🇲", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+290", iso: "SH", name: "Saint Helena",              flag: "🇸🇭", hint: "Format: xxxx",               minLen: 4,  maxLen: 4  },
  { code: "+291", iso: "ER", name: "Eritrea",                   flag: "🇪🇷", hint: "Format: 7xx xxxxx",           minLen: 7,  maxLen: 7  },
  { code: "+297", iso: "AW", name: "Aruba",                     flag: "🇦🇼", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+298", iso: "FO", name: "Faroe Islands",             flag: "🇫🇴", hint: "Format: xxx xxx",             minLen: 6,  maxLen: 6  },
  { code: "+299", iso: "GL", name: "Greenland",                 flag: "🇬🇱", hint: "Format: xxx xxx",             minLen: 6,  maxLen: 6  },
  { code: "+350", iso: "GI", name: "Gibraltar",                 flag: "🇬🇮", hint: "Format: 5xxxx",              minLen: 5,  maxLen: 8  },
  { code: "+351", iso: "PT", name: "Portugal",                  flag: "🇵🇹", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+352", iso: "LU", name: "Luxembourg",                flag: "🇱🇺", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+353", iso: "IE", name: "Ireland",                   flag: "🇮🇪", hint: "Format: 8x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+354", iso: "IS", name: "Iceland",                   flag: "🇮🇸", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+355", iso: "AL", name: "Albania",                   flag: "🇦🇱", hint: "Format: 6x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+356", iso: "MT", name: "Malta",                     flag: "🇲🇹", hint: "Format: 9xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+357", iso: "CY", name: "Cyprus",                    flag: "🇨🇾", hint: "Format: 9x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+358", iso: "FI", name: "Finland",                   flag: "🇫🇮", hint: "Format: 4x xxx xxxx",         minLen: 9,  maxLen: 10 },
  { code: "+359", iso: "BG", name: "Bulgaria",                  flag: "🇧🇬", hint: "Format: 8x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+370", iso: "LT", name: "Lithuania",                 flag: "🇱🇹", hint: "Format: 6xx xxxxx",           minLen: 8,  maxLen: 8  },
  { code: "+371", iso: "LV", name: "Latvia",                    flag: "🇱🇻", hint: "Format: 2xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+372", iso: "EE", name: "Estonia",                   flag: "🇪🇪", hint: "Format: 5xxx xxxx",           minLen: 7,  maxLen: 8  },
  { code: "+373", iso: "MD", name: "Moldova",                   flag: "🇲🇩", hint: "Format: 6x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+374", iso: "AM", name: "Armenia",                   flag: "🇦🇲", hint: "Format: 9x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+375", iso: "BY", name: "Belarus",                   flag: "🇧🇾", hint: "Format: 2x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+376", iso: "AD", name: "Andorra",                   flag: "🇦🇩", hint: "Format: xxx xxx",             minLen: 6,  maxLen: 6  },
  { code: "+377", iso: "MC", name: "Monaco",                    flag: "🇲🇨", hint: "Format: 6xx xxx xxx",         minLen: 8,  maxLen: 9  },
  { code: "+378", iso: "SM", name: "San Marino",                flag: "🇸🇲", hint: "Format: 6xx xxxxx",           minLen: 6,  maxLen: 10 },
  { code: "+380", iso: "UA", name: "Ukraine",                   flag: "🇺🇦", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+381", iso: "RS", name: "Serbia",                    flag: "🇷🇸", hint: "Format: 6x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+382", iso: "ME", name: "Montenegro",                flag: "🇲🇪", hint: "Format: 6x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+385", iso: "HR", name: "Croatia",                   flag: "🇭🇷", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+386", iso: "SI", name: "Slovenia",                  flag: "🇸🇮", hint: "Format: 4x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+387", iso: "BA", name: "Bosnia and Herzegovina",    flag: "🇧🇦", hint: "Format: 6x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+389", iso: "MK", name: "North Macedonia",           flag: "🇲🇰", hint: "Format: 7x xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+420", iso: "CZ", name: "Czech Republic",            flag: "🇨🇿", hint: "Format: 6xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+421", iso: "SK", name: "Slovakia",                  flag: "🇸🇰", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+423", iso: "LI", name: "Liechtenstein",             flag: "🇱🇮", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 9  },
  { code: "+500", iso: "FK", name: "Falkland Islands",          flag: "🇫🇰", hint: "Format: xxxxx",              minLen: 5,  maxLen: 5  },
  { code: "+501", iso: "BZ", name: "Belize",                    flag: "🇧🇿", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+502", iso: "GT", name: "Guatemala",                 flag: "🇬🇹", hint: "Format: 4xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+503", iso: "SV", name: "El Salvador",               flag: "🇸🇻", hint: "Format: 7xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+504", iso: "HN", name: "Honduras",                  flag: "🇭🇳", hint: "Format: 9xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+505", iso: "NI", name: "Nicaragua",                 flag: "🇳🇮", hint: "Format: 8xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+506", iso: "CR", name: "Costa Rica",                flag: "🇨🇷", hint: "Format: 8xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+507", iso: "PA", name: "Panama",                    flag: "🇵🇦", hint: "Format: 6xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+508", iso: "PM", name: "Saint Pierre and Miquelon", flag: "🇵🇲", hint: "Format: xxx xxx",             minLen: 6,  maxLen: 6  },
  { code: "+509", iso: "HT", name: "Haiti",                     flag: "🇭🇹", hint: "Format: 3x xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+590", iso: "GP", name: "Guadeloupe",                flag: "🇬🇵", hint: "Format: 690 xx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+591", iso: "BO", name: "Bolivia",                   flag: "🇧🇴", hint: "Format: 7xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+592", iso: "GY", name: "Guyana",                    flag: "🇬🇾", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+593", iso: "EC", name: "Ecuador",                   flag: "🇪🇨", hint: "Format: 9xx xxx xxxx",        minLen: 9,  maxLen: 9  },
  { code: "+594", iso: "GF", name: "French Guiana",             flag: "🇬🇫", hint: "Format: 694 xx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+595", iso: "PY", name: "Paraguay",                  flag: "🇵🇾", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+596", iso: "MQ", name: "Martinique",                flag: "🇲🇶", hint: "Format: 696 xx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+597", iso: "SR", name: "Suriname",                  flag: "🇸🇷", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+598", iso: "UY", name: "Uruguay",                   flag: "🇺🇾", hint: "Format: 9x xxx xxxx",         minLen: 8,  maxLen: 8  },
  { code: "+599", iso: "CW", name: "Curaçao",                   flag: "🇨🇼", hint: "Format: 9xxx xxxx",           minLen: 7,  maxLen: 8  },
  { code: "+670", iso: "TL", name: "Timor-Leste",               flag: "🇹🇱", hint: "Format: 7xx xxxxx",           minLen: 7,  maxLen: 8  },
  { code: "+672", iso: "NF", name: "Norfolk Island",            flag: "🇳🇫", hint: "Format: xxxxx",              minLen: 5,  maxLen: 6  },
  { code: "+673", iso: "BN", name: "Brunei",                    flag: "🇧🇳", hint: "Format: 7xx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+674", iso: "NR", name: "Nauru",                     flag: "🇳🇷", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+675", iso: "PG", name: "Papua New Guinea",          flag: "🇵🇬", hint: "Format: 7xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+676", iso: "TO", name: "Tonga",                     flag: "🇹🇴", hint: "Format: xxx xxxx",            minLen: 5,  maxLen: 7  },
  { code: "+677", iso: "SB", name: "Solomon Islands",           flag: "🇸🇧", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+678", iso: "VU", name: "Vanuatu",                   flag: "🇻🇺", hint: "Format: xxx xxxx",            minLen: 5,  maxLen: 7  },
  { code: "+679", iso: "FJ", name: "Fiji",                      flag: "🇫🇯", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+680", iso: "PW", name: "Palau",                     flag: "🇵🇼", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+682", iso: "CK", name: "Cook Islands",              flag: "🇨🇰", hint: "Format: xxxxx",              minLen: 5,  maxLen: 5  },
  { code: "+685", iso: "WS", name: "Samoa",                     flag: "🇼🇸", hint: "Format: xxx xxxx",            minLen: 5,  maxLen: 7  },
  { code: "+686", iso: "KI", name: "Kiribati",                  flag: "🇰🇮", hint: "Format: xxxxx",              minLen: 5,  maxLen: 8  },
  { code: "+687", iso: "NC", name: "New Caledonia",             flag: "🇳🇨", hint: "Format: xx xxxx",             minLen: 6,  maxLen: 6  },
  { code: "+688", iso: "TV", name: "Tuvalu",                    flag: "🇹🇻", hint: "Format: xxxxx",              minLen: 5,  maxLen: 6  },
  { code: "+689", iso: "PF", name: "French Polynesia",          flag: "🇵🇫", hint: "Format: xx xx xxxx",          minLen: 8,  maxLen: 8  },
  { code: "+690", iso: "TK", name: "Tokelau",                   flag: "🇹🇰", hint: "Format: xxxx",               minLen: 4,  maxLen: 4  },
  { code: "+691", iso: "FM", name: "Micronesia",                flag: "🇫🇲", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+692", iso: "MH", name: "Marshall Islands",          flag: "🇲🇭", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+850", iso: "KP", name: "North Korea",               flag: "🇰🇵", hint: "Format: xxx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+852", iso: "HK", name: "Hong Kong",                 flag: "🇭🇰", hint: "Format: xxxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+853", iso: "MO", name: "Macau",                     flag: "🇲🇴", hint: "Format: 6xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+855", iso: "KH", name: "Cambodia",                  flag: "🇰🇭", hint: "Format: 1x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+856", iso: "LA", name: "Laos",                      flag: "🇱🇦", hint: "Format: 2x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+880", iso: "BD", name: "Bangladesh",                flag: "🇧🇩", hint: "Format: 1xxx xxxxxx",         minLen: 10, maxLen: 10 },
  { code: "+886", iso: "TW", name: "Taiwan",                    flag: "🇹🇼", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+960", iso: "MV", name: "Maldives",                  flag: "🇲🇻", hint: "Format: xxx xxxx",            minLen: 7,  maxLen: 7  },
  { code: "+961", iso: "LB", name: "Lebanon",                   flag: "🇱🇧", hint: "Format: 7x xxx xxx",          minLen: 7,  maxLen: 8  },
  { code: "+962", iso: "JO", name: "Jordan",                    flag: "🇯🇴", hint: "Format: 7x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+963", iso: "SY", name: "Syria",                     flag: "🇸🇾", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+964", iso: "IQ", name: "Iraq",                      flag: "🇮🇶", hint: "Format: 7xx xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+965", iso: "KW", name: "Kuwait",                    flag: "🇰🇼", hint: "Format: 5xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+966", iso: "SA", name: "Saudi Arabia",              flag: "🇸🇦", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+967", iso: "YE", name: "Yemen",                     flag: "🇾🇪", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+968", iso: "OM", name: "Oman",                      flag: "🇴🇲", hint: "Format: 9xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+970", iso: "PS", name: "Palestine",                 flag: "🇵🇸", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+971", iso: "AE", name: "UAE",                       flag: "🇦🇪", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+972", iso: "IL", name: "Israel",                    flag: "🇮🇱", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+973", iso: "BH", name: "Bahrain",                   flag: "🇧🇭", hint: "Format: 3xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+974", iso: "QA", name: "Qatar",                     flag: "🇶🇦", hint: "Format: 3xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+975", iso: "BT", name: "Bhutan",                    flag: "🇧🇹", hint: "Format: 17 xxx xxx",          minLen: 8,  maxLen: 8  },
  { code: "+976", iso: "MN", name: "Mongolia",                  flag: "🇲🇳", hint: "Format: 8xxx xxxx",           minLen: 8,  maxLen: 8  },
  { code: "+977", iso: "NP", name: "Nepal",                     flag: "🇳🇵", hint: "Format: 98x xxx xxxx",        minLen: 10, maxLen: 10 },
  { code: "+992", iso: "TJ", name: "Tajikistan",                flag: "🇹🇯", hint: "Format: 9xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+993", iso: "TM", name: "Turkmenistan",              flag: "🇹🇲", hint: "Format: 6x xxx xxxx",         minLen: 8,  maxLen: 8  },
  { code: "+994", iso: "AZ", name: "Azerbaijan",                flag: "🇦🇿", hint: "Format: 5x xxx xxxx",         minLen: 9,  maxLen: 9  },
  { code: "+995", iso: "GE", name: "Georgia",                   flag: "🇬🇪", hint: "Format: 5xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+996", iso: "KG", name: "Kyrgyzstan",                flag: "🇰🇬", hint: "Format: 7xx xxx xxx",         minLen: 9,  maxLen: 9  },
  { code: "+998", iso: "UZ", name: "Uzbekistan",                flag: "🇺🇿", hint: "Format: 9x xxx xxxx",         minLen: 9,  maxLen: 9  },
];

// ─── Country Code Selector Component ─────────────────────────────────────────

function CountryCodeSelector({
  value,
  onChange,
}: {
  value: CountryCode;
  onChange: (c: CountryCode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = search.trim()
    ? COUNTRY_CODES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
      )
    : COUNTRY_CODES;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setSearch(""); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          height: "100%",
          padding: "0 0.65rem",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(212,175,55,0.3)",
          borderRadius: 4,
          color: "#FFFFFF",
          cursor: "pointer",
          fontSize: "0.85rem",
          whiteSpace: "nowrap",
          transition: "border-color 0.2s",
          minWidth: 72,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D4AF37"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.3)"; }}
      >
        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{value.flag}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "0.8rem" }}>{value.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, marginLeft: 2 }}>
          <path d="M2 3.5L5 6.5L8 3.5" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 9999,
            background: "#0d2d52",
            border: "1px solid rgba(212,175,55,0.3)",
            borderRadius: 6,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            width: 240,
            maxHeight: 280,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search country or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(212,175,55,0.25)",
                borderRadius: 4,
                padding: "0.35rem 0.6rem",
                color: "#FFFFFF",
                fontSize: "0.78rem",
                fontFamily: "'Inter', sans-serif",
                outline: "none",
              }}
            />
          </div>
          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 ? (
              <p style={{ padding: "0.75rem", color: "rgba(230,230,230,0.4)", fontSize: "0.75rem", textAlign: "center" }}>No results</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    width: "100%",
                    padding: "0.45rem 0.75rem",
                    background: value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.1)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent"; }}
                >
                  <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                  <span style={{ color: "#D4AF37", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0, minWidth: 36 }}>{c.code}</span>
                  <span style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  const [countryCode, setCountryCode] = useState<CountryCode>(COUNTRY_CODES[0]); // default +1 US
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

  // Phone digit count validation against selected country's min/max
  const getPhoneError = (): string => {
    const digits = form.phone.replace(/\D/g, "");
    if (!digits) return "Required";
    if (digits.length < countryCode.minLen) {
      return `A valid ${countryCode.name} number requires at least ${countryCode.minLen} digits`;
    }
    if (digits.length > countryCode.maxLen) {
      return `A valid ${countryCode.name} number has at most ${countryCode.maxLen} digits`;
    }
    return "";
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const phoneErr = getPhoneError();
    if (!form.firstName.trim() || form.firstName.trim().length < 2 || !form.lastName.trim() || form.lastName.trim().length < 2 || phoneErr || !form.company.trim() || !form.role) {
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
      phone: normalizePhone(countryCode.code + (form.phone || "")), // full international number
      ai_country_name: countryCode.name,
      ai_country_iso: countryCode.iso,
      company: form.company,
      role: form.role,
      // UTM attribution
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    };

    saveToLocalStorage("lead_capture", payload);
    await sendWebhook(payload);

    setLoading(false);
    // Pass country through to Results/ThankYou screens via LeadData
    const leadWithCountry: LeadData = {
      ...form,
      phone: normalizePhone(countryCode.code + (form.phone || "")),
      country_name: countryCode.name,  // stored on LeadData for internal use
      country_iso: countryCode.iso,
    };
    onContinue(leadWithCountry);
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
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "stretch",
              borderRadius: 4,
              ...(submitted && getPhoneError() ? { outline: "1px solid #E53935" } : {}),
            }}
          >
            <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
            <input
              className="dru-input"
              type="tel"
              placeholder="555 000 0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                ...(submitted && getPhoneError() ? { borderColor: "#E53935" } : {}),
              }}
            />
          </div>
          {/* Live format hint — always visible, updates when country changes */}
          {!submitted || !getPhoneError() ? (
            <p className="text-xs mt-1" style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif" }}>
              {countryCode.hint}
            </p>
          ) : (
            <p className="text-xs mt-1" style={{ color: "#E53935" }}>{getPhoneError()}</p>
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
  // Strongest pillar: highest scoring
  const strongestPillar = [...pillars].sort((a, b) => b.score - a.score)[0];

  const ctaLabel = "Take The Next Step →";

  // Score comparison: static percentile benchmarks per tier
  const BENCHMARK_PERCENTILES: Record<string, number> = {
    EMERGING: 25,
    DEVELOPING: 52,
    ADVANCING: 74,
    LEADING: 93,
  };
  const percentile = BENCHMARK_PERCENTILES[tier.label];

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
      ai_country_name: lead.country_name || "",
      ai_country_iso: lead.country_iso || "",
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
        minHeight: "100%",
        background: "#0A2342",
        overflowY: "auto",
        overflowX: "hidden",
        padding: "clamp(1rem, 4vw, 1.5rem) clamp(0.875rem, 4vw, 1.25rem) 2rem",
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* Page indicator */}
      <div className="flex justify-end mb-2">
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 7 of 8</span>
      </div>

      {/* Overall Score — stacks vertically on mobile to prevent overlap */}
      <div className="flex flex-col items-center mb-4" style={{ gap: "0.75rem" }}>
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(230,230,230,0.5)" }}>
            Your Score
          </p>
          <div
            className="count-up font-bold"
            style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1, fontSize: "clamp(2.5rem, 12vw, 3rem)" }}
          >
            {scaledScore}
            <span style={{ color: "rgba(212,175,55,0.5)", fontSize: "clamp(1.25rem, 6vw, 1.5rem)" }}>
              /100
            </span>
          </div>
        </div>
        <div
          className="font-bold tracking-widest px-4 py-2 rounded"
          style={{ color: tier.color, border: `1.5px solid ${tier.color}`, fontFamily: "'Inter', sans-serif", background: `${tier.color}18`, fontSize: "clamp(0.8rem, 4vw, 1rem)", letterSpacing: "0.12em" }}
        >
          {tier.label}
        </div>
      </div>

      {/* Score comparison line */}
      <p
        className="text-xs text-center mb-4"
        style={{ color: "rgba(212,175,55,0.75)", fontStyle: "italic", lineHeight: 1.6, padding: "0 0.5rem" }}
      >
        You scored higher than <strong style={{ color: "#D4AF37" }}>{percentile}%</strong> of organizations assessed on AI readiness.
      </p>

      <div className="gold-divider mb-3" />

      {/* Pillar Breakdown — compact */}
      <div className="mb-4">
        <h3
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: "rgba(212,175,55,0.7)" }}
        >
          Pillar Breakdown
        </h3>
        <div className="flex flex-col" style={{ gap: "0.6rem" }}>
          {pillars.map((p) => (
            <div key={p.name}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem", gap: "0.25rem" }}>
                <span style={{ color: "#E6E6E6", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                  {p.name[0]} — {p.name}
                </span>
                <span style={{ color: "#D4AF37", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
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

      {/* Strongest Pillar — compact */}
      {strongestPillar && (
        <div className="mb-4">
          <h3
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(212,175,55,0.7)" }}
          >
            Your Strongest Pillar
          </h3>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <span style={{ color: "#43A047", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>★</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>
                  {strongestPillar.name} — {strongestPillar.score}/15
                </p>
                <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>
                  {STRENGTH_MESSAGES[strongestPillar.name]}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Gap Areas — compact */}
      {topGaps.length > 0 && (
        <div className="mb-4">
          <h3
            className="text-xs font-semibold uppercase tracking-widest mb-2"
            style={{ color: "rgba(212,175,55,0.7)" }}
          >
            Top Gap Areas
          </h3>
          <div className="flex flex-col gap-2">
            {topGaps.map((g) => (
              <div key={g.name} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.6rem 0.75rem", wordBreak: "break-word", overflowWrap: "break-word" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                  <span style={{ color: "#D4AF37", fontSize: "0.85rem", marginTop: 1, flexShrink: 0 }}>⚠</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: "#FFFFFF", fontSize: "clamp(0.68rem, 2.8vw, 0.75rem)", fontWeight: 600, marginBottom: "0.25rem" }}>
                      {g.name} Gap
                    </p>
                    <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.6vw, 0.7rem)", lineHeight: 1.6, margin: 0 }}>
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
      <div className="dru-card mb-4" style={{ padding: "0.75rem 0.875rem" }}>
        <p style={{ color: "#E6E6E6", fontSize: "clamp(0.65rem, 2.8vw, 0.7rem)", lineHeight: 1.7 }}>
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
  // Referral URL: appends ?ref=<email> so referred visitors are attributed to this promoter
  const refParam = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
  const assessmentUrl = `https://assessment.druaiconsulting.com${refParam}`;

  // Unified share message used across ALL channels
  const shareText = `I just completed my AI Readiness Assessment by DRU AI Consulting and scored ${scaledScore}/100. See how ready YOUR business is for AI — take the free assessment here: ${assessmentUrl}`;

  // Per-channel URLs
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(assessmentUrl)}&summary=${encodeURIComponent(shareText)}`;
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(assessmentUrl)}&text=${encodeURIComponent(shareText)}`;
  const emailSubject = encodeURIComponent("Your DRU AI Readiness Assessment Score");
  const emailBody = encodeURIComponent(`I just completed my AI Readiness Assessment by DRU AI Consulting and scored ${scaledScore}/100. See how ready YOUR business is for AI — take the free assessment here: ${assessmentUrl}`);
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  // Copy Link state
  const [copied, setCopied] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
    fireShareWebhook("clipboard");
  };

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
      ai_country_name: lead.country_name || "",
      ai_country_iso: lead.country_iso || "",
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    });
  };



  const badgeUrl = BADGE_URLS[tier.label];

  // PDF report generation
  const [pdfLoading, setPdfLoading] = useState(false);

  const generatePdf = () => {
    setPdfLoading(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const W = 210;
      const margin = 20;
      const contentW = W - margin * 2;
      let y = 0;

      // ── Header band ──────────────────────────────────────────────────────────
      doc.setFillColor(10, 35, 66); // #0A2342
      doc.rect(0, 0, W, 42, "F");

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(212, 175, 55); // #D4AF37
      doc.text("DRU CLEAR\u2122 AI Readiness Report", margin, 18);

      // Tagline
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(230, 230, 230);
      doc.text("AI Mastery. Leadership Clarity. Measurable Results.", margin, 26);

      // Date
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 180);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 34);

      y = 54;

      // ── Contact info ─────────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(10, 35, 66);
      doc.text(`${lead.firstName} ${lead.lastName}`, margin, y);
      y += 7;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`${lead.company}  |  ${lead.role}  |  ${lead.email}`, margin, y);
      y += 12;

      // ── Score & Tier ─────────────────────────────────────────────────────────
      doc.setFillColor(10, 35, 66);
      doc.roundedRect(margin, y, contentW, 28, 3, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(212, 175, 55);
      doc.text(`${scaledScore}/100`, margin + 8, y + 18);

      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text(tier.label, margin + 50, y + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      const tierMsg = TIER_MESSAGES[tier.label] || "";
      const tierLines = doc.splitTextToSize(tierMsg, contentW - 55);
      doc.text(tierLines, margin + 50, y + 20);
      y += 36;

      // ── Score comparison ─────────────────────────────────────────────────────
      const BENCH: Record<string, number> = { EMERGING: 25, DEVELOPING: 52, ADVANCING: 74, LEADING: 93 };
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`You scored higher than ${BENCH[tier.label]}% of organizations assessed on AI readiness.`, margin, y);
      y += 10;

      // ── Pillar Breakdown ──────────────────────────────────────────────────────
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(10, 35, 66);
      doc.text("CLEAR\u2122 Pillar Breakdown", margin, y);
      y += 2;
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(margin, y + 2, margin + contentW, y + 2);
      y += 7;

      const pillarsData = [
        { name: "Clarity", score: getPillarScore(scores, 0) },
        { name: "Leadership", score: getPillarScore(scores, 3) },
        { name: "Execution", score: getPillarScore(scores, 6) },
        { name: "Alignment", score: getPillarScore(scores, 9) },
        { name: "Results", score: getPillarScore(scores, 12) },
      ];

      for (const p of pillarsData) {
        const pct = p.score / 15;
        // Label
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        doc.text(`${p.name[0]} — ${p.name}`, margin, y + 4);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(10, 35, 66);
        doc.text(`${p.score}/15`, margin + contentW - 10, y + 4, { align: "right" });
        // Bar track
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(margin, y + 6, contentW, 4, 1, 1, "F");
        // Bar fill
        doc.setFillColor(212, 175, 55);
        doc.roundedRect(margin, y + 6, contentW * pct, 4, 1, 1, "F");
        y += 14;
      }

      y += 4;

      // ── Strongest Pillar ──────────────────────────────────────────────────────
      const strongest = [...pillarsData].sort((a, b) => b.score - a.score)[0];
      doc.setFillColor(240, 248, 240);
      doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
      doc.setDrawColor(67, 160, 71);
      doc.setLineWidth(0.8);
      doc.line(margin, y, margin, y + 22);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 100, 30);
      doc.text(`\u2605 Strongest Pillar: ${strongest.name} (${strongest.score}/15)`, margin + 4, y + 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
      const strLines = doc.splitTextToSize(STRENGTH_MESSAGES[strongest.name] || "", contentW - 6);
      doc.text(strLines, margin + 4, y + 13);
      y += 28;

      // ── Top Gap Areas ─────────────────────────────────────────────────────────
      const gaps = [...pillarsData].sort((a, b) => a.score - b.score).filter(p => p.score < 12).slice(0, 2);
      if (gaps.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(10, 35, 66);
        doc.text("Top Gap Areas", margin, y);
        y += 2;
        doc.setDrawColor(212, 175, 55);
        doc.line(margin, y + 2, margin + contentW, y + 2);
        y += 7;

        for (const g of gaps) {
          doc.setFillColor(255, 248, 240);
          doc.roundedRect(margin, y, contentW, 22, 2, 2, "F");
          doc.setDrawColor(212, 175, 55);
          doc.setLineWidth(0.8);
          doc.line(margin, y, margin, y + 22);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(150, 80, 0);
          doc.text(`\u26A0 ${g.name} Gap (${g.score}/15)`, margin + 4, y + 7);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(60, 60, 60);
          const gapLines = doc.splitTextToSize(GAP_MESSAGES[g.name] || "", contentW - 6);
          doc.text(gapLines, margin + 4, y + 13);
          y += 28;
        }
      }

      // ── CTA ───────────────────────────────────────────────────────────────────
      y += 4;
      doc.setFillColor(194, 24, 91); // #C2185B
      doc.roundedRect(margin, y, contentW, 14, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text("Book Your AI Strategy Consultation: druaiconsulting.com/appointment", W / 2, y + 9, { align: "center" });
      y += 20;

      // ── Footer ────────────────────────────────────────────────────────────────
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("\u00A9 DRU AI Consulting  |  druaiconsulting.com  |  This report is for informational purposes only.", W / 2, 285, { align: "center" });

      doc.save(`DRU-CLEAR-Report-${lead.firstName}-${lead.lastName}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  // Feedback state
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleFeedback = (rating: "up" | "down") => {
    if (feedback) return; // already submitted
    setFeedback(rating);
    sendWebhook({
      event: "feedback",
      rating,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      score: scaledScore,
      result: tier.label,
      ai_country_name: lead.country_name || "",
      ai_country_iso: lead.country_iso || "",
      ...UTM_PARAMS,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div
      className="screen-enter flex flex-col items-center"
      style={{
        height: "100%",
        background: "#0A2342",
        overflowY: "auto",
        padding: "2rem 1.5rem 2.5rem",
        textAlign: "center",
      }}
    >
      {/* Page indicator */}
      <div className="flex justify-end w-full mb-2" style={{ maxWidth: 320 }}>
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 8 of 8</span>
      </div>

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

      {/* Tier Badge Image */}
      {badgeUrl && (
        <img
          src={badgeUrl}
          alt={`${tier.label} tier badge`}
          loading="eager"
          width="320"
          height="168"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          style={{
            width: "100%",
            maxWidth: 320,
            height: "auto",
            display: "block",
            borderRadius: 8,
            marginBottom: "1.5rem",
            border: `1px solid ${tier.color}30`,
            boxShadow: `0 4px 24px ${tier.color}20`,
          }}
        />
      )}

      {/* Book CTA Button */}
      <a
        href="https://druaiconsulting.com/appointment"
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
        Book Your Clarity Call
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center" }}>
          {/* Email */}
          <a
            href={emailUrl}
            onClick={() => fireShareWebhook("email")}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", borderRadius: 4, border: "1px solid rgba(212,175,55,0.4)", letterSpacing: "0.02em", transition: "border-color 0.2s, background 0.2s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#D4AF37"; (e.currentTarget as HTMLAnchorElement).style.background = "rgba(212,175,55,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            Email
          </a>
          {/* LinkedIn */}
          <a
            href={linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireShareWebhook("linkedin")}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", background: "#0077B5", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", borderRadius: 4, letterSpacing: "0.02em", transition: "background 0.2s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#005f8e"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0077B5"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
            LinkedIn
          </a>
          {/* WhatsApp */}
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireShareWebhook("whatsapp")}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", background: "#25D366", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", borderRadius: 4, letterSpacing: "0.02em", transition: "background 0.2s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#1da851"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#25D366"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          {/* Telegram */}
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => fireShareWebhook("telegram")}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", background: "#0088cc", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", textDecoration: "none", borderRadius: 4, letterSpacing: "0.02em", transition: "background 0.2s", whiteSpace: "nowrap" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#006699"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#0088cc"; }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </a>
          {/* Copy Link */}
          <button
            onClick={handleCopyLink}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 0.9rem", background: copied ? "rgba(212,175,55,0.15)" : "transparent", color: copied ? "#D4AF37" : "rgba(230,230,230,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.75rem", border: "1px solid " + (copied ? "#D4AF37" : "rgba(230,230,230,0.25)"), borderRadius: 4, cursor: "pointer", letterSpacing: "0.02em", transition: "all 0.2s", whiteSpace: "nowrap" }}
          >
            {copied ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* PDF Download Button */}
      <button
        onClick={generatePdf}
        disabled={pdfLoading}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          width: "100%",
          maxWidth: 320,
          marginBottom: "1.25rem",
          padding: "0.75rem 1.5rem",
          background: "transparent",
          color: "#D4AF37",
          fontFamily: "'Montserrat', sans-serif",
          fontWeight: 700,
          fontSize: "0.88rem",
          letterSpacing: "0.04em",
          border: "1.5px solid rgba(212,175,55,0.5)",
          borderRadius: 4,
          cursor: pdfLoading ? "wait" : "pointer",
          opacity: pdfLoading ? 0.6 : 1,
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => { if (!pdfLoading) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.1)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#D4AF37"; } }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.5)"; }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        {pdfLoading ? "Generating..." : "Download Your Report (PDF)"}
      </button>

      {/* Feedback Prompt */}
      <div
        style={{
          width: "100%",
          maxWidth: 320,
          marginBottom: "2rem",
          padding: "1rem 1.25rem",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(230,230,230,0.1)",
          borderRadius: 6,
          textAlign: "center",
        }}
      >
        {feedback === null ? (
          <>
            <p className="text-xs mb-3" style={{ color: "rgba(230,230,230,0.6)", fontFamily: "'Inter', sans-serif" }}>
              Was this assessment helpful?
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleFeedback("up")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.45rem 1rem",
                  background: "transparent",
                  color: "rgba(230,230,230,0.6)",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  border: "1px solid rgba(230,230,230,0.2)",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(67,160,71,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#43A047"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(67,160,71,0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(230,230,230,0.6)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(230,230,230,0.2)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                Yes
              </button>
              <button
                onClick={() => handleFeedback("down")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.45rem 1rem",
                  background: "transparent",
                  color: "rgba(230,230,230,0.6)",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  border: "1px solid rgba(230,230,230,0.2)",
                  borderRadius: 4,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(229,57,53,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "#E53935"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(229,57,53,0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(230,230,230,0.6)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(230,230,230,0.2)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                  <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
                </svg>
                Not Really
              </button>
            </div>
          </>
        ) : (
          <p className="text-xs" style={{ color: feedback === "up" ? "#43A047" : "rgba(230,230,230,0.5)", fontFamily: "'Inter', sans-serif" }}>
            {feedback === "up" ? "Thank you! We're glad it was helpful. ♥" : "Thanks for the feedback. We'll keep improving."}
          </p>
        )}
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

      {screen === "results" && <ResultsScreen lead={lead} scores={scores} onBookCall={() => goTo("thank-you")} />}

      {screen === "thank-you" && <ThankYouScreen lead={lead} scores={scores} />}
    </div>
  );
}
