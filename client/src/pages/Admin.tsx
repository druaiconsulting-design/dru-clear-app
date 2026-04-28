import { useState, useEffect } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

// ── Admin data ────────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: "GHL Dashboard",      href: "https://crm.aiforbusiness.com/v2/location/gl07I4JnbkGgW8zJprSz/dashboard", icon: "🔗" },
  { label: "Live Assessment",    href: "https://assessment.druaiconsulting.com", icon: "🚀" },
  { label: "Main Website",       href: "https://druaiconsulting.com", icon: "🌐" },
  { label: "Frameworks Page",    href: "https://frameworks.druaiconsulting.com", icon: "📐" },
  { label: "GitHub — App",       href: "https://github.com/druaiconsulting-design/dru-clear-app", icon: "💻" },
  { label: "GitHub — Website",   href: "https://github.com/druaiconsulting-design/druaiconsulting-website", icon: "💻" },
  { label: "GitHub — Frameworks",href: "https://github.com/druaiconsulting-design/druaiconsulting-frameworks", icon: "💻" },
  { label: "Terms of Engagement",href: "https://app.druaiconsulting.com/terms", icon: "📄" },
];

const PAYMENT_LINKS = [
  { label: "Executive Diagnostic",              price: "$4,997",  href: "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645", color: "#C2185B" },
  { label: "Strategic Diagnostic",              price: "$3,497",  href: "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222", color: "#D4AF37" },
  { label: "DRU CLEAR™ Framework",              price: "$7,500",  href: "https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec", color: "#D4AF37" },
  { label: "5D Leadership™",                    price: "$6,500",  href: "https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc", color: "#1E88E5" },
  { label: "5C Cultural DNA™",                  price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def", color: "#C2185B" },
  { label: "AI Sales Mastery™",                 price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe", color: "#C2185B" },
  { label: "Full Ecosystem — Signing ($13K)",    price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff", color: "#43A047" },
  { label: "Full Ecosystem — Final ($13K)",      price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e50e30557558e89e520fb6", color: "#43A047" },
  { label: "DRU CLEAR™ Navigator — Founder",    price: "$47/mo",  href: "https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0", color: "#D4AF37" },
  { label: "DRU CLEAR™ Accelerator — Founder",  price: "$147/mo", href: "https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1", color: "#C2185B" },
];

const PENDING_ITEMS = [
  "SMS sequences — pending GHL phone number provisioning",
  "Add 2 PDFs to app for user access — delegated to AI Agents (Sprint 4)",
];

const SPRINTS = [
  {
    number: "1 & 2", title: "Foundation", status: "completed",
    items: [
      { label: "DRU CLEAR™ Scorecard PWA live", sub: "assessment.druaiconsulting.com redirects to app.druaiconsulting.com" },
      { label: "5 GHL automation workflows", sub: "Lead capture, completion, nurture, purchase workflows" },
      { label: "React Router architecture — 7 pages live", sub: "Portal, Frameworks, Resources, Daily, ROI, Affiliate, Admin" },
      { label: "Supabase backend database", sub: "Persistent accounts, RLS security, profiles table" },
      { label: "Google Sign In + email/password login", sub: "Automated password reset · admin private door" },
      { label: "Admin Command Center", sub: "CLIENT VIEW / ADMIN VIEW toggle in navbar · private door at /admin" },
      { label: "All 4 IP framework descriptions written", sub: "DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™" },
      { label: "Framework infographics embedded in Frameworks page", sub: "4 images live · price badge top right · brand badge bottom left" },
    ],
  },
  {
    number: "3", title: "Revenue + Polish", status: "completed",
    items: [
      { label: "Full pricing architecture — LIVE", sub: "SD $3,497 · ED $4,997 · 4 frameworks · bundles · Full Ecosystem $26K" },
      { label: "All 8 payment links active", sub: "Terms modal → payment iframe → branded thank you page" },
      { label: "8 branded thank you pages — LIVE", sub: "ED/SD with calendar · 4 frameworks · Full Ecosystem with payment split" },
      { label: "Full Ecosystem payment split", sub: "$13K signing + $13K final — separate GHL payment links" },
      { label: "Dynamic browser tab titles", sub: "Every page has its own DRU CLEAR™ tab title" },
      { label: "Personalized Portal — name + avatar", sub: "Google photo or initials · Welcome Back, [FirstName] · trust stored names" },
      { label: "Portal rebuilt as personal dashboard", sub: "3 cards: My Assessment · Daily Connection · Need Support" },
      { label: "Resources page cleaned up", sub: "Email capture removed · New This Week banner · resources added weekly note" },
      { label: "Affiliate page updated", sub: "New copy · real links · GHL note · Suggest a Tool → info@druaiconsulting.com" },
      { label: "Reset password flow — LIVE", sub: "type=signup + type=recovery both route to branded ResetPassword page · show/hide password" },
      { label: "NavBar restored — CLIENT VIEW / ADMIN VIEW", sub: "Toggle follows admin across all pages · Client View → /portal · Admin View → /admin" },
      { label: "Community Landing Page — LIVE", sub: "Founders Special · Navigator $47/mo · Accelerator $147/mo · real GHL payment links wired" },
      { label: "GHL Homepage Funnel — LIVE", sub: "15-section branded homepage · single CTA → assessment · QR code section" },
      { label: "frameworks.druaiconsulting.com — LIVE", sub: "Standalone frameworks page deployed on Vercel · connected to GoDaddy" },
      { label: "GitHub repos organized", sub: "druaiconsulting-website · druaiconsulting-frameworks · all brand assets hosted" },
      { label: "Magazine bio — locked", sub: "Universal bio · April 30 print deadline · QR code included" },
      { label: "Admin Command Center live stats", sub: "Supabase stats table · Edge Function · GHL webhooks wired · real-time counts" },
      { label: "Free tier access — Supabase tier field", sub: "free | paid · RLS controls · assessment auto-creates free account" },
      { label: "Free tier — Daily Connections", sub: "AI Leadership Insight free · Micro-Lesson + Action Challenge locked for paid" },
      { label: "Free tier — Resources", sub: "1 free PDF · rest locked · upgrade prompt" },
      { label: "PWA favicon updated — DC shield icon", sub: "icon-192x192.png and icon-512x512.png · CDN links replaced" },
      { label: "PWA Auth Redirect — returning users routed to app", sub: "Supabase session check on mount · valid session → app.druaiconsulting.com" },
      { label: "Route Security — all protected routes locked", sub: "/frameworks · /community · /affiliate require login · no bypass possible" },
      { label: "Dynamic Transformation Pathway™ — fully automated", sub: "pathway_stage in Supabase · 3 values map to 5 visual stages · paired unlocks · Edge Function auto-updates on purchase" },
      { label: "GHL tags — framework-purchased · bundle-purchased", sub: "Fires Edge Function to update pathway_stage to deploy · unlocks Deploy + Dominate" },
      { label: "Daily Connections automated engine — LIVE", sub: "Claude API generates 3 content sets daily at 6am CST · stage-aware · leadership WITH AI · stored in Supabase" },
      { label: "Smart notification dot — full state sequence", sub: "Unread: red pulsing · Read: gold glow · Completed: 🔥 streak · 7-day: gold card border glow + milestone banner" },
      { label: "Streak tracking — Supabase persistent", sub: "current_streak · longest_streak · total_completions · shown on Portal card and Daily page" },
      { label: "Mark Completed button — gold on completion", sub: "Blue → gold with glow + checkmark · streak fires · Portal dot updates on tab return" },
      { label: "Need Support — mailto with pre-filled subject", sub: "Opens email client · support@druaiconsulting.com · Subject: Support Request — DRU CLEAR™ Member" },
      { label: "My Assessment — routes to assessment site", sub: "https://assessment.druaiconsulting.com · fixes auth loop for logged-in users" },
    ],
  },
  {
    number: "4", title: "The AI Empire", status: "planned",
    items: [
      { label: "Phase 1 — DeAnna's AI Twin (private build)", sub: "Claude API · trained on all 4 frameworks · answers questions 24/7 · coaches members · powers every other agent · BUILD FIRST — everything depends on this" },
      { label: "Phase 1 — Passkeys / Face ID login", sub: "Proper backend auth · device-based biometric · secure the ecosystem before scale" },
      { label: "Phase 3a — Director of Compliance · Legal · Tax · Chief of Staff · Executive Assistant", sub: "Protect the empire before it grows · governance and operational agents in place before scale" },
      { label: "Phase 3b — Revenue & Growth Agents", sub: "Sales Support · Affiliate Manager · Lead Nurture · Onboarding Coach · Start generating before fully public" },
      { label: "Phase 3c — Content & Brand Agents", sub: "Content Creator · LinkedIn Authority Engine · Daily Connections Engine · Social Scheduler · Feed the authority engine" },
      { label: "Phase 3d — Client Delivery Agents + Creative Director", sub: "Framework Advisor · Feedback Coach · Community Manager · Creative Director · Ready for clients at launch" },
      { label: "Phase 3e — Daily Connections Upgrade · Community · Courses", sub: "Add 'accelerator' Supabase tier · Free: 1 card · Navigator: 3 cards · Accelerator: 3 + exclusive 4th · Community in-app at 20+ clients · Full ecosystem live" },
      { label: "Phase 4 — Agent Architecture — 3 Layers", sub: "Layer 1: Brand presence · Layer 2: Org structure with workflows · Layer 3: Operational departments · design the org chart before building departments" },
      { label: "Phase 4 — Framework Agent Teams", sub: "One dedicated AI agent per framework · DRU CLEAR™ · 5D Leadership™ · 5C Cultural DNA™ · AI Sales Mastery™" },
      { label: "Phase 4 — Agent Roles", sub: "Community Manager · Content Creator · Sales Support · Onboarding Coach · Daily Connections Engine · Framework Advisor · Feedback Coach" },
      { label: "Phase 5 — Community AI Agents", sub: "Navigator + Accelerator communities managed by agents · daily prompts · Q&A · member spotlights · agents hold community before humans arrive" },
      { label: "Phase 5 — Community — in-app", sub: "Launch when 20+ active clients · agents already running by this point" },
      { label: "Phase 5 — Affiliate Dashboard", sub: "Track referrals · commissions · top referrer rewards" },
      { label: "Phase 6 — Daily Connections Tier Upgrade", sub: "Add 'accelerator' as 3rd Supabase tier value · Free: 1 card · Navigator: 3 cards · Accelerator: 3 cards + exclusive 4th (weekly DeAnna strategic prompt) · foundation already built" },
      { label: "Phase 6 — From Confusion to Confident with AI™", sub: "4-week course · Self-paced $497 · Cohort with live sessions $997 · Cohort + 1:1 with DeAnna $1,497 · AI agents automate delivery" },
      { label: "Phase 7 — DRU CLEAR™ Scale Your AI Business — LMS", sub: "Course platform · 8 modules · video + workbooks · progress tracking · built on proven client results" },
      { label: "Phase 7 — Navigator $97/mo + Accelerator $297/mo", sub: "Price increase from founder pricing when ready · Navigator: full 3-card Daily · Accelerator: 3 cards + exclusive 4th · locked in memory" },
      { label: "🚀 LAUNCH", sub: "app.druaiconsulting.com · full AI empire live · all agents operational" },
    ],
  },
  {
    number: "5", title: "Scale & License", status: "planned",
    items: [
      { label: "Phase 1 — 90-Day Live Run", sub: "Real clients · real data · agent refinement · case studies building · Sprint 5 readiness gate — do not proceed until proven" },
      { label: "Phase 2 — DRU CLEAR™ Scale Your AI Business — LMS", sub: "Full course platform · 8 modules · video + workbooks · progress tracking · built on proven 90-day results" },
      { label: "Phase 3 — White Label LMS Licensing", sub: "Other consultants pay monthly to use your platform · Licensed to the World" },
    ],
  },
];

const BUNDLE_PRICING_URL = "https://app.druaiconsulting.com/bundle-pricing";

const statusConfig = {
  completed:  { bg: "rgba(67,160,71,0.12)",  border: "rgba(67,160,71,0.35)",  dot: "#43A047", label: "✅ Completed",   headerBg: "rgba(67,160,71,0.08)"  },
  inprogress: { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.35)", dot: "#D4AF37", label: "🔄 In Progress", headerBg: "rgba(212,175,55,0.06)" },
  planned:    { bg: "rgba(30,136,229,0.06)", border: "rgba(30,136,229,0.2)",  dot: "#1E88E5", label: "⏳ Planned",     headerBg: "rgba(30,136,229,0.04)" },
};

// ── Stats Hook ────────────────────────────────────────────────────────────────
interface Stats {
  assessments_completed: number;
  leads_captured: number;
  diagnostics_sold: number;
  sessions_booked: number;
}

function useStats() {
  const [stats, setStats] = useState<Stats>({
    assessments_completed: 0,
    leads_captured: 0,
    diagnostics_sold: 0,
    sessions_booked: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.from("stats").select("id, value");
        if (error) throw error;
        const map: Record<string, number> = {};
        data?.forEach((row: { id: string; value: number }) => { map[row.id] = row.value; });
        setStats({
          assessments_completed: map["assessments_completed"] || 0,
          leads_captured: map["leads_captured"] || 0,
          diagnostics_sold: map["diagnostics_sold"] || 0,
          sessions_booked: map["sessions_booked"] || 0,
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return { stats, loading };
}

// ── Main Admin Component ──────────────────────────────────────────────────────
export default function Admin() {
  const [copied, setCopied] = useState(false);
  const { stats, loading } = useStats();

  const STAT_CARDS = [
    { label: "Assessments Completed", value: loading ? "…" : String(stats.assessments_completed), sub: "Total completed assessments", icon: "📋", color: "#D4AF37" },
    { label: "Leads Captured",         value: loading ? "…" : String(stats.leads_captured),         sub: "Total in funnel",           icon: "👤", color: "#C2185B" },
    { label: "Diagnostics Sold",       value: loading ? "…" : String(stats.diagnostics_sold),       sub: "Strategic + Executive",     icon: "💰", color: "#43A047" },
    { label: "Sessions Booked",        value: loading ? "…" : String(stats.sessions_booked),        sub: "Upcoming calls",            icon: "📅", color: "#1E88E5" },
  ];

  const copyBundleLink = () => {
    navigator.clipboard.writeText(BUNDLE_PRICING_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Admin Access Only</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>Command Center</h1>
          <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>DRU AI Consulting · DeAnna R. Upshaw</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "2rem" }}>
          {STAT_CARDS.map((stat) => (
            <div key={stat.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.1rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>{stat.icon}</span>
                <p style={{ fontFamily: "'Playfair Display', serif", color: stat.color, fontWeight: 700, fontSize: "1.4rem" }}>{stat.value}</p>
              </div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{stat.label}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.65rem" }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Private Client Links */}
        <div style={{ background: "rgba(194,24,91,0.06)", border: "1px solid rgba(194,24,91,0.3)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>🔒 Private Client Links</p>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(194,24,91,0.25)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 600, marginBottom: 3 }}>Bundle Pricing Page</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.68rem", lineHeight: 1.5 }}>Private · Send to client during diagnostic call · Full Ecosystem payment live</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={BUNDLE_PRICING_URL} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "block", background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", textAlign: "center", padding: "0.6rem 0.875rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.35)" }}>
                Preview Page →
              </a>
              <button onClick={copyBundleLink} style={{ flex: 1, background: copied ? "#43A047" : "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.6rem 0.875rem", borderRadius: 6, border: "none", cursor: "pointer", transition: "background 0.2s" }}>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Quick Links</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {QUICK_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.15)"; }}
              >
                <span style={{ fontSize: "1rem" }}>{link.icon}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.8)", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.04em" }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Payment Links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Payment Links</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PAYMENT_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.35)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.12)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: link.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.8)", fontWeight: 600, fontSize: "0.72rem" }}>{link.label}</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", color: link.color, fontWeight: 700, fontSize: "0.85rem" }}>{link.price}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Pending Items */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Pending Refinements</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PENDING_ITEMS.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, border: "1.5px solid rgba(212,175,55,0.4)", borderRadius: 3, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.78rem", lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sprint Roadmap */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#D4AF37", whiteSpace: "nowrap" }}>Full Build Roadmap</p>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {SPRINTS.map((sprint) => {
              const cfg = statusConfig[sprint.status as keyof typeof statusConfig];
              return (
                <div key={sprint.number} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: cfg.headerBg, borderBottom: `1px solid ${cfg.border}`, padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: cfg.dot, margin: "0 0 1px" }}>Sprint {sprint.number}</p>
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{sprint.title}</p>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: cfg.dot, letterSpacing: "0.04em" }}>{cfg.label}</span>
                  </div>
                  <div style={{ padding: "0.875rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {sprint.items.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <span style={{ color: cfg.dot, fontSize: "0.6rem", marginTop: 3, flexShrink: 0 }}>
                          {sprint.status === "completed" ? "✓" : "→"}
                        </span>
                        <div>
                          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: sprint.status === "completed" ? "rgba(230,230,230,0.7)" : "#FFFFFF", margin: "0 0 1px", lineHeight: 1.4 }}>{item.label}</p>
                          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: "rgba(230,230,230,0.35)", margin: 0, lineHeight: 1.4 }}>{item.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "1.25rem", textAlign: "center", padding: "0.875rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#D4AF37" }}>
              Launch Target · May 10, 2026 · app.druaiconsulting.com · Sprint 5 → Licensed to the World
            </p>
          </div>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
