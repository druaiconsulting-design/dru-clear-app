import AdminLayout from "../components/AdminLayout";

interface FocusPoint { label: string; sub: string; }
const FOCAL_POINTS: FocusPoint[] = [
  { label: "GHL Webhook URL — wire into course waitlist form", sub: "Connect GHL webhook to courses.druaiconsulting.com waitlist capture" },
  { label: "From Confusion to Confident with AI™ — Course Build", sub: "Waitlist form built · 3 payment links live · courses.druaiconsulting.com deploy next" },
  { label: "L3 — Courses catalog + course cards", sub: "All courses / My courses tabs · progress bars · tier-gated · non-enrolled see locked CTA" },
  { label: "L3 — api/course-enrollment.ts serverless function", sub: "GHL webhook → Supabase account auto-created → tier assigned → magic link sent" },
  { label: "L3 — GHL workflows (3 tiers)", sub: "self_paced · live_cohort · mastermind · each fires webhook" },
  { label: "L3 — Lesson titles confirmed", sub: "3–5 lessons per week · 4 weeks · DeAnna approves" },
  { label: "L3 — Lesson videos produced (Amelia/HeyGen)", sub: "Path A: talking head · Path B: voice over slides" },
  { label: "L3 — Lesson content entered via /admin", sub: "All Bunny video IDs + agent insights + resources entered per lesson" },
  { label: "L3 — Tier-gated bonus content", sub: "Live Cohort + Mastermind bonus sections locked for self_paced" },
];

interface SprintItem { label: string; sub: string; done?: boolean; }

const statusConfig = {
  completed:  { bg: "rgba(67,160,71,0.06)",  border: "rgba(67,160,71,0.25)",  dot: "#43A047", label: "✅ Completed",   headerBg: "rgba(67,160,71,0.08)"  },
  inprogress: { bg: "rgba(212,175,55,0.06)", border: "rgba(212,175,55,0.25)", dot: "#D4AF37", label: "⏳ In Progress", headerBg: "rgba(212,175,55,0.08)" },
  planned:    { bg: "rgba(30,136,229,0.04)", border: "rgba(30,136,229,0.18)",  dot: "#1E88E5", label: "📝 Planned",     headerBg: "rgba(30,136,229,0.06)" },
};

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
      { done: true,  label: "DeAnna's AI Twin - LIVE",                            sub: "Claude API - trained on all 4 frameworks - answers questions 24/7 - master orchestrator" },
      { done: true,  label: "Daily Connections Accelerator Tier - LIVE",          sub: "navigator + accelerator tiers - DeAnna's Strategic Edge 4th card - daily - founder pricing active" },
      { done: true,  label: "Auth Loading Fix - LIVE",                            sub: "Two-phase loading - instant session resolve - no more splash screen hang" },
      { done: true,  label: "New Logo - LIVE",                                    sub: "DRU CLEAR enhanced logo - transparent background - deployed across app" },
      { done: true,  label: "Revenue & Growth Agents - BUILT",                    sub: "10 agents - Supabase edge function deployed" },
      { done: true,  label: "Content & Brand Agents - BUILT",                     sub: "5 agents - Supabase edge function deployed" },
      { done: true,  label: "Client Delivery Agents + Creative Director - BUILT", sub: "7 agents - deployed" },
      { done: true,  label: "Governance Agents - BUILT",                          sub: "Legal & Finance - AI Governance - HR Division - 14 agents - all edge functions deployed" },
      { done: true,  label: "Travis - Chief of Staff - BUILT",                    sub: "Pure deterministic router - routes all agents across 9 divisions" },
      { done: true,  label: "All 39 Agents - Full Build COMPLETE",                sub: "Twin + Travis + 37 agents across 8 divisions - all system prompts - Genius Mode default" },
      { done: true,  label: "Passkeys / Face ID Login - LIVE",                    sub: "WebAuthn - device-based biometric - Supabase passkey_credentials table" },
      { done: true,  label: "Twin Streaming Fix - LIVE",                          sub: "WallClockTime timeout resolved - routed via Vercel serverless function" },
      { done: true,  label: "SMS Sequences - LIVE",                               sub: "GHL phone number provisioned - SMS automation workflows active" },
      { done: true,  label: "courses.druaiconsulting.com - LIVE",                 sub: "Repo created - Vercel deployed - course landing page live" },
      { done: true,  label: "Add 2 PDFs to app for user access",                  sub: "Delegated to AI Agents — complete" },
      { done: false, label: "LAUNCH",                                              sub: "app.druaiconsulting.com - courses.druaiconsulting.com - full AI empire live - June 10-11, 2026" },
    ],
  },
  {
    number: "5", title: "All Agents Live", status: "completed",
    items: [
      { done: true, label: "Revenue & Growth Division — LIVE",    sub: "10 agents — Omar · Ryan · Serena · Mateo · Aaliyah · Jaylen · Chloe · Zara · Elena · Kwame" },
      { done: true, label: "Content & Brand Division — LIVE",     sub: "5 agents — Camila · Darius · Ravi · Yara · Ingrid" },
      { done: true, label: "Marketing Division — LIVE",           sub: "4 agents — Nia · Luca · Hyun-Ji · Andre" },
      { done: true, label: "Legal & Finance Division — LIVE",     sub: "4 agents — Amara · Diego · Yuki · Marcus — weekly Tuesdays" },
      { done: true, label: "AI Governance Division — LIVE",       sub: "5 agents — Khalid · Sofia · James · Mei Lin · Rafael" },
      { done: true, label: "HR Division — LIVE",                  sub: "3 agents — Naomi · Aiden · Fatima" },
      { done: true, label: "Client Delivery Division — LIVE",     sub: "7 agents — Keisha · Marco · Leila · Jordan · Simone · Theo · Amelia" },
      { done: true, label: "Customer Support Division — LIVE",    sub: "2 agents — Isaiah · Priscilla" },
      { done: true, label: "Full Command Chain — LIVE",           sub: "Isabella · Governance · Raymond/Travis/Priya · AI Twin — one daily briefing notification" },
      { done: true, label: "Community Connection Division — Roster Complete", sub: "9th division · 10 agents · 4 Framework Support Teams" },
      { done: true, label: "Community Connection Page — Updated",  sub: "Navigator: 4 daily cards + weekly framework training · Accelerator: + PDF + monthly Lab! video" },
      { done: true, label: "Community Connection Division — All 4 Layers COMPLETE", sub: "Layer 1: DB · Layer 2: Agent Infrastructure · Layer 3: Community Page · Layer 4: Leadership Lab" },
    ],
  },
  {
    number: "6", title: "Member Platform", status: "inprogress",
    items: [
      { done: true, label: "L1 — New repo `druaiconsulting-members` scaffold", sub: "Vite + React + TypeScript · window.location.pathname router · inline styles · members.druaiconsulting.com" },
      { done: true, label: "L1 — Auth + Supabase client", sub: "Same Supabase project · same session · shared data across app + courses + members" },
      { done: true, label: "L1 — MemberLayout — left sidebar + top nav", sub: "AI4B-style persistent shell · WELCOME · COMMUNITY · COURSES · ACC MONTHLY VIDEOS · RESOURCES · SUPPORT" },
      { done: true, label: "L1 — Feed (Home) page", sub: "Reads same community Supabase tables · agent posts · heart + comment interactions" },
      { done: true, label: "L1 — Start Here checklist", sub: "7 steps · agent-written static content · completion tracked in Supabase" },
      { done: true, label: "L1 — Lesson player", sub: "Bunny Stream video · right lessons panel · module/lesson outline · ✓ Completed button" },
      { done: true, label: "L1 — Acc Monthly Videos page", sub: "Monthly Leadership Lab! archive · Accelerator-gated · Navigator sees upgrade CTA" },
      { done: true, label: "L1 — Leaderboard", sub: "Reads existing community_leaderboard view · Clarity Points™ · Connected → Changemaker levels" },
      { done: true, label: "L1 — Resources section", sub: "Framework PDFs · AI Insights Archive · Tool Guides · Weekly PDF (Accelerator only)" },
      { done: true, label: "L1 — Support Hub", sub: "Chat widget OR email form · decision at build time" },
      { done: true, label: "L1 — PWA config + members.druaiconsulting.com domain + QA", sub: "manifest.json · service worker · Vercel Pro deployment · full QA pass" },
      { done: true, label: "L2 — Supabase magic link redirect", sub: "Redirect URL: courses.druaiconsulting.com/courses" },
      { done: true, label: "L3 — Agent insights per lesson", sub: "Generated by agents in DeAnna's brand voice · reviewed + approved" },
      { done: true, label: "L3 — Firefly agent photos (54 agents)", sub: "Generated via Adobe Firefly v3 · \"randomuser energy\" style · uploaded to Supabase Storage `agents-photos`" },
      { done: true, label: "L3 — HeyGen Photo Avatars created", sub: "One per delivering agent · Creator plan · 200 credits/mo" },
      { done: true, label: "L3 — Videos uploaded to Bunny Stream", sub: "Bunny Library ID added · embed URL format wired into lesson player" },
    ],
  },
  {
    number: "7", title: "Scale & License", status: "planned",
    items: [
      { label: "90-Day Live Run", sub: "Real clients · real data · agent refinement · case studies building · Sprint 7 readiness gate" },
      { label: "DRU CLEAR Scale Your AI Business - LMS", sub: "Full course platform - 8 modules - video + workbooks - progress tracking" },
      { label: "White Label LMS Licensing - Licensed to the World", sub: "Other consultants pay monthly to use your platform - the final frontier" },
      { label: "Affiliate Dashboard", sub: "Track referrals · commissions · top referrer leaderboard · unique referral links · Stripe payout integration" },
    ],
  },
];

export default function AdminSprints() {
  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <a href="/admin" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none", color: "rgba(212,175,55,0.7)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "1.25rem" }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(212,175,55,0.7)"; }}>
            ← PROFIT PULSE
          </a>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem", marginTop: "0.75rem" }}>Build Roadmap</h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>DRU AI Consulting · Sprint History + Active Build</p>
        </div>

        {/* Focal Points */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Focal Points</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
            {FOCAL_POINTS.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem" }}>
                <div style={{ width: 16, height: 16, border: "1.5px solid rgba(212,175,55,0.4)", borderRadius: 3, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.7)", fontSize: "0.78rem", lineHeight: 1.5, margin: "0 0 1px" }}>{item.label}</p>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.65rem", lineHeight: 1.4, margin: 0 }}>{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Build Roadmap */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.5rem" }}>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
            <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#D4AF37", whiteSpace: "nowrap" as const }}>Full Build Roadmap</p>
            <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
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
                        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "0.95rem", fontWeight: 600, color: "#0A2342", margin: 0 }}>{sprint.title}</p>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: cfg.dot, letterSpacing: "0.04em" }}>{cfg.label}</span>
                  </div>
                  <div style={{ padding: "0.875rem 1.25rem", display: "flex", flexDirection: "column" as const, gap: "0.6rem" }}>
                    {sprint.items.map((item, i) => {
                      const isDone = sprint.status === "completed" || (item as SprintItem).done === true;
                      const textColor = isDone ? "rgba(10,35,66,0.35)" : "#0A2342";
                      const subColor  = isDone ? "rgba(10,35,66,0.25)" : "rgba(10,35,66,0.45)";
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, opacity: isDone ? 0.7 : 1 }}>
                          <span style={{ color: isDone ? "#43A047" : cfg.dot, fontSize: "0.75rem", marginTop: 2, flexShrink: 0 }}>{isDone ? "✓" : "→"}</span>
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
              Launch Target — July 7, 2026 — app.druaiconsulting.com
            </p>
          </div>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          © 2026 DRU AI Consulting · All Rights Reserved
        </footer>
      </main>
    </AdminLayout>
  );
}
