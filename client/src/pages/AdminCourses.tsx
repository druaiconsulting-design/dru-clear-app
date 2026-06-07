import { useState, useEffect } from "react";
import AdminLayout from "../components/AdminLayout";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Module     { id: string; module_number: number; title: string; description: string | null; is_active: boolean; }
interface Lesson     { id: string; module_id: string; lesson_number: number; title: string; description: string | null; bunny_video_id: string | null; duration_minutes: number | null; agent_insight: string | null; agent_name: string | null; is_active: boolean; }
interface Enrollment { id: string; user_id: string; tier: string; payment_status: string; enrolled_at: string; profiles?: { first_name?: string; last_name?: string; email?: string } | null; }

type Tab = "modules" | "lessons" | "enrollments";

const TIER_COLORS: Record<string, string> = { self_paced: "#D4AF37", live_cohort: "#C2185B", mastermind: "#43A047" };
const TIER_LABELS: Record<string, string> = { self_paced: "Self-Paced", live_cohort: "Live Cohort", mastermind: "Mastermind" };

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)",
  borderRadius: 6, padding: "0.6rem 0.875rem", color: "#0A2342",
  fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none", boxSizing: "border-box",
};

export default function AdminCourses() {
  const { user } = useAuth();
  const [tab, setTab]               = useState<Tab>("modules");
  const [modules, setModules]       = useState<Module[]>([]);
  const [lessons, setLessons]       = useState<Lesson[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  const [newLesson, setNewLesson] = useState({
    module_id: "", title: "", description: "", bunny_video_id: "",
    duration_minutes: "", agent_name: "", agent_insight: "",
  });

  const fetchAll = async () => {
    const [mods, less, enroll] = await Promise.all([
      supabase.from("course_modules").select("*").eq("course_id", "confusion_to_confident").order("module_number"),
      supabase.from("course_lessons").select("*").order("lesson_number"),
      supabase.from("course_enrollments").select("*, profiles(first_name, last_name, email)").eq("course_id", "confusion_to_confident").order("enrolled_at", { ascending: false }),
    ]);
    setModules((mods.data as Module[]) || []);
    setLessons((less.data as Lesson[]) || []);
    setEnrollments((enroll.data as Enrollment[]) || []);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAddLesson = async () => {
    if (!newLesson.module_id || !newLesson.title.trim()) { setMsg("Module and title required."); return; }
    setSaving(true); setMsg("");
    const modLessons = lessons.filter(l => l.module_id === newLesson.module_id);
    const nextNum    = modLessons.length > 0 ? Math.max(...modLessons.map(l => l.lesson_number)) + 1 : 1;
    const { error } = await supabase.from("course_lessons").insert({
      module_id: newLesson.module_id, lesson_number: nextNum,
      title: newLesson.title.trim(),
      description: newLesson.description.trim() || null,
      bunny_video_id: newLesson.bunny_video_id.trim() || null,
      duration_minutes: newLesson.duration_minutes ? parseInt(newLesson.duration_minutes) : null,
      agent_name: newLesson.agent_name.trim() || null,
      agent_insight: newLesson.agent_insight.trim() || null,
      is_active: true,
    });
    if (error) { setMsg(`Error: ${error.message}`); }
    else {
      setMsg("✓ Lesson added");
      setNewLesson({ module_id: newLesson.module_id, title: "", description: "", bunny_video_id: "", duration_minutes: "", agent_name: "", agent_insight: "" });
      await fetchAll();
    }
    setSaving(false);
  };

  const toggleLesson = async (id: string, current: boolean) => {
    await supabase.from("course_lessons").update({ is_active: !current }).eq("id", id);
    await fetchAll();
  };

  const filteredLessons = selectedModule === "all" ? lessons : lessons.filter(l => l.module_id === selectedModule);

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1000, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.2rem" }}>From Confusion to Confident with AI™</h1>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.78rem" }}>Course Management · Modules · Lessons · Enrollments</p>
          </div>
          <a href="https://courses.druaiconsulting.com" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.5rem 1rem", letterSpacing: "0.06em", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            👤 Student View ↗
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.75rem" }}>
          {[
            { label: "Modules",     value: modules.length,                             color: "#D4AF37" },
            { label: "Lessons",     value: lessons.filter(l => l.is_active).length,    color: "#1E88E5" },
            { label: "Enrollments", value: enrollments.length,                         color: "#C2185B" },
            { label: "With Video",  value: lessons.filter(l => l.bunny_video_id).length, color: "#43A047" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: `1px solid ${s.color}30`, borderRadius: 10, padding: "0.875rem 1rem" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: s.color, fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{s.value}</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "4px 0 0" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {(["modules", "lessons", "enrollments"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "0.4rem 1rem", borderRadius: 20, cursor: "pointer", border: "none", background: tab === t ? "#D4AF37" : "rgba(10,35,66,0.06)", color: tab === t ? "#0A2342" : "rgba(10,35,66,0.5)", transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {/* ── MODULES TAB ── */}
        {tab === "modules" && (
          <div>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.72rem", marginBottom: "0.75rem" }}>Modules are seeded from Supabase SQL. Edit titles directly in Supabase or add lessons in the Lessons tab.</p>
            {modules.map(mod => {
              const modLessons = lessons.filter(l => l.module_id === mod.id);
              return (
                <div key={mod.id} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 2px" }}>Module {mod.module_number}</p>
                    <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1rem", fontWeight: 600, margin: 0 }}>{mod.title}</p>
                    {mod.description && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", margin: "2px 0 0" }}>{mod.description}</p>}
                  </div>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", color: "rgba(212,175,55,0.8)", fontWeight: 700 }}>{modLessons.filter(l => l.bunny_video_id).length}/{modLessons.length} videos</span>
                </div>
              );
            })}
          </div>
        )}

        {/* ── LESSONS TAB ── */}
        {tab === "lessons" && (
          <div>
            {/* Add lesson form */}
            <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, padding: "1.25rem 1.5rem", marginBottom: "1.5rem" }}>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "1rem" }}>Add New Lesson</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <select value={newLesson.module_id} onChange={e => setNewLesson(p => ({ ...p, module_id: e.target.value }))} style={{ ...inputStyle, gridColumn: "1 / -1" as const }}>
                  <option value="">Select Module</option>
                  {modules.map(m => <option key={m.id} value={m.id}>Module {m.module_number}: {m.title}</option>)}
                </select>
                <input placeholder="Lesson Title *" value={newLesson.title} onChange={e => setNewLesson(p => ({ ...p, title: e.target.value }))} style={inputStyle} />
                <input placeholder="Bunny Stream Video ID" value={newLesson.bunny_video_id} onChange={e => setNewLesson(p => ({ ...p, bunny_video_id: e.target.value }))} style={inputStyle} />
                <input placeholder="Duration (minutes)" value={newLesson.duration_minutes} onChange={e => setNewLesson(p => ({ ...p, duration_minutes: e.target.value }))} style={inputStyle} />
                <input placeholder="Agent Name (e.g. Nia Robinson)" value={newLesson.agent_name} onChange={e => setNewLesson(p => ({ ...p, agent_name: e.target.value }))} style={inputStyle} />
                <textarea placeholder="Lesson Description" value={newLesson.description} onChange={e => setNewLesson(p => ({ ...p, description: e.target.value }))} style={{ ...inputStyle, resize: "vertical" as const, minHeight: 72, gridColumn: "1 / -1" as const }} />
                <textarea placeholder="Agent Insight (tip shown below video)" value={newLesson.agent_insight} onChange={e => setNewLesson(p => ({ ...p, agent_insight: e.target.value }))} style={{ ...inputStyle, resize: "vertical" as const, minHeight: 60, gridColumn: "1 / -1" as const }} />
              </div>
              {msg && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: msg.startsWith("✓") ? "#43A047" : "#E53935", marginBottom: "0.75rem" }}>{msg}</p>}
              <button onClick={handleAddLesson} disabled={saving}
                style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, padding: "0.6rem 1.5rem", borderRadius: 6, border: "none", background: "#D4AF37", color: "#0A2342", cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, letterSpacing: "0.06em" }}>
                {saving ? "Saving..." : "Add Lesson"}
              </button>
            </div>

            {/* Module filter */}
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" as const }}>
              <button onClick={() => setSelectedModule("all")} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.35rem 0.875rem", borderRadius: 20, cursor: "pointer", border: "none", background: selectedModule === "all" ? "#D4AF37" : "rgba(10,35,66,0.06)", color: selectedModule === "all" ? "#0A2342" : "rgba(10,35,66,0.5)" }}>All</button>
              {modules.map(m => (
                <button key={m.id} onClick={() => setSelectedModule(m.id)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, padding: "0.35rem 0.875rem", borderRadius: 20, cursor: "pointer", border: "none", background: selectedModule === m.id ? "#D4AF37" : "rgba(10,35,66,0.06)", color: selectedModule === m.id ? "#0A2342" : "rgba(10,35,66,0.5)" }}>
                  M{m.module_number}: {m.title}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.4rem" }}>
              {filteredLessons.map(lesson => {
                const mod = modules.find(m => m.id === lesson.module_id);
                return (
                  <div key={lesson.id} style={{ background: lesson.is_active ? "#FFFFFF" : "rgba(10,35,66,0.02)", border: `1px solid ${lesson.is_active ? "rgba(10,35,66,0.1)" : "rgba(10,35,66,0.05)"}`, borderRadius: 8, padding: "0.75rem 1rem", display: "flex", alignItems: "center", gap: "1rem", opacity: lesson.is_active ? 1 : 0.5 }}>
                    <div style={{ flexShrink: 0, textAlign: "center" as const, minWidth: 36 }}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.6rem", fontWeight: 700, margin: 0 }}>M{mod?.module_number}</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>{lesson.lesson_number}</p>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.75rem", fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{lesson.title}</p>
                      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" as const }}>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.62rem", color: lesson.bunny_video_id ? "#43A047" : "rgba(10,35,66,0.25)" }}>{lesson.bunny_video_id ? `🎬 ${lesson.bunny_video_id}` : "No video yet"}</span>
                        {lesson.duration_minutes && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.62rem", color: "rgba(10,35,66,0.4)" }}>{lesson.duration_minutes} min</span>}
                        {lesson.agent_name && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.62rem", color: "#C2185B" }}>✦ {lesson.agent_name}</span>}
                      </div>
                    </div>
                    <button onClick={() => toggleLesson(lesson.id, lesson.is_active)}
                      style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "0.3rem 0.75rem", borderRadius: 6, cursor: "pointer", border: `1px solid ${lesson.is_active ? "rgba(194,24,91,0.35)" : "rgba(67,160,71,0.35)"}`, background: "transparent", color: lesson.is_active ? "#C2185B" : "#43A047", letterSpacing: "0.06em", flexShrink: 0 }}>
                      {lesson.is_active ? "Hide" : "Show"}
                    </button>
                  </div>
                );
              })}
              {filteredLessons.length === 0 && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.3)", fontSize: "0.8rem", textAlign: "center" as const, padding: "2rem" }}>No lessons yet — add one above</p>}
            </div>
          </div>
        )}

        {/* ── ENROLLMENTS TAB ── */}
        {tab === "enrollments" && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.4rem" }}>
            {enrollments.map(e => {
              const profile = (e as any).profiles;
              const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || e.user_id.slice(0, 8);
              return (
                <div key={e.id} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 8, padding: "0.75rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" as const }}>
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.75rem", fontWeight: 600, margin: "0 0 2px" }}>{name}</p>
                    <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.62rem", margin: 0 }}>{profile?.email || e.user_id}</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: `${TIER_COLORS[e.tier] || "#D4AF37"}18`, border: `1px solid ${TIER_COLORS[e.tier] || "#D4AF37"}50`, color: TIER_COLORS[e.tier] || "#D4AF37" }}>{TIER_LABELS[e.tier] || e.tier}</span>
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: e.payment_status === "active" ? "rgba(67,160,71,0.1)" : "rgba(194,24,91,0.1)", color: e.payment_status === "active" ? "#43A047" : "#C2185B" }}>{e.payment_status}</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.35)", fontSize: "0.62rem" }}>{new Date(e.enrolled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              );
            })}
            {enrollments.length === 0 && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.3)", fontSize: "0.8rem", textAlign: "center" as const, padding: "2rem" }}>No enrollments yet</p>}
          </div>
        )}

        <div style={{ marginTop: "2rem", textAlign: "center" as const, padding: "0.75rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 8 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.7)", margin: 0 }}>DRU AI Consulting · From Confusion to Confident with AI™ · Course Admin © 2026</p>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
          © 2026 DRU AI Consulting · All Rights Reserved
        </footer>
      </main>
    </AdminLayout>
  );
}
