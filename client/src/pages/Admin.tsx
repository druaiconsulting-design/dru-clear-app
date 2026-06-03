import { useState, useEffect, useMemo } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { registerPasskey } from "../lib/passkey";

const GHL_LAB_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/70d21e5b-66f9-4aa0-8eac-5c59ed55fcaa";

const QUICK_LINKS = [
  { label: "GHL Dashboard",        href: "https://crm.aiforbusiness.com/v2/location/gl07I4JnbkGgW8zJprSz/dashboard", icon: "🔗" },
  { label: "Live Assessment",      href: "https://assessment.druaiconsulting.com", icon: "🚀" },
  { label: "Main Website",         href: "https://druaiconsulting.com", icon: "🌐" },
  { label: "Frameworks Page",      href: "https://frameworks.druaiconsulting.com", icon: "📐" },
  { label: "Course Page",          href: "https://course.druaiconsulting.com", icon: "🎓" },
  { label: "GitHub - App",         href: "https://github.com/druaiconsulting-design/dru-clear-app", icon: "💻" },
  { label: "GitHub - Website",     href: "https://github.com/druaiconsulting-design/druaiconsulting-website", icon: "💻" },
  { label: "GitHub - Frameworks",  href: "https://github.com/druaiconsulting-design/druaiconsulting-frameworks", icon: "💻" },
  { label: "GitHub - Courses",     href: "https://github.com/druaiconsulting-design/druaiconsulting-courses", icon: "💻" },
  { label: "Terms of Engagement",  href: "https://app.druaiconsulting.com/terms", icon: "📄" },
];

const PAYMENT_LINKS = [
  { label: "Executive Diagnostic",                           price: "$4,997",  href: "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645", color: "#C2185B" },
  { label: "Strategic Diagnostic",                           price: "$3,497",  href: "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222", color: "#D4AF37" },
  { label: "DRU CLEAR Framework",                            price: "$7,500",  href: "https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec", color: "#D4AF37" },
  { label: "5D Leadership",                                  price: "$6,500",  href: "https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc", color: "#1E88E5" },
  { label: "5C Cultural DNA",                                price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def", color: "#C2185B" },
  { label: "AI Sales Mastery",                               price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe", color: "#C2185B" },
  { label: "Full Ecosystem - Signing ($13K)",                price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff", color: "#43A047" },
  { label: "Full Ecosystem - Final ($13K)",                  price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e50e30557558e89e520fb6", color: "#43A047" },
  { label: "DRU CLEAR Navigator - Founder",                  price: "$97/mo",  href: "https://link.druaiconsulting.com/payment-link/69ead3017dd3512d920794b0", color: "#D4AF37" },
  { label: "DRU CLEAR Accelerator - Founder",                price: "$167/mo", href: "https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1", color: "#C2185B" },
  { label: "From Confusion to Confident - Self-Paced",       price: "$1,497",  href: "https://link.druaiconsulting.com/payment-link/69f55d0cb615f70a8a33b5fd", color: "#D4AF37" },
  { label: "From Confusion to Confident - Live Cohort",      price: "$7,997",  href: "https://link.druaiconsulting.com/payment-link/69f55e7bb18c99dd72d3c0e5", color: "#C2185B" },
  { label: "From Confusion to Confident - Mastermind",       price: "$12,997", href: "https://link.druaiconsulting.com/payment-link/69f55bf3b615f70a8a33b5fb", color: "#43A047" },
];

interface FocusPoint { label: string; sub: string; }
const FOCAL_POINTS: FocusPoint[] = [
  { label: "GHL Webhook URL — wire into course waitlist form", sub: "Connect GHL webhook to course.druaiconsulting.com waitlist capture" },
  { label: "From Confusion to Confident with AI™ — Course Build", sub: "Waitlist form built · 3 payment links live · course.druaiconsulting.com deploy next" },
];

interface SprintItem { label: string; sub: string; done?: boolean; }

const SPRINTS: { number: string; title: string; status: string; items: SprintItem[] }[] = [
  {
    number: "1 & 2", title: "Foundation", status: "completed",
    items: [
      { label: "DRU CLEAR Scorecard PWA live", sub: "assessment.druaiconsulting.com redirects to app.druaiconsulting.com" },
      { label: "5 GHL automation workflows", sub: "Lead capture, completion, nurture, purchase workflows" },
      { label: "React Router architecture - 7 pages live", sub: "Portal, Frameworks, Resources, Daily, ROI, Affiliate, Admin" },
      { label: "Supabase backend database", sub: "Persistent accounts, RLS security, profiles table" },
      { label: "Google Sign In + email/password login", sub: "Automated password reset - admin private door" },
      { label: "Admin Command Center", sub: "CLIENT VIEW / ADMIN VIEW toggle in navbar - private door at /admin" },
      { label: "All 4 IP framework descriptions written", sub: "DRU CLEAR, 5C Cultural DNA, 5D Leadership, AI Sales Mastery" },
      { label: "Framework infographics embedded in Frameworks page", sub: "4 images live - price badge top right - brand badge bottom left" },
    ],
  },
  {
    number: "3", title: "Revenue + Polish", status: "completed",
    items: [
      { label: "Full pricing architecture - LIVE", sub: "SD $3,497 - ED $4,997 - 4 frameworks - bundles - Full Ecosystem $26K" },
      { label: "All 8 payment links active", sub: "Terms modal then payment iframe then branded thank you page" },
      { label: "8 branded thank you pages - LIVE", sub: "ED/SD with calendar - 4 frameworks - Full Ecosystem with payment split" },
      { label: "Full Ecosystem payment split", sub: "$13K signing + $13K final - separate GHL payment links" },
      { label: "Dynamic browser tab titles", sub: "Every page has its own DRU CLEAR tab title" },
      { label: "Personalized Portal - name + avatar", sub: "Google photo or initials - Welcome Back, [FirstName]" },
      { label: "Portal rebuilt as personal dashboard", sub: "3 cards: My Assessment - Daily Connection - Need Support" },
      { label: "Resources page cleaned up", sub: "Email capture removed - New This Week banner" },
      { label: "Affiliate page updated", sub: "New copy - real links - GHL note" },
      { label: "Reset password flow - LIVE", sub: "type=signup + type=recovery both route to branded ResetPassword page" },
      { label: "NavBar restored - CLIENT VIEW / ADMIN VIEW", sub: "Toggle follows admin across all pages" },
      { label: "Community Landing Page - LIVE", sub: "Founders Special - Navigator $97/mo - Accelerator $167/mo" },
      { label: "GHL Homepage Funnel - LIVE", sub: "15-section branded homepage - single CTA to assessment" },
      { label: "frameworks.druaiconsulting.com - LIVE", sub: "Standalone frameworks page deployed on Vercel" },
      { label: "Admin Command Center live stats", sub: "Supabase stats table - Edge Function - GHL webhooks wired" },
      { label: "Free tier access - Supabase tier field", sub: "free | paid - RLS controls - assessment auto-creates free account" },
      { label: "Free tier - Daily Connections + Resources", sub: "Insight free - Micro-Lesson + Challenge locked - 1 free PDF" },
      { label: "PWA Auth Redirect - returning users routed to app", sub: "Supabase session check on mount - valid session to app.druaiconsulting.com" },
      { label: "Route Security - all protected routes locked", sub: "/frameworks - /community - /affiliate require login" },
      { label: "Dynamic Transformation Pathway - fully automated", sub: "pathway_stage in Supabase - 3 values map to 5 visual stages - Edge Function auto-updates on purchase" },
      { label: "Daily Connections automated engine - LIVE", sub: "Claude API generates 3 content sets daily at 6am CST - stage-aware - leadership WITH AI" },
      { label: "Smart notification dot - full state sequence", sub: "Unread: red pulsing - Read: gold glow - Completed: streak - 7-day: gold border glow" },
      { label: "Streak tracking - Supabase persistent", sub: "current_streak - longest_streak - total_completions" },
      { label: "Mark Completed button - gold on completion", sub: "Blue to gold with glow + checkmark - streak fires" },
      { label: "Need Support - mailto with pre-filled subject", sub: "Opens email client - support@druaiconsulting.com" },
      { label: "Client Intelligence Dashboard - LIVE", sub: "submissions table - pillar scores stored - 6 stat cards - filter bar - 13-col table - color-coded heat map - CSV export" },
    ],
  },
  {
    number: "4", title: "The AI Empire", status: "inprogress",
    items: [
      { done: true, label: "DeAnna's AI Twin - LIVE",                       sub: "Claude API - trained on all 4 frameworks - answers questions 24/7 - master orchestrator - app.druaiconsulting.com/twin" },
      { done: true, label: "Daily Connections Accelerator Tier - LIVE",     sub: "navigator + accelerator tiers in Supabase - DeAnna's Strategic Edge 4th card - AI-generated in DeAnna's voice - daily - founder pricing active" },
      { done: true, label: "Auth Loading Fix - LIVE",                       sub: "Two-phase loading - instant session resolve - profile fetches in background - 3s safety timeout - no more splash screen hang" },
      { done: true, label: "New Logo - LIVE",                               sub: "DRU CLEAR enhanced logo - transparent background - deployed across app" },
      { done: true, label: "Revenue & Growth Agents - BUILT",               sub: "10 agents - Serena - Mateo - Zara - Jaylen - Chloe - Omar - Aaliyah - Ryan - Elena - Kwame - Supabase edge function deployed" },
      { done: true, label: "Content & Brand Agents - BUILT",                sub: "5 agents - Camila - Darius - Ingrid - Ravi - Yara - Supabase edge function deployed" },
      { done: true, label: "Client Delivery Agents + Creative Director - BUILT", sub: "7 agents - Keisha - Marco - Leila - Jordan Hayes - Simone - Theo - Amelia - deployed" },
      { done: true, label: "Governance Agents - BUILT",                     sub: "Legal & Finance - AI Governance - HR Division - 14 agents - all edge functions deployed" },
      { done: true, label: "Travis - Chief of Staff - BUILT",               sub: "Pure deterministic router - routes all agents across 9 divisions - reports to Twin" },
      { done: true, label: "All 39 Agents - Full Build COMPLETE",           sub: "Twin + Travis + 37 agents across 8 divisions - all system prompts - all edge functions - Genius Mode default" },
      { done: true, label: "Passkeys / Face ID Login - LIVE",               sub: "WebAuthn - device-based biometric - Supabase passkey_credentials table - register from Portal + Admin - sign in from login screen" },
      { done: true, label: "Twin Streaming Fix - LIVE",                     sub: "WallClockTime timeout on OPTIONS preflight resolved - routed via Vercel serverless function" },
      { done: true, label: "SMS Sequences - LIVE",                          sub: "GHL phone number provisioned - SMS automation workflows active" },
      { done: true, label: "course.druaiconsulting.com - LIVE",             sub: "Repo created - Vercel deployed - course landing page live" },
      { done: true, label: "Add 2 PDFs to app for user access",             sub: "Delegated to AI Agents — complete" },
      { done: false, label: "LAUNCH",                                        sub: "app.druaiconsulting.com - course.druaiconsulting.com - full AI empire live - all agents operational - June 10-11, 2026" },
    ],
  },
  {
    number: "5", title: "All Agents Live", status: "completed",
    items: [
      { done: true,  label: "Revenue & Growth Division — LIVE",    sub: "10 agents — Omar · Ryan · Serena · Mateo · Aaliyah · Jaylen · Chloe · Zara · Elena · Kwame — daily 8:00am CDT" },
      { done: true,  label: "Content & Brand Division — LIVE",     sub: "5 agents — Camila · Darius · Ravi · Yara · Ingrid — daily" },
      { done: true,  label: "Marketing Division — LIVE",           sub: "4 agents — Nia · Luca · Hyun-Ji · Andre — daily" },
      { done: true,  label: "Legal & Finance Division — LIVE",     sub: "4 agents — Amara · Diego · Yuki · Marcus — weekly Tuesdays — Isabella Legal & Finance exception active" },
      { done: true,  label: "AI Governance Division — LIVE",       sub: "5 agents — Khalid · Sofia · James · Mei Lin · Rafael — daily" },
      { done: true,  label: "HR Division — LIVE",                  sub: "3 agents — Naomi · Aiden · Fatima — daily" },
      { done: true,  label: "Client Delivery Division — LIVE",     sub: "7 agents — Keisha · Marco · Leila · Jordan · Simone · Theo · Amelia — daily 9:00am CDT" },
      { done: true,  label: "Customer Support Division — LIVE",    sub: "2 agents — Isaiah · Priscilla — daily 9:21am CDT" },
      { done: true,  label: "Full Command Chain — LIVE",           sub: "Isabella (11:00am) · Governance (11:10am) · Raymond/Travis/Priya (11:20am) · AI Twin (11:30am) — one daily briefing notification" },
      { done: true,  label: "Community Connection Division — Roster Complete", sub: "9th division · 10 agents · 4 Framework Support Teams · Community Connection Leadership — roster built and approved" },
      { done: true,  label: "Community Connection Page — Updated",  sub: "Fulfillment redesigned — Navigator: 4 daily cards + weekly framework training · Accelerator: + PDF Downloadables + monthly DeAnna's Leadership Lab! video" },
      { done: true,  label: "Community Connection Division — All 4 Layers COMPLETE", sub: "Layer 1: DB · Layer 2: Agent Infrastructure · Layer 3: Community Page · Layer 4: Leadership Lab — /lab live · Accelerator-gated · publish card in Admin" },
    ],
  },
  {
    number: "6", title: "Scale & License", status: "planned",
    items: [
      { label: "90-Day Live Run", sub: "Real clients - real data - agent refinement - case studies building - Sprint 6 readiness gate" },
      { label: "DRU CLEAR Scale Your AI Business - LMS", sub: "Full course platform - 8 modules - video + workbooks - progress tracking" },
      { label: "White Label LMS Licensing - Licensed to the World", sub: "Other consultants pay monthly to use your platform - the final frontier" },
      { label: "Affiliate Dashboard", sub: "Track referrals · commissions · top referrer leaderboard · Supabase referrals table · unique referral links · Stripe payout integration" },
    ],
  },
];

const BUNDLE_PRICING_URL = "https://app.druaiconsulting.com/bundle-pricing";

const statusConfig = {
  completed:  { bg: "rgba(67,160,71,0.12)",  border: "rgba(67,160,71,0.35)",  dot: "#43A047", label: "✅ Completed",   headerBg: "rgba(67,160,71,0.08)"  },
  inprogress: { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.35)", dot: "#D4AF37", label: "⏳ In Progress", headerBg: "rgba(212,175,55,0.06)" },
  planned:    { bg: "rgba(30,136,229,0.06)", border: "rgba(30,136,229,0.2)",  dot: "#1E88E5", label: "📝 Planned",     headerBg: "rgba(30,136,229,0.04)" },
};

const TIER_COLORS: Record<string, string> = {
  EMERGING: "#E53935", DEVELOPING: "#D4AF37", ADVANCING: "#1E88E5", LEADING: "#43A047",
};

function getPillarColor(score: number): string {
  if (score <= 6)  return "#E53935";
  if (score <= 10) return "#D4AF37";
  return "#43A047";
}

interface Stats {
  leads_scored_today: number; high_intent_today: number;
  sessions_booked: number;
  diagnostics_sd_sold: number; diagnostics_ed_sold: number;
}

function useStats() {
  const [stats, setStats] = useState<Stats>({ leads_scored_today: 0, high_intent_today: 0, sessions_booked: 0, diagnostics_sd_sold: 0, diagnostics_ed_sold: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchStats() {
      try {
        const { data, error } = await supabase.from("stats").select("id, value");
        if (error) throw error;
        const map: Record<string, number> = {};
        data?.forEach((row: { id: string; value: number }) => { map[row.id] = row.value; });
        setStats({ leads_scored_today: map["leads_scored_today"] || 0, high_intent_today: map["high_intent_today"] || 0, sessions_booked: map["sessions_booked"] || 0, diagnostics_sd_sold: map["diagnostics_sd_sold"] || 0, diagnostics_ed_sold: map["diagnostics_ed_sold"] || 0 });
      } catch (err) { console.error("Failed to fetch stats:", err); }
      finally { setLoading(false); }
    }
    fetchStats();
  }, []);
  return { stats, loading };
}

// ── CC Hot Leads: community engagement gap signal count ──────────────────────
const LEVEL_RANK_ADMIN: Record<string, number> = {
  Connected: 1, Contributor: 2, Cultivator: 3, Cornerstone: 4, Changemaker: 5,
};
const PATHWAY_RANK_ADMIN: Record<string, number> = {
  Discover: 1, Diagnose: 2, Design: 3, Deploy: 4, Dominate: 5,
};

function useCCHotLeads() {
  const [count, setCount] = useState(0);
  const [hlLoading, setHlLoading] = useState(true);
  useEffect(() => {
    async function fetchHotLeads() {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("community_level, pathway_stage")
          .in("tier", ["navigator", "accelerator"]);
        const hot = (data ?? []).filter((m: any) => {
          const l = LEVEL_RANK_ADMIN[m.community_level ?? ''] ?? 0;
          const p = PATHWAY_RANK_ADMIN[m.pathway_stage  ?? ''] ?? 0;
          return l > 0 && (p === 0 || l > p);
        }).length;
        setCount(hot);
      } catch (err) { console.error("Failed to fetch CC hot leads:", err); }
      finally { setHlLoading(false); }
    }
    fetchHotLeads();
  }, []);
  return { count, hlLoading };
}

interface Submission {
  id: string; created_at: string; first_name: string; last_name: string; email: string;
  company: string; role: string; country_name: string; total_score: number; tier: string;
  top_gaps: string; clarity_score: number; leadership_score: number; execution_score: number;
  alignment_score: number; results_score: number;
}

function ClientIntelligenceDashboard() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [tierFilter, setTierFilter]   = useState("ALL");

  useEffect(() => {
    async function fetchSubmissions() {
      try {
        const { data, error } = await supabase.from("submissions")
          .select("id, created_at, first_name, last_name, email, company, role, country_name, total_score, tier, top_gaps, clarity_score, leadership_score, execution_score, alignment_score, results_score")
          .order("created_at", { ascending: false });
        if (!error && data) setSubmissions(data);
      } catch (err) { console.error("Failed to fetch submissions:", err); }
      finally { setLoading(false); }
    }
    fetchSubmissions();
  }, []);

  const totalSubmissions = submissions.length;
  const avgScore = totalSubmissions > 0 ? Math.round(submissions.reduce((sum, s) => sum + (s.total_score || 0), 0) / totalSubmissions) : 0;
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { EMERGING: 0, DEVELOPING: 0, ADVANCING: 0, LEADING: 0 };
    submissions.forEach((s) => { if (s.tier && counts[s.tier] !== undefined) counts[s.tier]++; });
    return counts;
  }, [submissions]);

  const filtered = useMemo(() => submissions.filter((s) => {
    const matchesTier = tierFilter === "ALL" || s.tier === tierFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || (s.first_name || "").toLowerCase().includes(q) || (s.last_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.company || "").toLowerCase().includes(q) || (s.role || "").toLowerCase().includes(q);
    return matchesTier && matchesSearch;
  }), [submissions, search, tierFilter]);

  const handleExport = () => {
    const headers = ["Date","First Name","Last Name","Email","Company","Role","Country","Score","Tier","Top Gaps","Clarity","Leadership","Execution","Alignment","Results"];
    const rows = filtered.map((s) => [new Date(s.created_at).toLocaleDateString("en-US"), s.first_name, s.last_name, s.email, s.company, s.role, s.country_name, s.total_score, s.tier, s.top_gaps, s.clarity_score, s.leadership_score, s.execution_score, s.alignment_score, s.results_score]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell ?? ""}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href = url;
    a.download = `dru-clear-submissions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SUMMARY_CARDS = [
    { label: "Total Submissions", value: totalSubmissions,          color: "#D4AF37", icon: "📋" },
    { label: "Avg Score",         value: avgScore ? `${avgScore}/100` : "-", color: "#1E88E5", icon: "📊" },
    { label: "Emerging",          value: tierCounts.EMERGING,       color: "#E53935", icon: "🔴" },
    { label: "Developing",        value: tierCounts.DEVELOPING,     color: "#D4AF37", icon: "🟡" },
    { label: "Advancing",         value: tierCounts.ADVANCING,      color: "#1E88E5", icon: "🔵" },
    { label: "Leading",           value: tierCounts.LEADING,        color: "#43A047", icon: "🟢" },
  ];

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.25rem" }}>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#D4AF37", whiteSpace: "nowrap" as const }}>Client Intelligence</p>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {SUMMARY_CARDS.map((card) => (
          <div key={card.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 10, padding: "0.875rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.9rem" }}>{card.icon}</span>
              <p style={{ fontFamily: "'Playfair Display', serif", color: card.color, fontWeight: 700, fontSize: "1.3rem", margin: 0 }}>{card.value}</p>
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>{card.label}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" as const }}>
        <input type="text" placeholder="Search name, email, company..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none" }} />
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
          <option value="ALL" style={{ background: "#0A2342" }}>All Tiers</option>
          <option value="EMERGING" style={{ background: "#0A2342" }}>Emerging</option>
          <option value="DEVELOPING" style={{ background: "#0A2342" }}>Developing</option>
          <option value="ADVANCING" style={{ background: "#0A2342" }}>Advancing</option>
          <option value="LEADING" style={{ background: "#0A2342" }}>Leading</option>
        </select>
        <button onClick={handleExport} disabled={filtered.length === 0}
          style={{ background: filtered.length > 0 ? "#D4AF37" : "rgba(212,175,55,0.2)", color: filtered.length > 0 ? "#0A2342" : "rgba(212,175,55,0.4)", border: "none", borderRadius: 6, padding: "0.55rem 1.1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: filtered.length > 0 ? "pointer" : "default", transition: "all 0.2s", whiteSpace: "nowrap" as const }}>
          Export CSV
        </button>
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.68rem", marginBottom: "0.75rem" }}>
        {loading ? "Loading..." : `${filtered.length} submission${filtered.length !== 1 ? "s" : ""}${tierFilter !== "ALL" || search ? " (filtered)" : ""}`}
      </p>
      {loading ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>Loading submissions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,56,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>
            {submissions.length === 0 ? "No submissions yet - data will appear here when clients complete the assessment." : "No results match your filter."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" as const, borderRadius: 8, border: "1px solid rgba(212,175,55,0.15)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, minWidth: 900 }}>
            <thead>
              <tr style={{ background: "rgba(212,175,55,0.08)", borderBottom: "1px solid rgba(212,175,55,0.2)" }}>
                {["Date","Name","Email","Company","Role","Score","Tier","C","L","E","A","R","Top Gaps"].map((h) => (
                  <th key={h} style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "0.6rem 0.75rem", textAlign: "left" as const, whiteSpace: "nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.68rem", whiteSpace: "nowrap" as const }}>{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" as const }}>{s.first_name} {s.last_name}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.68rem" }}>{s.email}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.68rem", whiteSpace: "nowrap" as const }}>{s.company || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.6)", fontSize: "0.65rem", whiteSpace: "nowrap" as const }}>{s.role || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap" as const }}>{s.total_score ?? "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {s.tier ? <span style={{ fontFamily: "'Montserrat', sans-serif", color: TIER_COLORS[s.tier] || "#FFFFFF", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", background: `${TIER_COLORS[s.tier]}18`, border: `1px solid ${TIER_COLORS[s.tier]}50`, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" as const }}>{s.tier}</span> : "-"}
                  </td>
                  {[s.clarity_score, s.leadership_score, s.execution_score, s.alignment_score, s.results_score].map((score, pi) => (
                    <td key={pi} style={{ padding: "0.6rem 0.5rem", textAlign: "center" as const }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", color: getPillarColor(score), fontSize: "0.72rem", fontWeight: 700 }}>{score ?? "-"}</span>
                    </td>
                  ))}
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.65rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.top_gaps || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" as const }}>
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.3)", fontSize: "0.62rem", margin: 0 }}>C = Clarity - L = Leadership - E = Execution - A = Alignment - R = Results (each out of 15)</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {[{ label: "Low (1-6)", color: "#E53935" }, { label: "Mid (7-10)", color: "#D4AF37" }, { label: "Strong (11-15)", color: "#43A047" }].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.62rem" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [copied, setCopied]                     = useState(false);
  const { stats, loading }                      = useStats();
  const { count: ccHotLeads, hlLoading }        = useCCHotLeads();
  const [hasPasskey, setHasPasskey]             = useState(false);
  const [passkeyLoading, setPasskeyLoading]     = useState(false);
  const [passkeyMessage, setPasskeyMessage]     = useState("");
  const [passkeyDismissed, setPasskeyDismissed] = useState(false);

  const [labTitle, setLabTitle]             = useState("");
  const [labMonth, setLabMonth]             = useState("");
  const [labVideoUrl, setLabVideoUrl]       = useState("");
  const [labPublishing, setLabPublishing]   = useState(false);
  const [labPublished, setLabPublished]     = useState(false);
  const [labError, setLabError]             = useState("");

  const [pdfTitle, setPdfTitle]             = useState("");
  const [pdfWeekOf, setPdfWeekOf]           = useState("");
  const [pdfUrl, setPdfUrl]                 = useState("");
  const [pdfPublishing, setPdfPublishing]   = useState(false);
  const [pdfPublished, setPdfPublished]     = useState(false);
  const [pdfError, setPdfError]             = useState("");

  useEffect(() => {
    async function checkPasskey() {
      if (!user?.id) return;
      const { data } = await supabase.from("passkey_credentials").select("id").eq("user_id", user.id).limit(1);
      if (data && data.length > 0) setHasPasskey(true);
    }
    checkPasskey();
  }, [user?.id]);

  const handleSetupPasskey = async () => {
    setPasskeyLoading(true); setPasskeyMessage("");
    const result = await registerPasskey();
    setPasskeyLoading(false);
    if (result.success) { setHasPasskey(true); setPasskeyMessage("Passkey saved - you can now sign in with biometrics."); }
    else { setPasskeyMessage(result.error || "Something went wrong."); }
  };

  const handleLabPublish = async () => {
    if (!labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) {
      setLabError("All fields are required before publishing."); return;
    }
    setLabPublishing(true); setLabError(""); setLabPublished(false);
    try {
      const { error } = await supabase.from("lab_videos").insert({
        title: labTitle.trim(), month_year: labMonth.trim(),
        video_url: labVideoUrl.trim(), is_active: true,
      });
      if (error) throw error;
      await fetch(GHL_LAB_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_type: "lab_video_published", video_title: labTitle.trim(), month_year: labMonth.trim(), lab_url: "https://app.druaiconsulting.com/lab", tier: "accelerator" }),
      });
      setLabPublished(true);
      setLabTitle(""); setLabMonth(""); setLabVideoUrl("");
      setTimeout(() => setLabPublished(false), 5000);
    } catch (err: any) { setLabError(err?.message || "Publish failed. Please try again."); }
    setLabPublishing(false);
  };

  const handlePdfPublish = async () => {
    if (!pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()) {
      setPdfError("All fields are required before publishing."); return;
    }
    setPdfPublishing(true); setPdfError(""); setPdfPublished(false);
    try {
      const { error } = await supabase.from("weekly_pdfs").insert({
        title: pdfTitle.trim(), week_of: pdfWeekOf.trim(), pdf_url: pdfUrl.trim(), is_active: true,
      });
      if (error) throw error;
      setPdfPublished(true);
      setPdfTitle(""); setPdfWeekOf(""); setPdfUrl("");
      setTimeout(() => setPdfPublished(false), 5000);
    } catch (err: any) { setPdfError(err?.message || "Publish failed. Please try again."); }
    setPdfPublishing(false);
  };

  const STAT_CARDS = [
    { label: "Leads Scored Today",        value: loading ? "..." : String(stats.leads_scored_today),  sub: "Omar's daily GHL scan",      icon: "📊", color: "#D4AF37" },
    { label: "High Intent Today",         value: loading ? "..." : String(stats.high_intent_today),   sub: "Ready for outreach",         icon: "🎯", color: "#C2185B" },
    { label: "Strategic Diagnostic Sold", value: loading ? "..." : String(stats.diagnostics_sd_sold), sub: "SD · $3,497 · running total", icon: "💰", color: "#43A047" },
    { label: "Executive Diagnostic Sold", value: loading ? "..." : String(stats.diagnostics_ed_sold), sub: "ED · $4,997 · running total", icon: "💎", color: "#D4AF37" },
  ];

  const copyBundleLink = () => {
    navigator.clipboard.writeText(BUNDLE_PRICING_URL).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.25)",
    borderRadius: 6, padding: "0.6rem 0.875rem", color: "#FFFFFF",
    fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/admin" />
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>

        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>Admin · Page 1</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>Command Center</h1>
          <p style={{ color: "rgba(230,230,230,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>DRU AI Consulting - DeAnna R. Upshaw</p>
        </div>

        {!passkeyDismissed && (
          <div style={{ background: hasPasskey ? "rgba(67,160,71,0.06)" : "rgba(194,24,91,0.06)", border: hasPasskey ? "1px solid rgba(67,160,71,0.3)" : "1px solid rgba(194,24,91,0.3)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: hasPasskey ? "rgba(67,160,71,0.12)" : "rgba(194,24,91,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>{hasPasskey ? "✅" : "🔐"}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: hasPasskey ? "#43A047" : "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", margin: 0, marginBottom: "0.1rem" }}>{hasPasskey ? "Passkey Active" : "Speed Up Your Login"}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.68rem", margin: 0, lineHeight: 1.4 }}>{hasPasskey ? "Face ID or fingerprint sign-in is enabled." : "Set up Face ID or fingerprint to sign in instantly."}</p>
                {passkeyMessage && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.68rem", margin: "0.35rem 0 0", color: hasPasskey ? "#43A047" : "#E53935" }}>{passkeyMessage}</p>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              {!hasPasskey && (
                <button onClick={handleSetupPasskey} disabled={passkeyLoading}
                  style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.55rem 1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.06em", cursor: passkeyLoading ? "default" : "pointer", opacity: passkeyLoading ? 0.7 : 1, whiteSpace: "nowrap" as const }}>
                  {passkeyLoading ? "Setting up..." : "Set Up"}
                </button>
              )}
              {hasPasskey && (
                <button onClick={() => setPasskeyDismissed(true)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0.25rem" }}>x</button>
              )}
            </div>
          </div>
        )}

        <a href="/admin-org" style={{ textDecoration: "none", display: "block", marginBottom: "1.5rem" }}>
          <div style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "1rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.7)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.4)"; }}>
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1rem", fontWeight: 700, margin: "0 0 3px" }}>AI Empire Org Chart</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", margin: 0 }}>53 agents · 9 divisions · Raymond oversees all · Full hierarchy with illustrated avatars · Page 2</p>
            </div>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#D4AF37", letterSpacing: "0.08em" }}>VIEW</span>
          </div>
        </a>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "0.875rem" }}>
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

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(30,136,229,0.25)", borderRadius: 10, padding: "1.1rem 1rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>📅</span>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#1E88E5", fontWeight: 700, fontSize: "1.4rem" }}>{loading ? "..." : String(stats.sessions_booked)}</p>
          </div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>Sessions Booked</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.65rem" }}>Running total · updates in real time on booking</p>
        </div>

        {/* CC Hot Leads */}
        <a href="/admin-member-intelligence" style={{ textDecoration:"none", display:"block", marginBottom:"2rem" }}>
          <div style={{ background:"rgba(194,24,91,0.06)", border:"1px solid rgba(194,24,91,0.25)", borderRadius:10, padding:"1.1rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(194,24,91,0.5)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(194,24,91,0.25)"; }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.5rem" }}>
                <span style={{ fontSize:"1.1rem" }}>🔥</span>
                <p style={{ fontFamily:"'Playfair Display', serif", color:"#C2185B", fontWeight:700, fontSize:"1.4rem", margin:0 }}>{hlLoading ? "..." : ccHotLeads}</p>
              </div>
              <p style={{ fontFamily:"'Montserrat', sans-serif", color:"#FFFFFF", fontWeight:700, fontSize:"0.72rem", letterSpacing:"0.04em", marginBottom:"0.2rem" }}>CC Hot Leads</p>
              <p style={{ fontFamily:"'Inter', sans-serif", color:"rgba(230,230,230,0.35)", fontSize:"0.65rem" }}>Community members engaged but not yet invested · tap to view all</p>
            </div>
            <span style={{ fontFamily:"'Montserrat', sans-serif", fontSize:"0.65rem", fontWeight:700, color:"#C2185B", letterSpacing:"0.08em", flexShrink:0 }}>VIEW →</span>
          </div>
        </a>

        <ClientIntelligenceDashboard />

        {/* Private Client Links */}
        <div style={{ background: "rgba(194,24,91,0.06)", border: "1px solid rgba(194,24,91,0.3)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Private Client Links</p>
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(194,24,91,0.25)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 600, marginBottom: 3 }}>Bundle Pricing Page</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.68rem", lineHeight: 1.5 }}>Private - Send to client during diagnostic call - Full Ecosystem payment live</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href={BUNDLE_PRICING_URL} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "block", background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, textDecoration: "none", textAlign: "center" as const, padding: "0.6rem 0.875rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.35)" }}>Preview Page</a>
              <button onClick={copyBundleLink} style={{ flex: 1, background: copied ? "#43A047" : "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 0.875rem", borderRadius: 6, border: "none", cursor: "pointer", transition: "background 0.2s" }}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>

        {/* Leadership Lab */}
        <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.2rem" }}>🎬 DeAnna's Leadership Lab™</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.68rem", marginBottom: "1.25rem", lineHeight: 1.5 }}>Upload video to Supabase storage, paste the URL below, then publish. Accelerator members are notified automatically.</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem", marginBottom: "1rem" }}>
            <input type="text" placeholder="Video Title — e.g. AI Leadership in Action" value={labTitle} onChange={e => { setLabTitle(e.target.value); setLabError(""); }} style={inputStyle} />
            <input type="text" placeholder="Month — e.g. June 2026" value={labMonth} onChange={e => { setLabMonth(e.target.value); setLabError(""); }} style={inputStyle} />
            <input type="text" placeholder="Supabase Video URL — paste from storage" value={labVideoUrl} onChange={e => { setLabVideoUrl(e.target.value); setLabError(""); }} style={inputStyle} />
          </div>
          {labError && <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.75rem" }}>{labError}</p>}
          <button onClick={handleLabPublish} disabled={labPublishing || !labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()}
            style={{ width: "100%", background: labPublished ? "#43A047" : (!labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) ? "rgba(212,175,55,0.2)" : "#D4AF37", color: labPublished ? "#FFFFFF" : (!labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) ? "rgba(212,175,55,0.4)" : "#0A2342", border: "none", borderRadius: 8, padding: "0.75rem 1.5rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", cursor: (labPublishing || !labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) ? "default" : "pointer", transition: "all 0.2s" }}>
            {labPublishing ? "Publishing..." : labPublished ? "✓ Published — Accelerator Members Notified" : "Publish + Notify Accelerator Members"}
          </button>
        </div>

        {/* Weekly PDF */}
        <div style={{ background: "rgba(30,136,229,0.06)", border: "1px solid rgba(30,136,229,0.3)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.2rem" }}>📄 Weekly Resource PDF</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.68rem", marginBottom: "1.25rem", lineHeight: 1.5 }}>Upload PDF to Supabase storage (resources bucket), paste the URL below, then publish. Visible to all members on the Resources page.</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.75rem", marginBottom: "1rem" }}>
            <input type="text" placeholder="PDF Title — e.g. DRU CLEAR™ AI Leadership Manual 101" value={pdfTitle} onChange={e => { setPdfTitle(e.target.value); setPdfError(""); }} style={inputStyle} />
            <input type="text" placeholder="Week Of — e.g. May 26, 2026" value={pdfWeekOf} onChange={e => { setPdfWeekOf(e.target.value); setPdfError(""); }} style={inputStyle} />
            <input type="text" placeholder="Supabase PDF URL — paste from storage" value={pdfUrl} onChange={e => { setPdfUrl(e.target.value); setPdfError(""); }} style={inputStyle} />
          </div>
          {pdfError && <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.75rem" }}>{pdfError}</p>}
          <button onClick={handlePdfPublish} disabled={pdfPublishing || !pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()}
            style={{ width: "100%", background: pdfPublished ? "#43A047" : (!pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()) ? "rgba(30,136,229,0.2)" : "#1E88E5", color: pdfPublished ? "#FFFFFF" : (!pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()) ? "rgba(30,136,229,0.4)" : "#FFFFFF", border: "none", borderRadius: 8, padding: "0.75rem 1.5rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", cursor: (pdfPublishing || !pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()) ? "default" : "pointer", transition: "all 0.2s" }}>
            {pdfPublishing ? "Publishing..." : pdfPublished ? "✓ Published — Now Live on Resources Page" : "Publish to Resources Page"}
          </button>
        </div>

        {/* Quick Links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Quick Links</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {QUICK_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.15)"; }}>
                <span style={{ fontSize: "1rem" }}>{link.icon}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.8)", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.04em" }}>{link.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Payment Links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Payment Links</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
            {PAYMENT_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.35)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.12)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: link.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.8)", fontWeight: 600, fontSize: "0.72rem" }}>{link.label}</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", color: link.color, fontWeight: 700, fontSize: "0.85rem" }}>{link.price}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Focal Points */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Focal Points</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
            {FOCAL_POINTS.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, border: "1.5px solid rgba(212,175,55,0.4)", borderRadius: 3, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.7)", fontSize: "0.78rem", lineHeight: 1.5, margin: "0 0 1px" }}>{item.label}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", lineHeight: 1.4, margin: 0 }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Build Roadmap */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#D4AF37", whiteSpace: "nowrap" as const }}>Full Build Roadmap</p>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.2)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "1.25rem" }}>
            {SPRINTS.map((sprint) => {
              const cfg = statusConfig[sprint.status as keyof typeof statusConfig];
              return (
                <div key={sprint.number} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: cfg.headerBg, borderBottom: `1px solid ${cfg.border}`, padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: cfg.dot, margin: "0 0 1px" }}>Sprint {sprint.number}</p>
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>{sprint.title}</p>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: cfg.dot, letterSpacing: "0.04em" }}>{cfg.label}</span>
                  </div>
                  <div style={{ padding: "0.875rem 1.25rem", display: "flex", flexDirection: "column" as const, gap: "0.6rem" }}>
                    {sprint.items.map((item, i) => {
                      const isDone = sprint.status === "completed" || (item as SprintItem).done === true;
                      const checkColor = isDone ? "#43A047" : cfg.dot;
                      const textColor  = isDone ? "rgba(230,230,230,0.35)" : "#FFFFFF";
                      const subColor   = isDone ? "rgba(230,230,230,0.2)" : "rgba(230,230,230,0.35)";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: isDone ? 0.7 : 1 }}>
                          <span style={{ color: checkColor, fontSize: "0.75rem", marginTop: 2, flexShrink: 0 }}>{isDone ? "✓" : "→"}</span>
                          <div>
                            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", fontWeight: 600, color: textColor, margin: "0 0 1px", lineHeight: 1.4 }}>{item.label}</p>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: subColor, margin: 0, lineHeight: 1.4 }}>{item.sub}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: "1.25rem", textAlign: "center" as const, padding: "0.875rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: "#D4AF37" }}>
              Launch Target - June 10-11, 2026 - app.druaiconsulting.com
            </p>
          </div>
        </div>

      </main>
      <footer style={{ textAlign: "center" as const, padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        &copy; 2026 DRU CLEAR™ - All Rights Reserved - DRU AI Consulting
      </footer>
    </div>
  );
}
