import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import { callApi } from "../lib/adminApi";
import ProductStep from "../components/micro-drama/ProductStep";
import StoryStep from "../components/micro-drama/StoryStep";
import ScriptStep from "../components/micro-drama/ScriptStep";
import CastStep from "../components/micro-drama/CastStep";
import AudioStep from "../components/micro-drama/AudioStep";
import StoryboardStep from "../components/micro-drama/StoryboardStep";
import VideoStep from "../components/micro-drama/VideoStep";
import FinishStep from "../components/micro-drama/FinishStep";

// ─── Micro Drama Studio — Stages 1 to 4 ─────────────────────────────────────────────
// Projects tab (create, resume, list), the project page with its 8-step bar, and the Usage tab.
// The eight steps are built one stage at a time. Product, Story, Script, Cast, Audio and Storyboard are live; the rest show "built in a later stage".
// All costs are estimates: providers do not report the real billed cost of each request.

const NAVY = "#0A2342";
const GOLD = "#D4AF37";

const STEPS: { id: string; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "story", label: "Story" },
  { id: "script", label: "Script" },
  { id: "cast", label: "Cast" },
  { id: "audio", label: "Audio" },
  { id: "storyboard", label: "Storyboard" },
  { id: "video", label: "Video" },
  { id: "finish", label: "Finish" },
];
const STEP_LABEL: Record<string, string> = Object.fromEntries(STEPS.map(s => [s.id, s.label]));

interface Project {
  id: string;
  title: string;
  product_name: string | null;
  current_step: string;
  steps_done: string[];
  created_at: string;
  updated_at: string;
  est_cost_usd: number;
  settings?: any;
}

interface ProviderUsage {
  id: string;
  label: string;
  actions: number;
  est_cost_usd: number;
  unpriced: number;
  balance: string | null;
}

interface ActivityRow {
  id: string;
  provider: string;
  action: string;
  detail: string | null;
  units_label: string | null;
  est_cost_usd: number | null;
  status: string;
  created_at: string;
  micro_drama_projects: { title: string } | null;
}

interface Usage {
  month_start: string;
  providers: ProviderUsage[];
  recent: ActivityRow[];
  storage: { shelf_files: number; shelf_bytes: number; studio_pictures?: number };
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI", elevenlabs: "ElevenLabs", higgsfield: "Higgsfield", heygen: "HeyGen", claude: "Claude",
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatBytes(n: number): string {
  if (!n) return "0 MB";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
}

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminMicroDramaStudio() {
  const [tab, setTab] = useState<"projects" | "usage">("projects");

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [open, setOpen] = useState<Project | null>(null);
  const [activeStep, setActiveStep] = useState("product");
  const [titleDraft, setTitleDraft] = useState("");
  const [titleState, setTitleState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    const r = await callApi("/api/hub-studio?view=projects");
    if (r.ok) {
      setProjects(r.body.projects || []);
      setLoadError(null);
    } else {
      setLoadError(r.body?.error || `Projects could not be loaded (${r.status}).`);
    }
    setLoading(false);
  }, []);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    const r = await callApi("/api/hub-studio?view=usage");
    if (r.ok) {
      setUsage(r.body as Usage);
      setUsageError(null);
    } else {
      setUsageError(r.body?.error || `Usage could not be loaded (${r.status}).`);
    }
    setUsageLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (tab === "usage") loadUsage(); }, [tab, loadUsage]);

  // A project link (?project=…) reopens that project after a refresh.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("project");
    if (!id) return;
    (async () => {
      const r = await callApi(`/api/hub-studio?view=project&id=${encodeURIComponent(id)}`);
      if (r.ok) openProject(r.body.project as Project);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-reads the open project (settings, steps done, cost so far) after a step saves something.
  const refreshOpen = useCallback(async (id: string) => {
    const r = await callApi(`/api/hub-studio?view=project&id=${encodeURIComponent(id)}`);
    if (r.ok) setOpen(prev => (prev && prev.id === id ? { ...prev, ...(r.body.project as Project) } : prev));
  }, []);

  function openProject(p: Project) {
    refreshOpen(p.id);
    setOpen(p);
    setActiveStep(p.current_step || "product");
    setTitleDraft(p.title);
    setTitleState("idle");
    setMessage(null);
    window.history.replaceState(null, "", `/admin-micro-drama?project=${p.id}`);
  }

  function closeProject() {
    setOpen(null);
    window.history.replaceState(null, "", "/admin-micro-drama");
    loadProjects();
  }

  async function createProject() {
    setCreating(true);
    setMessage(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "create" } });
    setCreating(false);
    if (!r.ok) {
      setMessage({ kind: "error", text: r.body?.error || `The project could not be created (${r.status}).` });
      return;
    }
    openProject(r.body.project as Project);
    loadProjects();
  }

  async function saveTitle() {
    if (!open) return;
    const next = titleDraft.trim();
    if (!next) { setTitleDraft(open.title); return; }
    if (next === open.title) return;
    setTitleState("saving");
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "rename", id: open.id, title: next } });
    if (r.ok) {
      setOpen({ ...open, title: next });
      setTitleState("saved");
    } else {
      setTitleState("error");
      setMessage({ kind: "error", text: r.body?.error || `The title could not be saved (${r.status}).` });
    }
  }

  async function deleteProject(id: string) {
    setMessage(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "delete", id } });
    setConfirmDelete(null);
    if (!r.ok) {
      setMessage({ kind: "error", text: r.body?.error || `The project could not be deleted (${r.status}).` });
      return;
    }
    setMessage({ kind: "ok", text: "Project deleted. Its spending history stays in the Usage tab." });
    loadProjects();
  }

  // ── Styles (match the Video Hub) ──
  const card: React.CSSProperties = { background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "1.25rem" };
  const h2: React.CSSProperties = { fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.1rem", margin: "0 0 0.4rem" };
  const small: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.6)", margin: 0 };
  const btn = (primary = true, disabled = false): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
    padding: "0.55rem 1.1rem", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
    border: primary ? "none" : `1px solid ${NAVY}`, background: primary ? NAVY : "transparent", color: primary ? GOLD : NAVY,
  });
  const tabBtn = (active: boolean): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em",
    padding: "0.6rem 1.2rem", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${active ? NAVY : "rgba(10,35,66,0.25)"}`, background: active ? NAVY : "transparent", color: active ? GOLD : NAVY,
  });
  const iconBtn: React.CSSProperties = {
    background: "transparent", border: "none", cursor: "pointer", fontSize: "1rem", padding: "0.3rem 0.45rem", borderRadius: 6, color: NAVY,
  };

  const shown = showAll ? projects : projects.slice(0, 5);
  const latest = projects[0] || null;

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "1.25rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.2rem" }}>Micro Drama Studio</h1>
          <p style={{ color: "rgba(10,35,66,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", margin: 0 }}>
            Plan, cast and make micro dramas step by step. Finished films are exported to Video Que in the Video Hub.
          </p>
        </div>

        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: "1.25rem" }}>
          <button role="tab" aria-selected={tab === "projects"} style={tabBtn(tab === "projects")} onClick={() => setTab("projects")}>Projects</button>
          <button role="tab" aria-selected={tab === "usage"} style={tabBtn(tab === "usage")} onClick={() => setTab("usage")}>Usage</button>
        </div>

        {message && (
          <p role="status" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", margin: "0 0 1rem", color: message.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{message.text}</p>
        )}

        {/* ── A project ── */}
        {open && tab === "projects" && (
          <section>
            <button style={{ ...btn(false), marginBottom: "1rem" }} onClick={closeProject}>← Projects</button>

            <div style={{ ...card, marginBottom: "1rem" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <label htmlFor="md-title" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(10,35,66,0.6)", display: "block", marginBottom: 4 }}>
                    Project title
                  </label>
                  <input
                    id="md-title" value={titleDraft}
                    onChange={e => { setTitleDraft(e.target.value); setTitleState("idle"); }}
                    onBlur={saveTitle}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.3rem", fontWeight: 700, color: NAVY, width: "100%", boxSizing: "border-box", padding: "0.45rem 0.65rem", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 8, background: "#FFFFFF" }}
                  />
                </div>
                <span aria-live="polite" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: titleState === "error" ? "#B3261E" : "rgba(10,35,66,0.55)" }}>
                  {titleState === "saving" ? "Saving…" : titleState === "saved" ? "✓ Saved" : titleState === "error" ? "Not saved" : ""}
                </span>
                <span title="Estimated spend on this project so far. Providers do not report the real billed cost."
                  style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: NAVY, background: "rgba(212,175,55,0.18)", border: "1px solid rgba(212,175,55,0.5)", borderRadius: 999, padding: "0.4rem 0.9rem" }}>
                  Est. {money(open.est_cost_usd)} so far
                </span>
              </div>
            </div>

            <div role="tablist" aria-label="Project steps" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1rem" }}>
              {STEPS.map((s, i) => {
                const done = open.steps_done.includes(s.id);
                const active = activeStep === s.id;
                return (
                  <button key={s.id} role="tab" aria-selected={active} onClick={() => setActiveStep(s.id)} style={{
                    fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em",
                    padding: "0.5rem 1rem", borderRadius: 999, cursor: "pointer",
                    border: `1px solid ${active ? NAVY : "rgba(10,35,66,0.25)"}`, background: active ? NAVY : "#FFFFFF", color: active ? GOLD : NAVY,
                  }}>
                    {done ? "✓ " : `${i + 1} `}{s.label}
                  </button>
                );
              })}
            </div>

            {!open.settings ? (
              <p style={small}>Loading the project…</p>
            ) : activeStep === "product" ? (
              <ProductStep key={`${open.id}-product`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} />
            ) : activeStep === "story" ? (
              <StoryStep key={`${open.id}-story`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} />
            ) : activeStep === "script" ? (
              <ScriptStep key={`${open.id}-script`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} />
            ) : activeStep === "cast" ? (
              <CastStep key={`${open.id}-cast`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} onGoto={setActiveStep} />
            ) : activeStep === "audio" ? (
              <AudioStep key={`${open.id}-audio`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} onGoto={setActiveStep} />
            ) : activeStep === "storyboard" ? (
              <StoryboardStep key={`${open.id}-storyboard`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} />
            ) : activeStep === "video" ? (
              <VideoStep key={`${open.id}-video`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} onGoto={setActiveStep} />
            ) : activeStep === "finish" ? (
              <FinishStep key={`${open.id}-finish`} projectId={open.id} settings={open.settings} stepsDone={open.steps_done} onChanged={() => refreshOpen(open.id)} onGoto={setActiveStep} />
            ) : (
              <div style={card}>
                <h2 style={h2}>{STEP_LABEL[activeStep]}</h2>
                <p style={small}>This step is built in a later stage. Nothing to do here yet. Your project and its title are saved.</p>
              </div>
            )}
          </section>
        )}

        {/* ── Projects tab ── */}
        {!open && tab === "projects" && (
          <section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              <button onClick={createProject} disabled={creating} style={{
                textAlign: "left", cursor: creating ? "wait" : "pointer", border: "none", borderRadius: 12, padding: "1.25rem",
                background: `linear-gradient(135deg, ${NAVY}, #16396B)`, color: GOLD,
              }}>
                <span style={{ display: "block", fontSize: "1.4rem", lineHeight: 1 }}>+</span>
                <span style={{ display: "block", fontFamily: "'Playfair Display', serif", fontSize: "1.15rem", fontWeight: 700, marginTop: 6 }}>
                  {creating ? "Creating…" : "Create a project"}
                </span>
                <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.75)", marginTop: 2 }}>Start with your product; ideas come next.</span>
              </button>
              <button onClick={() => latest && openProject(latest)} disabled={!latest} style={{
                textAlign: "left", cursor: latest ? "pointer" : "not-allowed", opacity: latest ? 1 : 0.6, borderRadius: 12, padding: "1.25rem",
                border: "1px solid rgba(212,175,55,0.4)", background: "#FAFAF8", color: NAVY,
              }}>
                <span style={{ display: "block", fontSize: "1.4rem", lineHeight: 1 }}>→</span>
                <span style={{ display: "block", fontFamily: "'Playfair Display', serif", fontSize: "1.15rem", fontWeight: 700, marginTop: 6 }}>Resume project</span>
                <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.6)", marginTop: 2 }}>
                  {latest ? `${latest.title} · ${STEP_LABEL[latest.current_step] || latest.current_step}` : "No projects yet."}
                </span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.6rem" }}>
              <h2 style={{ ...h2, margin: 0 }}>Recent projects</h2>
              {projects.length > 5 && (
                <button onClick={() => setShowAll(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#B33A1E", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", fontWeight: 600 }}>
                  {showAll ? "Show fewer" : `See all (${projects.length})`}
                </button>
              )}
            </div>

            {loading ? (
              <p style={small}>Loading projects…</p>
            ) : loadError ? (
              <p role="alert" style={{ ...small, color: "#B3261E" }}>{loadError}</p>
            ) : projects.length === 0 ? (
              <p style={small}>No projects yet. Create your first one above.</p>
            ) : (
              <ul style={{ ...card, listStyle: "none", margin: 0, padding: 0 }}>
                {shown.map((p, i) => (
                  <li key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0.85rem 1.1rem", borderTop: i === 0 ? "none" : "1px solid rgba(10,35,66,0.08)", flexWrap: "wrap" }}>
                    <button onClick={() => openProject(p)} style={{ flex: "1 1 240px", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: NAVY }}>{p.title}</span>
                      <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)" }}>
                        {p.product_name || "No product yet"} · {STEP_LABEL[p.current_step] || p.current_step}
                      </span>
                    </button>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)" }}>{money(p.est_cost_usd)} est.</span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)" }}>{shortDate(p.updated_at)}</span>
                    {confirmDelete === p.id ? (
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "#B3261E" }}>Delete this project?</span>
                        <button style={{ ...btn(true), background: "#B3261E", color: "#fff", padding: "0.4rem 0.8rem" }} onClick={() => deleteProject(p.id)}>Delete</button>
                        <button style={{ ...btn(false), padding: "0.4rem 0.8rem" }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </span>
                    ) : (
                      <span style={{ display: "flex", gap: 2 }}>
                        <button style={iconBtn} aria-label={`Open ${p.title}`} title="Open" onClick={() => openProject(p)}>✎</button>
                        <button style={iconBtn} aria-label={`Delete ${p.title}`} title="Delete" onClick={() => setConfirmDelete(p.id)}>🗑</button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ── Usage tab ── */}
        {tab === "usage" && (
          <section>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <h2 style={{ ...h2, margin: 0 }}>
                {usage ? new Date(usage.month_start).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : "This month"}
              </h2>
              <button style={btn(false, usageLoading)} disabled={usageLoading} onClick={loadUsage}>{usageLoading ? "Refreshing…" : "Refresh"}</button>
            </div>
            <p style={{ ...small, marginBottom: "1rem" }}>
              Costs are estimates: providers do not report the real billed cost of each request. A balance shows only where the provider reports one.
            </p>

            {usageError && <p role="alert" style={{ ...small, color: "#B3261E", marginBottom: "1rem" }}>{usageError}</p>}
            {!usage && !usageError && <p style={small}>Loading usage…</p>}

            {usage && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  {usage.providers.map(p => (
                    <div key={p.id} style={card}>
                      <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(10,35,66,0.6)", margin: "0 0 0.3rem" }}>{p.label}</p>
                      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700, color: NAVY, margin: 0 }}>
                        {p.est_cost_usd > 0 || p.unpriced === 0 ? money(p.est_cost_usd) : "—"}
                      </p>
                      <p style={{ ...small, marginTop: 4 }}>
                        {p.actions} {p.actions === 1 ? "action" : "actions"} this month
                        {p.unpriced > 0 ? ` · ${p.unpriced} with no cost estimate yet` : ""}
                      </p>
                      <p style={{ ...small, marginTop: 4, color: p.balance ? "#1B6E3C" : "rgba(10,35,66,0.5)" }}>
                        {p.balance ? `Balance: ${p.balance}` : "Balance: not shown here. Check it on the provider's site."}
                      </p>
                    </div>
                  ))}
                </div>

                <h2 style={{ ...h2, marginBottom: "0.6rem" }}>Recent activity</h2>
                {usage.recent.length === 0 ? (
                  <p style={{ ...small, marginBottom: "1.5rem" }}>Nothing yet. Voice readings and videos made in Travis's Videos, and everything made in the studio, show up here.</p>
                ) : (
                  <ul style={{ ...card, listStyle: "none", margin: "0 0 1.5rem", padding: 0 }}>
                    {usage.recent.map((a, i) => (
                      <li key={a.id} style={{ display: "flex", gap: 12, alignItems: "baseline", justifyContent: "space-between", padding: "0.75rem 1.1rem", borderTop: i === 0 ? "none" : "1px solid rgba(10,35,66,0.08)", flexWrap: "wrap" }}>
                        <span style={{ flex: "1 1 280px" }}>
                          <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", fontWeight: 600, color: a.status === "failed" ? "#B3261E" : NAVY }}>
                            {PROVIDER_LABEL[a.provider] || a.provider} · {a.action}{a.status === "failed" ? " (failed)" : ""}
                          </span>
                          <span style={{ display: "block", fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)" }}>
                            {[a.micro_drama_projects?.title, a.detail, a.units_label].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)", whiteSpace: "nowrap" }}>
                          {a.est_cost_usd !== null && a.est_cost_usd !== undefined ? `${money(Number(a.est_cost_usd))} est. · ` : ""}{stamp(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div style={card}>
                  <h2 style={h2}>Storage</h2>
                  <p style={small}>
                    Video Que: {usage.storage.shelf_files} {usage.storage.shelf_files === 1 ? "file" : "files"} · {formatBytes(usage.storage.shelf_bytes)}.
                    Studio pictures: {usage.storage.studio_pictures ?? 0} saved (cast and storyboard). Clips and audio are added here once those steps are built.
                  </p>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </AdminLayout>
  );
}
