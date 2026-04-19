import { useState } from "react";
import NavBar from "../components/NavBar";

const STAT_CARDS = [
  { label: "Assessments Completed", value: "—", sub: "Connect GHL to see live data", icon: "📋", color: "#D4AF37" },
  { label: "Leads Captured", value: "—", sub: "Total in funnel", icon: "👤", color: "#C2185B" },
  { label: "Diagnostics Sold", value: "—", sub: "Strategic + Executive", icon: "💰", color: "#43A047" },
  { label: "Sessions Booked", value: "—", sub: "Upcoming calls", icon: "📅", color: "#1E88E5" },
];

const QUICK_LINKS = [
  { label: "GHL Dashboard",       href: "https://crm.aiforbusiness.com/v2/location/gl07I4JnbkGgW8zJprSz/dashboard", icon: "🔗" },
  { label: "Booking Calendar",    href: "https://link.druaiconsulting.com/widget/bookings/dru-clear-ai-readiness-consultation", icon: "📅" },
  { label: "Live Assessment",     href: "https://assessment.druaiconsulting.com", icon: "🚀" },
  { label: "GitHub Repo",         href: "https://github.com/druaiconsulting-design/dru-clear-app", icon: "💻" },
  { label: "Terms of Engagement", href: "https://app.druaiconsulting.com/terms", icon: "📄" },
];

const PAYMENT_LINKS = [
  { label: "Executive Diagnostic",   price: "$4,997",  href: "https://link.druaiconsulting.com/payment-link/69dc91c480425dc02fbc7645", color: "#C2185B" },
  { label: "Strategic Diagnostic",   price: "$3,497",  href: "https://link.druaiconsulting.com/payment-link/69dc8f8d557558e89e51f222", color: "#D4AF37" },
  { label: "DRU CLEAR™ Framework",   price: "$7,500",  href: "https://link.druaiconsulting.com/payment-link/69e41757557558e89e520dec", color: "#D4AF37" },
  { label: "5D Leadership™",         price: "$6,500",  href: "https://link.druaiconsulting.com/payment-link/69e418197dd3512d920772fc", color: "#1E88E5" },
  { label: "5C Cultural DNA™",       price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e4194e557558e89e520def", color: "#C2185B" },
  { label: "AI Sales Mastery™",      price: "$6,000",  href: "https://link.druaiconsulting.com/payment-link/69e419bb7dd3512d920772fe", color: "#C2185B" },
  { label: "Full Ecosystem — Signing ($13K)", price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e41a287dd3512d920772ff", color: "#43A047" },
  { label: "Full Ecosystem — Final ($13K)", price: "$13,000", href: "https://link.druaiconsulting.com/payment-link/69e50e30557558e89e520fb6", color: "#43A047" },
];

const PENDING_ITEMS = [
  "Flip BYPASS_PAYMENT = false in Frameworks.tsx to go live",
  "Set GHL payment success redirect URLs for all 6 payment links",
  "Build Full Ecosystem thank you page (/thank-you-full-ecosystem)",
  "Build /thank-you-full-ecosystem redirect URL in GHL",
  "Add PDF assets to GHL resource sequences",
  "Provision SMS sequence (pending phone number support)",
  "Populate Resource Hub with first PDF downloads",
];

const SPRINTS = [
  {
    number: "1 & 2",
    title: "Foundation",
    status: "completed",
    items: [
      { label: "DRU CLEAR™ Scorecard PWA live", sub: "assessment.druaiconsulting.com redirects to app.druaiconsulting.com" },
      { label: "5 GHL automation workflows", sub: "Lead capture, completion, nurture, purchase workflows" },
      { label: "React Router architecture — 7 pages live", sub: "Portal, Frameworks, Resources, Daily, ROI, Affiliate, Admin" },
      { label: "Supabase backend database", sub: "Persistent accounts, RLS security, profiles table" },
      { label: "Google Sign In + email/password login", sub: "Automated password reset · admin private door" },
      { label: "Admin Command Center", sub: "Client View / Admin View toggle · private door at /admin" },
      { label: "DRU CLEAR™ logo across all pages", sub: "NavBar, Login, AdminLogin, loading screen" },
      { label: "All 4 IP framework descriptions written", sub: "DRU CLEAR™, 5C Cultural DNA™, 5D Leadership™, AI Sales Mastery™" },
      { label: "Framework infographics embedded in Frameworks page", sub: "4 images live · price badge top right · brand badge bottom left" },
      { label: "15 Things About DeAnna infographic", sub: "Branded HTML · LinkedIn ready · photo + logo + mantra" },
      { label: "DRU Scale System™ designed", sub: "Course + Mastermind + VIP · pricing architecture drafted" },
    ],
  },
  {
    number: "3",
    title: "Revenue + Polish",
    status: "inprogress",
    items: [
      { label: "Framework pricing — LOCKED ✓", sub: "Full pricing architecture finalized · bundle logic complete" },
      { label: "SD & ED payment links — LIVE ✓", sub: "Both payment links active · modal + terms layer wired" },
      { label: "4 GHL framework payment links created ✓", sub: "DRU CLEAR™ · 5D · 5C · AI Sales — all live" },
      { label: "Framework payment buttons wired — modal style ✓", sub: "Terms layer + payment iframe · no external redirects" },
      { label: "Bundle Pricing private page built ✓", sub: "/bundle-pricing · admin copy link · Full Ecosystem CTA live" },
      { label: "Terms of Engagement page ✓", sub: "/terms · linked from payment modal and GHL" },
      { label: "Pricing architecture on Frameworks page ✓", sub: "3-step pathway · individual + bundles · See Detail Below" },
      { label: "Thank you pages — all 6 built ✓", sub: "ED/SD with calendar · 4 frameworks with personal commitment card" },
      { label: "Full Ecosystem thank you page", sub: "/thank-you-full-ecosystem · premium 3-month journey overview" },
      { label: "Go live — flip BYPASS_PAYMENT = false", sub: "Frameworks.tsx line 8 · one change · full revenue flow active" },
      { label: "Dynamic browser tab titles per page", sub: "document.title update per route · currently shows scorecard title everywhere" },
      { label: "PWA install prompt inside app after login", sub: "Audience B installs from app.druaiconsulting.com · opens to portal" },
      { label: "Free tier access — Supabase tier field", sub: "Add tier: free | paid to profiles table · RLS controls content visibility" },
      { label: "Free tier — Portal", sub: "Show scorecard results, tier, pillar breakdown — their personal data" },
      { label: "Free tier — Frameworks page", sub: "Full visibility · framework descriptions + pricing · natural upgrade path" },
      { label: "Free tier — Daily Connections", sub: "One free insight per day · teaser that shows quality · rest locked" },
      { label: "Free tier — ROI Calculator", sub: "Full access · every calculation is a conversion moment" },
      { label: "Free tier — Resources", sub: "One free PDF (freebie lead magnet) · rest locked" },
      { label: "Personalized app — name + photo on login", sub: "Supabase profiles + Google photo · Portal header shows their identity" },
      { label: "Update GHL links to crm.aiforbusiness.com", sub: "Replace all old GHL links across the app" },
      { label: "Daily Connections — automated engine", sub: "Claude API · Supabase · scheduled daily generation" },
      { label: "ROI Calculator — GHL lead capture wired", sub: "Email capture fires into nurture sequence" },
      { label: "Resource Hub — first freebie PDF", sub: "Lead capture → GHL monthly sequence" },
    ],
  },
  {
    number: "4",
    title: "The AI Empire",
    status: "planned",
    items: [
      { label: "Clean up Affiliate page", sub: "Add real affiliate links · update copy and layout" },
      { label: "Passkeys / Face ID login", sub: "Proper backend auth · device-based biometric" },
      { label: "DRU AI Agent Team — private build", sub: "Lead · Content · Analytics · Coach · Sales agents" },
      { label: "DeAnna's AI Twin — private build", sub: "Claude API · trained on all 4 frameworks · inline course coach · 24/7" },
      { label: "DRU CLEAR™ Scale Your AI Business Framework — LMS", sub: "Course platform · 8 modules · video + workbooks · progress tracking" },
      { label: "White label LMS licensing", sub: "Other consultants pay monthly to use your platform" },
      { label: "Community — in-app", sub: "Launch when 20+ active clients" },
      { label: "Affiliate dashboard", sub: "Track referrals · commissions · top referrer rewards" },
    ],
  },
];

const BUNDLE_PRICING_URL = "https://app.druaiconsulting.com/bundle-pricing";

const statusConfig = {
  completed:  { bg: "rgba(67,160,71,0.12)",  border: "rgba(67,160,71,0.35)",  dot: "#43A047", label: "✅ Completed",   headerBg: "rgba(67,160,71,0.08)"  },
  inprogress: { bg: "rgba(212,175,55,0.08)", border: "rgba(212,175,55,0.35)", dot: "#D4AF37", label: "🔄 In Progress", headerBg: "rgba(212,175,55,0.06)" },
  planned:    { bg: "rgba(30,136,229,0.06)", border: "rgba(30,136,229,0.2)",  dot: "#1E88E5", label: "⏳ Planned",     headerBg: "rgba(30,136,229,0.04)" },
};

export default function Admin() {
  const [copied, setCopied] = useState(false);

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

        {/* Header */}
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

        {/* Full Sprint Roadmap */}
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
              Launch Target · app.druaiconsulting.com
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
