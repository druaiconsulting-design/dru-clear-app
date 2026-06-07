// From Confusion to Confident with AI™ — Student Dashboard
// Embedded in admin app — top nav removed (AdminTopNav handles navigation)

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const BUNNY_LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID || "";

const PAYMENT_LINKS = {
  self_paced:  "https://link.druaiconsulting.com/payment-link/69f55d0cb615f70a8a33b5fd",
  live_cohort: "https://link.druaiconsulting.com/payment-link/69f55e7bb18c99dd72d3c0e5",
  mastermind:  "https://link.druaiconsulting.com/payment-link/69f55bf3b615f70a8a33b5fb",
};

const TIER_LABELS: Record<string, string> = {
  self_paced: "Self-Paced", live_cohort: "Live Cohort", mastermind: "Cohort Mastermind",
};
const TIER_COLORS: Record<string, string> = {
  self_paced: "#D4AF37", live_cohort: "#C2185B", mastermind: "#43A047",
};

interface Module     { id: string; module_number: number; title: string; description: string | null; }
interface Lesson     { id: string; module_id: string; lesson_number: number; title: string; description: string | null; bunny_video_id: string | null; duration_minutes: number | null; resources: {title:string;url:string}[] | null; agent_insight: string | null; agent_name: string | null; is_active: boolean; }
interface Progress   { lesson_id: string; completed: boolean; }
interface Enrollment { tier: string; }

function ProgressRing({ percent }: { percent: number }) {
  const r = 36; const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(10,35,66,0.1)" strokeWidth="6" />
        <circle cx="44" cy="44" r={r} fill="none" stroke="#D4AF37" strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.1rem", fontWeight: 700, lineHeight: 1 }}>{percent}%</span>
        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.48rem", letterSpacing: "0.08em", marginTop: 2 }}>DONE</span>
      </div>
    </div>
  );
}

export default function CourseDashboard({ adminPreview = false }: { adminPreview?: boolean }) {
  const { user, isAdmin } = useAuth();
  const [enrollment, setEnrollment]     = useState<Enrollment | null | "loading">("loading");
  const [modules, setModules]           = useState<Module[]>([]);
  const [lessons, setLessons]           = useState<Lesson[]>([]);
  const [progress, setProgress]         = useState<Progress[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [completing, setCompleting]     = useState(false);
  const [railOpen, setRailOpen]         = useState(true);

  useEffect(() => {
    if (!user) return;
    if (adminPreview || isAdmin) { setEnrollment({ tier: "mastermind" }); return; }
    supabase.from("course_enrollments")
      .select("tier").eq("user_id", user.id).eq("course_id", "confusion_to_confident").eq("payment_status", "active").single()
      .then(({ data }) => setEnrollment(data ? { tier: data.tier } : null));
  }, [user?.id, isAdmin, adminPreview]);

  useEffect(() => {
    supabase.from("course_modules").select("*").eq("course_id", "confusion_to_confident").eq("is_active", true).order("module_number")
      .then(({ data }) => setModules((data as Module[]) || []));
    supabase.from("course_lessons").select("*").eq("is_active", true).order("lesson_number")
      .then(({ data }) => { const all = (data as Lesson[]) || []; setLessons(all); if (all.length > 0) setActiveLesson(all[0]); });
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("course_progress").select("lesson_id, completed").eq("user_id", user.id)
      .then(({ data }) => setProgress((data as Progress[]) || []));
  }, [user?.id]);

  const completedIds    = useMemo(() => new Set(progress.filter(p => p.completed).map(p => p.lesson_id)), [progress]);
  const totalLessons    = lessons.length;
  const completedCount  = completedIds.size;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  const unlockedIds = useMemo(() => {
    const unlocked = new Set<string>();
    for (let i = 0; i < lessons.length; i++) {
      if (i === 0) { unlocked.add(lessons[i].id); continue; }
      if (completedIds.has(lessons[i - 1].id)) unlocked.add(lessons[i].id);
      else break;
    }
    return unlocked;
  }, [lessons, completedIds]);

  const handleMarkComplete = async () => {
    if (!user || !activeLesson) return;
    setCompleting(true);
    await supabase.from("course_progress").upsert(
      { user_id: user.id, lesson_id: activeLesson.id, completed: true, completed_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    );
    setProgress(prev => [...prev.filter(p => p.lesson_id !== activeLesson.id), { lesson_id: activeLesson.id, completed: true }]);
    const idx = lessons.findIndex(l => l.id === activeLesson.id);
    if (idx >= 0 && idx < lessons.length - 1) setActiveLesson(lessons[idx + 1]);
    setCompleting(false);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (enrollment === "loading") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.75rem", letterSpacing: "0.1em" }}>LOADING...</p>
      </div>
    );
  }

  // ── Not enrolled ──────────────────────────────────────────────────────────
  if (enrollment === null) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.75rem" }}>Access Required</p>
          <h1 style={{ fontFamily: "'Cinzel', serif", color: "#0A2342", fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.4, marginBottom: "0.75rem" }}>From Confusion to Confident<br />with AI™</h1>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.8rem", lineHeight: 1.7, marginBottom: "2rem" }}>
            Signed in as <strong style={{ color: "#D4AF37" }}>{user?.email}</strong> — no active enrollment found.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "Self-Paced",       price: "$1,497",  key: "self_paced",  color: "#D4AF37" },
              { label: "Live Cohort",      price: "$7,997",  key: "live_cohort", color: "#C2185B" },
              { label: "Cohort Mastermind",price: "$12,997", key: "mastermind",  color: "#43A047" },
            ].map(t => (
              <a key={t.key} href={PAYMENT_LINKS[t.key as keyof typeof PAYMENT_LINKS]} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.5rem", borderRadius: 10, border: `1px solid ${t.color}40`, background: `${t.color}0A`, textDecoration: "none" }}>
                <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontWeight: 700, fontSize: "0.85rem" }}>{t.label}</span>
                <span style={{ fontFamily: "'Playfair Display', serif", color: t.color, fontWeight: 700, fontSize: "1rem" }}>{t.price}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const tier = enrollment.tier;

  // ── Full Dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#FAFAF8", minHeight: 0 }}>

      {/* Welcome bar */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid rgba(10,35,66,0.08)", padding: "1rem 1.5rem", display: "flex", alignItems: "center", gap: "1.5rem", flexShrink: 0 }}>
        <ProgressRing percent={progressPercent} />
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.15rem", fontWeight: 700, marginBottom: "0.2rem" }}>
            Welcome back, {user?.firstName}
          </h2>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.75rem" }}>
            {completedCount} of {totalLessons} lessons complete
            {completedCount === totalLessons && totalLessons > 0 && <span style={{ color: "#43A047", marginLeft: "0.5rem" }}>· 🎉 Course Complete!</span>}
          </p>
        </div>
        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: `${TIER_COLORS[tier] || "#D4AF37"}18`, border: `1px solid ${TIER_COLORS[tier] || "#D4AF37"}50`, color: TIER_COLORS[tier] || "#D4AF37", flexShrink: 0 }}>
          {TIER_LABELS[tier] || tier}
        </span>
      </div>

      {/* Main layout — left rail + right panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* Left rail */}
        <div style={{ width: railOpen ? 280 : 48, background: "rgba(10,35,66,0.03)", borderRight: "1px solid rgba(10,35,66,0.1)", transition: "width 0.25s ease", flexShrink: 0, overflowY: railOpen ? "auto" : "hidden", display: "flex", flexDirection: "column" }}>
          <button onClick={() => setRailOpen(!railOpen)}
            style={{ padding: "0.75rem", background: "none", border: "none", color: "rgba(10,35,66,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: railOpen ? "flex-end" : "center", borderBottom: "1px solid rgba(10,35,66,0.08)", flexShrink: 0 }}>
            <span style={{ fontSize: "0.8rem" }}>{railOpen ? "◀" : "▶"}</span>
          </button>

          {railOpen && (
            <div style={{ padding: "0.75rem 0.5rem" }}>
              {modules.map(mod => {
                const modLessons   = lessons.filter(l => l.module_id === mod.id);
                const modCompleted = modLessons.filter(l => completedIds.has(l.id)).length;
                const allDone      = modLessons.length > 0 && modCompleted === modLessons.length;
                return (
                  <div key={mod.id} style={{ marginBottom: "0.5rem" }}>
                    <div style={{ padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, color: allDone ? "#43A047" : "#D4AF37", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>
                        {allDone ? "✓" : `${modCompleted}/${modLessons.length}`}
                      </span>
                      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#0A2342", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                        Module {mod.module_number}: {mod.title}
                      </span>
                    </div>
                    {modLessons.map(lesson => {
                      const done     = completedIds.has(lesson.id);
                      const unlocked = unlockedIds.has(lesson.id);
                      const isActive = activeLesson?.id === lesson.id;
                      return (
                        <button key={lesson.id}
                          onClick={() => unlocked && setActiveLesson(lesson)}
                          disabled={!unlocked}
                          style={{ width: "100%", textAlign: "left" as const, padding: "0.5rem 0.75rem 0.5rem 1.5rem", background: isActive ? "rgba(212,175,55,0.12)" : "transparent", border: isActive ? "1px solid rgba(212,175,55,0.35)" : "1px solid transparent", borderRadius: 6, cursor: unlocked ? "pointer" : "default", marginBottom: "2px", display: "flex", alignItems: "center", gap: "0.5rem", opacity: unlocked ? 1 : 0.4 }}>
                          <span style={{ fontSize: "0.7rem", flexShrink: 0 }}>{done ? "✅" : unlocked ? "▶" : "🔒"}</span>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: isActive ? "#B8941F" : "#0A2342", fontWeight: isActive ? 700 : 400, lineHeight: 1.3, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{lesson.title}</p>
                            {lesson.duration_minutes && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.58rem", color: "rgba(10,35,66,0.4)", margin: 0 }}>{lesson.duration_minutes} min</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", background: "#FAFAF8" }}>
          {!activeLesson ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "rgba(10,35,66,0.3)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>
              Select a lesson to begin
            </div>
          ) : (
            <div style={{ maxWidth: 820, margin: "0 auto" }}>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "0.3rem" }}>
                  {modules.find(m => m.id === activeLesson.module_id)?.title ?? ""}
                </p>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.4rem", fontWeight: 700, lineHeight: 1.3 }}>{activeLesson.title}</h2>
              </div>

              {/* Video player — dark background stays */}
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", background: "#0A2342", border: "1px solid rgba(10,35,66,0.15)", marginBottom: "1.25rem" }}>
                {activeLesson.bunny_video_id && BUNNY_LIBRARY_ID ? (
                  <iframe
                    src={`https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${activeLesson.bunny_video_id}?autoplay=false&loop=false&muted=false&preload=true&responsive=true`}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>🎬</span>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.75rem", letterSpacing: "0.08em" }}>VIDEO COMING SOON</p>
                  </div>
                )}
              </div>

              {activeLesson.description && (
                <div style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 8 }}>
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.7)", fontSize: "0.82rem", lineHeight: 1.7, margin: 0 }}>{activeLesson.description}</p>
                </div>
              )}

              {activeLesson.agent_insight && (
                <div style={{ marginBottom: "1.25rem", padding: "1rem 1.25rem", background: "rgba(194,24,91,0.04)", border: "1px solid rgba(194,24,91,0.2)", borderRadius: 8, display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>✦</span>
                  <div>
                    {activeLesson.agent_name && <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.3rem" }}>{activeLesson.agent_name} · Insight</p>}
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.65)", fontSize: "0.78rem", lineHeight: 1.6, margin: 0 }}>{activeLesson.agent_insight}</p>
                  </div>
                </div>
              )}

              {activeLesson.resources && activeLesson.resources.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "0.5rem" }}>Resources</p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.4rem" }}>
                    {activeLesson.resources.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.875rem", background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, textDecoration: "none" }}>
                        <span style={{ fontSize: "0.8rem" }}>📄</span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 600 }}>{r.title}</span>
                        <span style={{ marginLeft: "auto", fontFamily: "'Montserrat', sans-serif", color: "#B8941F", fontSize: "0.6rem", fontWeight: 700 }}>Download ↓</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(10,35,66,0.1)" }}>
                <button
                  onClick={() => { const i = lessons.findIndex(l => l.id === activeLesson.id); if (i > 0) setActiveLesson(lessons[i - 1]); }}
                  disabled={lessons.findIndex(l => l.id === activeLesson.id) === 0}
                  style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, padding: "0.6rem 1.25rem", borderRadius: 6, border: "1px solid rgba(10,35,66,0.2)", background: "#FFFFFF", color: "rgba(10,35,66,0.5)", cursor: "pointer", opacity: lessons.findIndex(l => l.id === activeLesson.id) === 0 ? 0.3 : 1 }}>
                  ← Previous
                </button>
                {!completedIds.has(activeLesson.id) ? (
                  <button onClick={handleMarkComplete} disabled={completing}
                    style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, padding: "0.6rem 1.5rem", borderRadius: 6, border: "none", background: "#D4AF37", color: "#0A2342", cursor: completing ? "default" : "pointer", opacity: completing ? 0.7 : 1 }}>
                    {completing ? "Marking..." : "Mark Complete ✓"}
                  </button>
                ) : (
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#43A047" }}>✅ Completed</span>
                )}
                <button
                  onClick={() => { const i = lessons.findIndex(l => l.id === activeLesson.id); if (i < lessons.length - 1 && unlockedIds.has(lessons[i + 1].id)) setActiveLesson(lessons[i + 1]); }}
                  disabled={(() => { const i = lessons.findIndex(l => l.id === activeLesson.id); return i >= lessons.length - 1 || !unlockedIds.has(lessons[i + 1]?.id); })()}
                  style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, padding: "0.6rem 1.25rem", borderRadius: 6, border: "1px solid rgba(212,175,55,0.4)", background: "#FFFFFF", color: "#B8941F", cursor: "pointer", opacity: (() => { const i = lessons.findIndex(l => l.id === activeLesson.id); return i >= lessons.length - 1 || !unlockedIds.has(lessons[i + 1]?.id) ? 0.3 : 1; })() }}>
                  Next →
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", borderTop: "1px solid rgba(10,35,66,0.08)", background: "#FFFFFF", flexShrink: 0 }}>
        © 2026 DRU AI Consulting · From Confusion to Confident with AI™ · All Rights Reserved
      </footer>
    </div>
  );
}
