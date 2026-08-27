import { useState, useEffect, useMemo } from "react";
import AdminLayout from "../components/AdminLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { registerPasskey } from "../lib/passkey";

const QUICK_LINKS = [
  { label: "GHL Dashboard",        href: "https://crm.aiforbusiness.com/v2/location/gl07I4JnbkGgW8zJprSz/dashboard", icon: "🔗" },
  { label: "Live Assessment",      href: "https://assessment.druaiconsulting.com", icon: "🚀" },
  { label: "Main Website",         href: "https://druaiconsulting.com", icon: "🌐" },
  { label: "Frameworks Page",      href: "https://frameworks.druaiconsulting.com", icon: "📐" },
  { label: "Course Page",          href: "https://courses.druaiconsulting.com", icon: "🎓" },
  { label: "Terms of Engagement",  href: "https://app.druaiconsulting.com/terms", icon: "📄" },
  { label: "GitHub - App",         href: "https://github.com/druaiconsulting-design/dru-clear-app", icon: "💻" },
  { label: "GitHub - Website",     href: "https://github.com/druaiconsulting-design/druaiconsulting-website", icon: "💻" },
  { label: "GitHub - Frameworks",  href: "https://github.com/druaiconsulting-design/druaiconsulting-frameworks", icon: "💻" },
  { label: "GitHub - Courses",     href: "https://github.com/druaiconsulting-design/druaiconsulting-courses", icon: "💻" },
  { label: "GitHub - Members",     href: "https://github.com/druaiconsulting-design/druaiconsulting-members", icon: "💻" },
  { label: "GitHub - Assets",      href: "https://github.com/druaiconsulting-design/druaiconsulting-assets", icon: "💻" },
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
  { label: "DRU CLEAR Accelerator - Founder",                price: "$197/mo", href: "https://link.druaiconsulting.com/payment-link/69ead3d37dd3512d920794b1", color: "#C2185B" },
  { label: "From Confusion to Confident - Self-Paced",       price: "$1,497",  href: "https://link.druaiconsulting.com/payment-link/69f55d0cb615f70a8a33b5fd", color: "#D4AF37" },
  { label: "From Confusion to Confident - Live Cohort",      price: "$7,997",  href: "https://link.druaiconsulting.com/payment-link/69f55e7bb18c99dd72d3c0e5", color: "#C2185B" },
  { label: "From Confusion to Confident - Mastermind",       price: "$12,997", href: "https://link.druaiconsulting.com/payment-link/69f55bf3b615f70a8a33b5fb", color: "#43A047" },
  { label: "IP App Subscription",                            price: "$297/mo", href: "https://link.druaiconsulting.com/payment-link/6a504751c981f3feae6e85f8", color: "#1E88E5" },
];

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

interface ModelCost { today_usd: number; last_7_days_usd: number; }

function useModelCost() {
  const [cost, setCost] = useState<ModelCost>({ today_usd: 0, last_7_days_usd: 0 });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    async function fetchCost() {
      try {
        const sevenDaysAgo = new Date(); sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7); sevenDaysAgo.setUTCHours(0, 0, 0, 0);
        const startOfToday = new Date(); startOfToday.setUTCHours(0, 0, 0, 0);
        const { data, error } = await supabase.from("model_usage_log").select("cost_usd, created_at").gte("created_at", sevenDaysAgo.toISOString());
        if (error) throw error;
        let todayTotal = 0, weekTotal = 0;
        data?.forEach((row: { cost_usd: number; created_at: string }) => {
          weekTotal += Number(row.cost_usd);
          if (new Date(row.created_at) >= startOfToday) todayTotal += Number(row.cost_usd);
        });
        setCost({ today_usd: todayTotal, last_7_days_usd: weekTotal });
      } catch (err) { console.error("Failed to fetch model cost:", err); }
      finally { setLoading(false); }
    }
    fetchCost();
  }, []);
  return { cost, loading };
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
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#D4AF37", whiteSpace: "nowrap" as const }}>Client Intelligence</p>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {SUMMARY_CARDS.map((card) => (
          <div key={card.label} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "0.875rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.9rem" }}>{card.icon}</span>
              <p style={{ fontFamily: "'Playfair Display', serif", color: card.color, fontWeight: 700, fontSize: "1.3rem", margin: 0 }}>{card.value}</p>
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.62rem", letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>{card.label}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" as const }}>
        <input type="text" placeholder="Search name, email, company..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none" }} />
        <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)}
          style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
          <option value="ALL">All Tiers</option>
          <option value="EMERGING">Emerging</option>
          <option value="DEVELOPING">Developing</option>
          <option value="ADVANCING">Advancing</option>
          <option value="LEADING">Leading</option>
        </select>
        <button onClick={handleExport} disabled={filtered.length === 0}
          style={{ background: filtered.length > 0 ? "#D4AF37" : "rgba(212,175,55,0.2)", color: filtered.length > 0 ? "#0A2342" : "rgba(212,175,55,0.4)", border: "none", borderRadius: 6, padding: "0.55rem 1.1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: filtered.length > 0 ? "pointer" : "default", transition: "all 0.2s", whiteSpace: "nowrap" as const }}>
          Export CSV
        </button>
      </div>
      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.68rem", marginBottom: "0.75rem" }}>
        {loading ? "Loading..." : `${filtered.length} submission${filtered.length !== 1 ? "s" : ""}${tierFilter !== "ALL" || search ? " (filtered)" : ""}`}
      </p>
      {loading ? (
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(10,35,66,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>Loading submissions...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(10,35,66,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>
            {submissions.length === 0 ? "No submissions yet - data will appear here when clients complete the assessment." : "No results match your filter."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" as const, borderRadius: 8, border: "1px solid rgba(10,35,66,0.12)" }}>
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
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(10,35,66,0.06)", background: i % 2 === 0 ? "#FFFFFF" : "rgba(10,35,66,0.02)" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.68rem", whiteSpace: "nowrap" as const }}>{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" as const }}>{s.first_name} {s.last_name}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.65)", fontSize: "0.68rem" }}>{s.email}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.65)", fontSize: "0.68rem", whiteSpace: "nowrap" as const }}>{s.company || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.65rem", whiteSpace: "nowrap" as const }}>{s.role || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap" as const }}>{s.total_score ?? "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    {s.tier ? <span style={{ fontFamily: "'Montserrat', sans-serif", color: TIER_COLORS[s.tier] || "#0A2342", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", background: `${TIER_COLORS[s.tier]}18`, border: `1px solid ${TIER_COLORS[s.tier]}50`, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" as const }}>{s.tier}</span> : "-"}
                  </td>
                  {[s.clarity_score, s.leadership_score, s.execution_score, s.alignment_score, s.results_score].map((score, pi) => (
                    <td key={pi} style={{ padding: "0.6rem 0.5rem", textAlign: "center" as const }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", color: getPillarColor(score), fontSize: "0.72rem", fontWeight: 700 }}>{score ?? "-"}</span>
                    </td>
                  ))}
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.65rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.top_gaps || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" as const }}>
        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.35)", fontSize: "0.62rem", margin: 0 }}>C = Clarity · L = Leadership · E = Execution · A = Alignment · R = Results (each out of 15)</p>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {[{ label: "Low (1-6)", color: "#E53935" }, { label: "Mid (7-10)", color: "#D4AF37" }, { label: "Strong (11-15)", color: "#43A047" }].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.62rem" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type JourneyStage = "90_day_active" | "gate_completed" | "app_subscriber" | "mastermind";

interface JourneyRow {
  id: string;
  client_name: string | null;
  email: string | null;
  stage: JourneyStage;
  amount_paid: number | null;
  stage_updated_at: string;
  notes: string | null;
}

const STAGE_META: Record<JourneyStage, { label: string; color: string; icon: string }> = {
  "90_day_active":  { label: "90-Day Active",   color: "#D4AF37", icon: "🌱" },
  "gate_completed": { label: "Gate Completed",  color: "#1E88E5", icon: "🚪" },
  "app_subscriber": { label: "App Subscriber",  color: "#C2185B", icon: "📱" },
  "mastermind":     { label: "Mastermind",      color: "#43A047", icon: "👑" },
};

const STAGE_OPTIONS: JourneyStage[] = ["90_day_active", "gate_completed", "app_subscriber", "mastermind"];

const EMPTY_FORM = { id: "", client_name: "", email: "", stage: "90_day_active" as JourneyStage, amount_paid: "", notes: "" };

function FunnelTrackerDashboard() {
  const [rows, setRows]         = useState<JourneyRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("client_journey_stages")
        .select("id, client_name, email, stage, amount_paid, stage_updated_at, notes")
        .order("stage_updated_at", { ascending: false });
      if (!error && data) setRows(data as JourneyRow[]);
    } catch (err) { console.error("Failed to fetch client_journey_stages:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRows(); }, []);

  const stageCounts = useMemo(() => {
    const counts: Record<JourneyStage, number> = { "90_day_active": 0, "gate_completed": 0, "app_subscriber": 0, "mastermind": 0 };
    rows.forEach((r) => { if (counts[r.stage] !== undefined) counts[r.stage]++; });
    return counts;
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    const matchesStage = stageFilter === "ALL" || r.stage === stageFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q || (r.client_name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q);
    return matchesStage && matchesSearch;
  }), [rows, search, stageFilter]);

  const openAdd = () => { setForm(EMPTY_FORM); setSaveError(""); setShowForm(true); };
  const openEdit = (row: JourneyRow) => {
    setForm({
      id: row.id,
      client_name: row.client_name || "",
      email: row.email || "",
      stage: row.stage,
      amount_paid: row.amount_paid != null ? String(row.amount_paid) : "",
      notes: row.notes || "",
    });
    setSaveError("");
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setForm(EMPTY_FORM); setSaveError(""); };

  const handleSave = async () => {
    if (!form.email.trim()) { setSaveError("Email is required."); return; }
    setSaving(true); setSaveError("");
    const payload = {
      client_name: form.client_name.trim() || null,
      email: form.email.trim().toLowerCase(),
      stage: form.stage,
      amount_paid: form.amount_paid.trim() === "" ? null : Number(form.amount_paid),
      notes: form.notes.trim() || null,
      stage_updated_at: new Date().toISOString(),
    };
    try {
      const { error } = form.id
        ? await supabase.from("client_journey_stages").update(payload).eq("id", form.id)
        : await supabase.from("client_journey_stages").insert(payload);
      if (error) { setSaveError(error.message); }
      else { closeForm(); fetchRows(); }
    } catch (err: any) { setSaveError(err?.message || "Something went wrong."); }
    finally { setSaving(false); }
  };

  const SUMMARY_CARDS = STAGE_OPTIONS.map((stage) => ({
    label: STAGE_META[stage].label,
    value: stageCounts[stage],
    color: STAGE_META[stage].color,
    icon: STAGE_META[stage].icon,
  }));

  return (
    <div style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.25rem" }}>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
        <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "#D4AF37", whiteSpace: "nowrap" as const }}>Funnel Tracker</p>
        <div style={{ flex: 1, height: "0.5px", background: "rgba(212,175,55,0.25)" }} />
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
        {SUMMARY_CARDS.map((card) => (
          <div key={card.label} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "0.875rem 1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.9rem" }}>{card.icon}</span>
              <p style={{ fontFamily: "'Playfair Display', serif", color: card.color, fontWeight: 700, fontSize: "1.3rem", margin: 0 }}>{loading ? "..." : card.value}</p>
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.6rem", letterSpacing: "0.05em", textTransform: "uppercase" as const, margin: 0 }}>{card.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" as const }}>
        <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none" }} />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
          <option value="ALL">All Stages</option>
          {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
        </select>
        <button onClick={openAdd}
          style={{ background: "#D4AF37", color: "#0A2342", border: "none", borderRadius: 6, padding: "0.55rem 1.1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap" as const }}>
          + Add / Override
        </button>
      </div>

      {/* Manual add/edit form */}
      {showForm && (
        <div style={{ background: "rgba(30,136,229,0.05)", border: "1px solid rgba(30,136,229,0.25)", borderRadius: 10, padding: "1.1rem 1.25rem", marginBottom: "1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.9rem" }}>{form.id ? "Edit Entry" : "Manual Entry"}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <input type="text" placeholder="Client name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", outline: "none" }} />
            <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", outline: "none" }} />
            <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value as JourneyStage })}
              style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 0.75rem", fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 600, outline: "none" }}>
              {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </select>
            <input type="number" placeholder="Amount paid" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
              style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", outline: "none" }} />
          </div>
          <input type="text" placeholder="Notes (e.g. refund, comped seat, manual correction)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            style={{ width: "100%", boxSizing: "border-box" as const, background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", outline: "none", marginBottom: "0.75rem" }} />
          {saveError && <p style={{ color: "#E53935", fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", marginBottom: "0.6rem" }}>{saveError}</p>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button onClick={handleSave} disabled={saving}
              style={{ background: "#1E88E5", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.5rem 1.1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.06em", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving..." : form.id ? "Save Changes" : "Add Entry"}
            </button>
            <button onClick={closeForm}
              style={{ background: "transparent", color: "rgba(10,35,66,0.5)", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.5rem 1.1rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.06em", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.68rem", marginBottom: "0.75rem" }}>
        {loading ? "Loading..." : `${filtered.length} client${filtered.length !== 1 ? "s" : ""}${stageFilter !== "ALL" || search ? " (filtered)" : ""}`}
      </p>

      {loading ? (
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(10,35,66,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>Loading funnel data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "2rem", textAlign: "center" as const }}>
          <p style={{ color: "rgba(10,35,66,0.4)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem" }}>
            {rows.length === 0 ? "No funnel activity yet - clients will appear here as payments come in." : "No results match your filter."}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" as const, borderRadius: 8, border: "1px solid rgba(10,35,66,0.12)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" as const, minWidth: 700 }}>
            <thead>
              <tr style={{ background: "rgba(212,175,55,0.08)", borderBottom: "1px solid rgba(212,175,55,0.2)" }}>
                {["Client","Email","Stage","Amount","Updated","Notes",""].map((h) => (
                  <th key={h} style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, padding: "0.6rem 0.75rem", textAlign: "left" as const, whiteSpace: "nowrap" as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(10,35,66,0.06)", background: i % 2 === 0 ? "#FFFFFF" : "rgba(10,35,66,0.02)" }}>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap" as const }}>{r.client_name || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.65)", fontSize: "0.68rem" }}>{r.email || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", color: STAGE_META[r.stage]?.color || "#0A2342", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.06em", background: `${STAGE_META[r.stage]?.color}18`, border: `1px solid ${STAGE_META[r.stage]?.color}50`, borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" as const }}>{STAGE_META[r.stage]?.label || r.stage}</span>
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Playfair Display', serif", color: "#43A047", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" as const }}>{r.amount_paid != null ? `$${Number(r.amount_paid).toLocaleString()}` : "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.65rem", whiteSpace: "nowrap" as const }}>{new Date(r.stage_updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={{ padding: "0.6rem 0.75rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.65rem", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{r.notes || "-"}</td>
                  <td style={{ padding: "0.6rem 0.75rem" }}>
                    <button onClick={() => openEdit(r)}
                      style={{ background: "transparent", color: "#1E88E5", border: "1px solid rgba(30,136,229,0.3)", borderRadius: 5, padding: "0.3rem 0.6rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.62rem", cursor: "pointer", whiteSpace: "nowrap" as const }}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [copied, setCopied]                     = useState(false);
  const { stats, loading }                      = useStats();
  const { cost, loading: costLoading }          = useModelCost();
  const [hasPasskey, setHasPasskey]             = useState(false);
  const [passkeyLoading, setPasskeyLoading]     = useState(false);
  const [passkeyMessage, setPasskeyMessage]     = useState("");
  const [passkeyDismissed, setPasskeyDismissed] = useState(false);

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

  const STAT_CARDS = [
    { label: "Leads Scored Today",        value: loading ? "..." : String(stats.leads_scored_today),  sub: "Omar's daily GHL scan",       icon: "📊", color: "#D4AF37" },
    { label: "High Intent Today",         value: loading ? "..." : String(stats.high_intent_today),   sub: "Ready for outreach",          icon: "🎯", color: "#C2185B" },
    { label: "Strategic Diagnostic Sold", value: loading ? "..." : String(stats.diagnostics_sd_sold), sub: "SD · $3,497 · running total",  icon: "💰", color: "#43A047" },
    { label: "Executive Diagnostic Sold", value: loading ? "..." : String(stats.diagnostics_ed_sold), sub: "ED · $4,997 · running total",  icon: "💎", color: "#D4AF37" },
  ];

  const copyBundleLink = () => {
    navigator.clipboard.writeText("https://app.druaiconsulting.com/bundle-pricing").then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ padding: "2.5rem 1.5rem", maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Page header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>Profit Pulse</h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>DRU AI Consulting - DeAnna R. Upshaw</p>
        </div>

        {/* Passkey banner */}
        {!passkeyDismissed && (
          <div style={{ background: hasPasskey ? "rgba(67,160,71,0.06)" : "rgba(194,24,91,0.06)", border: hasPasskey ? "1px solid rgba(67,160,71,0.3)" : "1px solid rgba(194,24,91,0.3)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flex: 1, minWidth: 0 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: hasPasskey ? "rgba(67,160,71,0.12)" : "rgba(194,24,91,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "1.1rem" }}>{hasPasskey ? "✅" : "🔐"}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: hasPasskey ? "#43A047" : "#0A2342", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.04em", margin: 0, marginBottom: "0.1rem" }}>{hasPasskey ? "Passkey Active" : "Speed Up Your Login"}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.68rem", margin: 0, lineHeight: 1.4 }}>{hasPasskey ? "Face ID or fingerprint sign-in is enabled." : "Set up Face ID or fingerprint to sign in instantly."}</p>
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
                <button onClick={() => setPasskeyDismissed(true)} style={{ background: "none", border: "none", color: "rgba(10,35,66,0.3)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0.25rem" }}>×</button>
              )}
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem", marginBottom: "0.875rem" }}>
          {STAT_CARDS.map((stat) => (
            <div key={stat.label} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1.1rem 1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>{stat.icon}</span>
                <p style={{ fontFamily: "'Playfair Display', serif", color: stat.color, fontWeight: 700, fontSize: "1.4rem", margin: 0 }}>{stat.value}</p>
              </div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{stat.label}</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.65rem", margin: 0 }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Sessions booked */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(30,136,229,0.2)", borderRadius: 10, padding: "1.1rem 1rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>📅</span>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#1E88E5", fontWeight: 700, fontSize: "1.4rem", margin: 0 }}>{loading ? "..." : String(stats.sessions_booked)}</p>
          </div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>Sessions Booked</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.65rem", margin: 0 }}>Running total · updates in real time on booking</p>
        </div>

        {/* AI model cost */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 10, padding: "1.1rem 1rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🤖</span>
            <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontWeight: 700, fontSize: "1.4rem", margin: 0 }}>{costLoading ? "..." : `$${cost.today_usd.toFixed(2)}`}</p>
          </div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>AI Model Cost — Today</p>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.65rem", margin: 0 }}>{costLoading ? "..." : `$${cost.last_7_days_usd.toFixed(2)} over the last 7 days`} · real Anthropic API spend, logged per call</p>
        </div>

        <ClientIntelligenceDashboard />

        <FunnelTrackerDashboard />

        {/* Private Client Links */}
        <div style={{ background: "rgba(194,24,91,0.04)", border: "1px solid rgba(194,24,91,0.25)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Private Client Links</p>
          <div style={{ background: "#FFFFFF", border: "1px solid rgba(194,24,91,0.2)", borderRadius: 10, padding: "1rem 1.25rem" }}>
            <div style={{ marginBottom: 10 }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "0.9rem", fontWeight: 600, marginBottom: 3 }}>Bundle Pricing Page</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.68rem", lineHeight: 1.5 }}>Private - Send to client during diagnostic call - Full Ecosystem payment live</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="https://app.druaiconsulting.com/bundle-pricing" target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "block", background: "transparent", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, textDecoration: "none", textAlign: "center" as const, padding: "0.6rem 0.875rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.35)" }}>Preview Page</a>
              <button onClick={copyBundleLink} style={{ flex: 1, background: copied ? "#43A047" : "#C2185B", color: "#FFFFFF", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.6rem 0.875rem", borderRadius: 6, border: "none", cursor: "pointer", transition: "background 0.2s" }}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Quick Links</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
            {QUICK_LINKS.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.4)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(10,35,66,0.1)"; }}>
                <span style={{ fontSize: "1rem" }}>{link.icon}</span>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 600, fontSize: "0.72rem", letterSpacing: "0.04em" }}>{link.label}</span>
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
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 8, padding: "0.75rem 1rem", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(212,175,55,0.35)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(10,35,66,0.08)"; }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: link.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 600, fontSize: "0.72rem" }}>{link.label}</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", color: link.color, fontWeight: 700, fontSize: "0.85rem" }}>{link.price}</span>
              </a>
            ))}
          </div>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          &copy; 2026 DRU AI Consulting · All Rights Reserved
        </footer>

      </main>
    </AdminLayout>
  );
}
