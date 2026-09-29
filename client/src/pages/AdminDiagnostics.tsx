import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Brand colors for the read-only detail panel (matches the client-facing page) ──
const NAVY = "#0A2342";
const GOLD = "#D4AF37";
const MAGENTA = "#C2185B";
const BODY_TEXT_ON_NAVY = "#E8E8E8";

// Same reminder content the client-facing questionnaire uses.
const CLEAR_PILLARS: Array<{
  key: string;
  questions: string[];
  scoreField: "clarity_score" | "leadership_score" | "execution_score" | "alignment_score" | "results_score";
  qFields: [string, string, string];
}> = [
  {
    key: "Clarity",
    questions: [
      "Our organization has a clearly defined AI vision that connects to our overall business strategy.",
      "Leaders and teams across the organization understand why we are pursuing AI and what success looks like.",
      "We have identified specific strategic priorities where AI will have the greatest business impact.",
    ],
    scoreField: "clarity_score",
    qFields: ["q1", "q2", "q3"],
  },
  {
    key: "Leadership",
    questions: [
      "Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.",
      "There is a designated executive sponsor who is accountable for driving AI transformation.",
      "Our leadership team actively participates in AI learning, development, and decision-making.",
    ],
    scoreField: "leadership_score",
    qFields: ["q4", "q5", "q6"],
  },
  {
    key: "Execution",
    questions: [
      "We have identified specific business processes where AI can deliver measurable impact.",
      "Our teams have the skills, tools, and resources needed to implement AI solutions today.",
      "We have completed at least one AI pilot or proof of concept in the past 12 months.",
    ],
    scoreField: "execution_score",
    qFields: ["q7", "q8", "q9"],
  },
  {
    key: "Alignment",
    questions: [
      "Our AI initiatives are aligned with our overall business goals and strategic plan.",
      "There is clear and consistent communication between departments about AI priorities and progress.",
      "Our AI efforts are coordinated across teams and business units rather than operating in silos.",
    ],
    scoreField: "alignment_score",
    qFields: ["q10", "q11", "q12"],
  },
  {
    key: "Results",
    questions: [
      "We have defined clear Key Performance Indicators to measure the success of our AI initiatives.",
      "We can demonstrate measurable return on investment from at least one AI-related initiative.",
      "We have a system in place to regularly track and report AI progress to leadership.",
    ],
    scoreField: "results_score",
    qFields: ["q13", "q14", "q15"],
  },
];

const GAP_MESSAGES: Record<string, string> = {
  Clarity: "Your organization lacks a clear AI vision and strategic direction. Without clarity, AI efforts become scattered and ineffective.",
  Leadership: "Your leadership team may not be AI-fluent or actively sponsoring transformation. AI succeeds when leaders champion it.",
  Execution: "Your teams may lack the skills, tools, and processes to implement AI effectively. Strategy without execution is just theory.",
  Alignment: "Your departments and teams are not aligned around a unified AI strategy. Silos kill AI momentum.",
  Results: "You're not yet tracking or demonstrating AI return on investment. What isn't measured can't be managed or defended.",
};
const STRENGTH_MESSAGES: Record<string, string> = {
  Clarity: "Your AI vision is clearly defined and connected to your business strategy — a critical foundation that most organizations struggle to establish.",
  Leadership: "Your executive team is AI-fluent and actively sponsoring transformation — the single most important driver of successful AI adoption.",
  Execution: "Your teams have the skills, tools, and processes to implement AI effectively — turning strategy into measurable results.",
  Alignment: "Your departments operate as a unified AI front with clear communication and coordinated priorities — rare and powerful.",
  Results: "You measure, track, and demonstrate AI ROI consistently — giving you the credibility and data to scale confidently.",
};

const FRAMEWORK_LABELS: Record<string, string> = {
  CLEAR: "DRU CLEAR™",
  "5D_LEADERSHIP": "5D Leadership™ Reflection",
  "5C_CULTURAL_DNA": "5C Cultural DNA™ Reflection",
  AI_SALES_MASTERY: "AI Sales Mastery™ Reflection",
};
const FRAMEWORK_ORDER = ["CLEAR", "5D_LEADERSHIP", "5C_CULTURAL_DNA", "AI_SALES_MASTERY"];
const PILLAR_ORDER: Record<string, string[]> = {
  CLEAR: ["Clarity", "Leadership", "Execution", "Alignment", "Results"],
  "5D_LEADERSHIP": ["Self", "People", "Teams", "Organizations", "Visionary"],
  "5C_CULTURAL_DNA": ["Communication", "Connection", "Collaboration", "Coaching", "Culture Transformation"],
  AI_SALES_MASTERY: [
    "Hyper-Personalized Outreach at Scale",
    "Speak Your Client's Decision Language",
    "Predict Objections Before They Happen",
    "Close with Confidence, Not Pressure",
    "Build Long-Term Client Relationships",
  ],
};

interface ResponseRow {
  id: string;
  email: string;
  diagnostic_tier: string;
  access_token: string;
  answer_text: string | null;
  last_saved_at: string | null;
  question_id: string;
  diagnostic_questions: { framework: string; pillar: string; question_order: number; question_text: string };
}

interface SubmissionRow {
  first_name: string | null;
  last_name: string | null;
  email: string;
  tier: string;
  clarity_score: number; leadership_score: number; execution_score: number; alignment_score: number; results_score: number;
  q1: string; q2: string; q3: string; q4: string; q5: string; q6: string;
  q7: string; q8: string; q9: string; q10: string; q11: string; q12: string;
  q13: string; q14: string; q15: string;
}

interface PersonSummary {
  accessToken: string;
  email: string;
  name: string;
  diagnosticTier: string;
  total: number;
  answered: number;
  lastSaved: string | null;
  badge: string | null;
}

type TierFilter = "all" | "strategic" | "executive";
type StatusFilter = "all" | "complete" | "in_progress";
type SortBy = "lastSaved" | "percent" | "name";

export default function AdminDiagnostics() {
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, SubmissionRow>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("lastSaved");
  const [openToken, setOpenToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: responseRows } = await supabase
        .from("diagnostic_responses")
        .select("id, email, diagnostic_tier, access_token, answer_text, last_saved_at, question_id, diagnostic_questions(framework, pillar, question_order, question_text)");

      const allRows = (responseRows as unknown as ResponseRow[]) || [];
      setRows(allRows);

      const emails = Array.from(new Set(allRows.map((r) => r.email)));
      if (emails.length > 0) {
        const { data: submissionRows } = await supabase
          .from("submissions")
          .select(
            "first_name, last_name, email, tier, clarity_score, leadership_score, execution_score, alignment_score, results_score, q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15, created_at"
          )
          .in("email", emails)
          .order("created_at", { ascending: false });

        const byEmail: Record<string, SubmissionRow> = {};
        (submissionRows || []).forEach((s: any) => {
          if (!byEmail[s.email]) byEmail[s.email] = s; // first hit per email = most recent, since already ordered
        });
        setSubmissions(byEmail);
      }
      setLoading(false);
    })();
  }, []);

  const people: PersonSummary[] = useMemo(() => {
    const byToken = new Map<string, ResponseRow[]>();
    rows.forEach((r) => {
      const list = byToken.get(r.access_token) ?? [];
      list.push(r);
      byToken.set(r.access_token, list);
    });
    return Array.from(byToken.entries()).map(([accessToken, list]) => {
      const email = list[0].email;
      const sub = submissions[email];
      const name = sub && (sub.first_name || sub.last_name) ? [sub.first_name, sub.last_name].filter(Boolean).join(" ") : email;
      const answered = list.filter((r) => (r.answer_text ?? "").trim().length > 0).length;
      const lastSaved = list.reduce<string | null>((latest, r) => {
        if (!r.last_saved_at) return latest;
        if (!latest || r.last_saved_at > latest) return r.last_saved_at;
        return latest;
      }, null);
      return {
        accessToken,
        email,
        name,
        diagnosticTier: list[0].diagnostic_tier,
        total: list.length,
        answered,
        lastSaved,
        badge: sub?.tier ?? null,
      };
    });
  }, [rows, submissions]);

  const counts = useMemo(
    () => ({
      total: people.length,
      strategic: people.filter((p) => p.diagnosticTier === "strategic").length,
      executive: people.filter((p) => p.diagnosticTier === "executive").length,
      complete: people.filter((p) => p.total > 0 && p.answered === p.total).length,
    }),
    [people]
  );

  const filtered = useMemo(() => {
    let r = people;
    if (tierFilter !== "all") r = r.filter((p) => p.diagnosticTier === tierFilter);
    if (statusFilter === "complete") r = r.filter((p) => p.total > 0 && p.answered === p.total);
    if (statusFilter === "in_progress") r = r.filter((p) => p.answered < p.total);
    if (search) {
      const q = search.toLowerCase();
      r = r.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "percent") return b.answered / (b.total || 1) - a.answered / (a.total || 1);
      return (b.lastSaved ?? "").localeCompare(a.lastSaved ?? "");
    });
  }, [people, tierFilter, statusFilter, search, sortBy]);

  const openPerson = filtered.find((p) => p.accessToken === openToken) ?? people.find((p) => p.accessToken === openToken);
  const openRows = openToken ? rows.filter((r) => r.access_token === openToken) : [];
  const openSubmission = openPerson ? submissions[openPerson.email] : null;

  const filterBtn = (active: boolean, color: string): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.63rem", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.35rem 0.875rem",
    borderRadius: 20, cursor: "pointer",
    border: `1px solid ${active ? color : color + "55"}`,
    background: active ? color + "20" : "transparent",
    color: active ? color : color + "AA",
  });

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>Diagnostics</h1>
            <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
              Strategic and Executive pre-session questionnaires, on file
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <div onClick={() => (window.location.href = "/admin-approvals")}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>
              ← Intelligence Dashboard
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[
            { label: "Total On File", value: counts.total, color: "#D4AF37" },
            { label: "Strategic", value: counts.strategic, color: "#1B4D8E" },
            { label: "Executive", value: counts.executive, color: "#C2185B" },
            { label: "Complete", value: counts.complete, color: "#43A047" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#FFFFFF", border: `1px solid ${s.color}25`, borderRadius: 10, padding: "0.875rem 1rem" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: s.color, fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{loading ? "—" : s.value}</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => setTierFilter("all")} style={filterBtn(tierFilter === "all", "#D4AF37")}>All ({counts.total})</button>
          <button onClick={() => setTierFilter("strategic")} style={filterBtn(tierFilter === "strategic", "#1B4D8E")}>Strategic ({counts.strategic})</button>
          <button onClick={() => setTierFilter("executive")} style={filterBtn(tierFilter === "executive", "#C2185B")}>Executive ({counts.executive})</button>
          <button onClick={() => setStatusFilter(statusFilter === "complete" ? "all" : "complete")} style={filterBtn(statusFilter === "complete", "#43A047")}>Complete ({counts.complete})</button>
          <button onClick={() => setStatusFilter(statusFilter === "in_progress" ? "all" : "in_progress")} style={filterBtn(statusFilter === "in_progress", "#E67E22")}>In Progress ({counts.total - counts.complete})</button>
        </div>

        {/* Search / sort */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200, background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none" }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "0.55rem 0.875rem", color: "#0A2342", fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", outline: "none" }}>
            <option value="lastSaved">Sort: Last Saved</option>
            <option value="percent">Sort: % Complete</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.35)", fontSize: "0.68rem", marginBottom: "0.75rem" }}>
          {loading ? "Loading..." : `${filtered.length} on file`}
        </p>

        {/* List */}
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "rgba(10,35,66,0.4)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem" }}>LOADING...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "rgba(10,35,66,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>
            {people.length === 0 ? "No questionnaires on file yet" : "No one matches your filters"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {filtered.map((p) => {
              const isComplete = p.total > 0 && p.answered === p.total;
              return (
                <div key={p.accessToken} onClick={() => setOpenToken(p.accessToken)}
                  style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 10, padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", cursor: "pointer" }}>
                  <div style={{ minWidth: 160, flex: "1 1 160px" }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#0A2342", margin: 0, marginBottom: "1px" }}>{p.name}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.6rem", color: "rgba(10,35,66,0.35)", margin: 0 }}>{p.email}</p>
                  </div>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, flexShrink: 0, background: p.diagnosticTier === "executive" ? "rgba(194,24,91,0.1)" : "rgba(27,77,142,0.1)", color: p.diagnosticTier === "executive" ? "#C2185B" : "#1B4D8E", border: `1px solid ${p.diagnosticTier === "executive" ? "rgba(194,24,91,0.3)" : "rgba(27,77,142,0.3)"}` }}>
                    {p.diagnosticTier === "executive" ? "Executive" : "Strategic"}
                  </span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.68rem", color: "rgba(212,175,55,0.9)", fontWeight: 600, flexShrink: 0 }}>{p.badge ?? "—"}</span>
                  <div style={{ textAlign: "center", flexShrink: 0, minWidth: 60 }}>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>{p.answered} / {p.total}</p>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.5rem", color: "rgba(10,35,66,0.3)", margin: 0, letterSpacing: "0.08em" }}>ANSWERED</p>
                  </div>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: "rgba(10,35,66,0.45)", flexShrink: 0, minWidth: 90 }}>
                    {p.lastSaved ? new Date(p.lastSaved).toLocaleDateString() : "Not started"}
                  </span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0, background: isComplete ? "rgba(67,160,71,0.12)" : "rgba(230,126,34,0.12)", color: isComplete ? "#43A047" : "#E67E22" }}>
                    {isComplete ? "Complete" : "In Progress"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Detail panel — read-only, dark theme matching the client-facing questionnaire */}
        {openToken && openPerson && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50, display: "flex", justifyContent: "center", overflowY: "auto", padding: "40px 20px" }} onClick={() => setOpenToken(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: NAVY, maxWidth: 720, width: "100%", height: "fit-content", borderRadius: 8, padding: "32px", border: `1px solid ${GOLD}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <div>
                  <h2 style={{ fontFamily: "'Playfair Display', serif", color: GOLD, fontSize: 22, fontWeight: 700, margin: 0 }}>{openPerson.name}</h2>
                  <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: "Inter, sans-serif", fontSize: 13, margin: "4px 0 0" }}>{openPerson.email} · {openPerson.diagnosticTier === "executive" ? "Executive" : "Strategic"} Diagnostic</p>
                </div>
                <button onClick={() => setOpenToken(null)} style={{ background: "none", border: `1px solid ${GOLD}`, color: GOLD, borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 12 }}>Close</button>
              </div>

              {FRAMEWORK_ORDER.filter((fw) => openRows.some((r) => r.diagnostic_questions.framework === fw)).map((framework) => {
                const pillars = PILLAR_ORDER[framework].filter((p) => openRows.some((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === p));
                return (
                  <div key={framework} style={{ marginBottom: 32 }}>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: GOLD, fontSize: 18, borderBottom: `1px solid ${GOLD}`, paddingBottom: 8, marginBottom: 16 }}>{FRAMEWORK_LABELS[framework]}</h3>
                    {pillars.map((pillar) => {
                      const pillarRows = openRows
                        .filter((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === pillar)
                        .sort((a, b) => a.diagnostic_questions.question_order - b.diagnostic_questions.question_order);
                      const clearMeta = framework === "CLEAR" ? CLEAR_PILLARS.find((c) => c.key === pillar) : null;
                      return (
                        <div key={pillar} style={{ marginBottom: 24 }}>
                          <h4 style={{ fontFamily: "'Playfair Display', serif", color: GOLD, fontSize: 15, marginBottom: 8 }}>{pillar}</h4>
                          {clearMeta && openSubmission && (
                            <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid rgba(212,175,55,0.3)`, borderRadius: 4, padding: 12, marginBottom: 10 }}>
                              {clearMeta.questions.map((qText, i) => (
                                <p key={i} style={{ margin: "0 0 6px 0", color: BODY_TEXT_ON_NAVY, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                                  &ldquo;{qText}&rdquo; &rarr; <strong style={{ color: "#fff" }}>{(openSubmission as any)[clearMeta.qFields[i]] ?? "—"}</strong>
                                </p>
                              ))}
                              <p style={{ margin: "6px 0 0 0", color: BODY_TEXT_ON_NAVY, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                                Badge: <strong style={{ color: "#fff" }}>{openSubmission.tier}</strong> · {(openSubmission[clearMeta.scoreField] as number) < 12 ? GAP_MESSAGES[pillar] : STRENGTH_MESSAGES[pillar]}
                              </p>
                            </div>
                          )}
                          {pillarRows.map((row, idx) => (
                            <div key={row.id} style={{ marginBottom: 10 }}>
                              <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: "Inter, sans-serif", fontSize: 14, marginBottom: 4 }}>
                                {framework === "CLEAR" ? `${idx + 1}. ` : ""}{row.diagnostic_questions.question_text}
                              </p>
                              <div style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${row.answer_text ? "rgba(212,175,55,0.3)" : MAGENTA + "55"}`, borderRadius: 4, padding: "8px 10px", color: "#fff", fontFamily: "Inter, sans-serif", fontSize: 13, minHeight: 20 }}>
                                {row.answer_text || <em style={{ color: MAGENTA }}>Not answered yet</em>}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
}
