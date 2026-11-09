import { useCallback, useEffect, useState } from "react";
import { callApi } from "../../lib/adminApi";
import WriterPicker from "./WriterPicker";
import { NAVY, btn, card, h2, input, label, small, fmtTime, type SceneRow, type StepProps } from "./ui";

// Step 3 — Script. Film settings, a writer turns the chosen story into scene cards, DeAnna edits and approves.
// Suggestions only: the shape and style boxes also accept anything typed.
const SHAPES = ["Vertical 9:16 (phones)", "Square 1:1", "Wide 16:9"];
const STYLES = [
  "Pixar-style 3D animation", "Cinematic, natural light", "Photorealistic", "Documentary handheld", "Film noir black and white",
  "1970s film grain", "Wes Anderson symmetrical pastel", "DreamWorks-style 3D animation", "Claymation", "Stop-motion",
  "Felt and fabric stop-motion", "Crochet and knitted yarn", "Puppet show", "Muppet-style puppets", "Paper cutout",
  "Origami papercraft", "LEGO-style bricks", "Anime", "Studio Ghibli-style anime", "Cel-shaded cartoon", "South Park-style cutout cartoon",
];
const OTHER = "__other";
const SCENE_LIMITS = { short: "4–8 seconds each", long: "10–30 seconds each" };

interface Version { id: string; label: string; created_at: string; scene_count: number }

const FIELDS: { key: keyof SceneRow; text: string; rows: number }[] = [
  { key: "setting", text: "Setting", rows: 2 },
  { key: "characters", text: "Characters", rows: 2 },
  { key: "what_we_see", text: "What we see", rows: 3 },
  { key: "emotional_beat", text: "Emotional beat", rows: 2 },
  { key: "dialogue", text: "Dialogue", rows: 3 },
  { key: "product_appearance", text: "Product appearance", rows: 2 },
  { key: "camera", text: "Camera", rows: 2 },
  { key: "image_prompt", text: "Picture prompt (for the Cast and Storyboard steps)", rows: 3 },
];

function SceneCard({ scene, index, count, locked, soundLabel, onSave, onAction }: {
  scene: SceneRow; index: number; count: number; locked: boolean; soundLabel: string;
  onSave: (id: string, fields: Record<string, unknown>) => Promise<boolean>;
  onAction: (action: string, scene: SceneRow, extra?: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = { start_s: String(scene.start_s ?? ""), end_s: String(scene.end_s ?? "") };
    for (const f of FIELDS) d[f.key] = String((scene[f.key] as string | null) ?? "");
    return d;
  });
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function blurSave(key: string, original: unknown) {
    if (String(original ?? "") === draft[key]) return;
    const ok = await onSave(scene.id, { [key]: draft[key] });
    setState(ok ? "saved" : "error");
  }

  return (
    <article style={{ ...card, marginBottom: "0.9rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <strong style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1rem" }}>Scene {index + 1}</strong>
        <span style={small}>{fmtTime(Number(scene.start_s) || 0)} – {fmtTime(Number(scene.end_s) || 0)}</span>
        <span aria-live="polite" style={{ ...small, color: state === "error" ? "#B3261E" : "#1B6E3C" }}>{state === "saved" ? "✓ Saved" : state === "error" ? "Not saved" : ""}</span>
        <span style={{ flex: 1 }} />
        {!locked && (
          confirmDelete ? (
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ ...small, color: "#B3261E" }}>Delete this scene?</span>
              <button style={{ ...btn(true), background: "#B3261E", color: "#fff", padding: "0.35rem 0.8rem" }} onClick={() => onAction("delete_scene", scene)}>Delete</button>
              <button style={{ ...btn(false), padding: "0.35rem 0.8rem" }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            </span>
          ) : (
            <span style={{ display: "flex", gap: 4 }}>
              <button style={{ ...btn(false, index === 0), padding: "0.35rem 0.7rem" }} disabled={index === 0} aria-label={`Move scene ${index + 1} up`} onClick={() => onAction("move_scene", scene, { direction: "up" })}>↑</button>
              <button style={{ ...btn(false, index === count - 1), padding: "0.35rem 0.7rem" }} disabled={index === count - 1} aria-label={`Move scene ${index + 1} down`} onClick={() => onAction("move_scene", scene, { direction: "down" })}>↓</button>
              <button style={{ ...btn(false), padding: "0.35rem 0.7rem" }} onClick={() => onAction("duplicate_scene", scene)}>Duplicate</button>
              <button style={{ ...btn(false), padding: "0.35rem 0.7rem" }} onClick={() => setConfirmDelete(true)}>Delete</button>
            </span>
          )
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: "0.7rem" }}>
        {(["start_s", "end_s"] as const).map(k => (
          <div key={k} style={{ width: 120 }}>
            <label htmlFor={`${scene.id}-${k}`} style={label}>{k === "start_s" ? "Start (seconds)" : "End (seconds)"}</label>
            <input id={`${scene.id}-${k}`} type="number" min={0} step="0.5" disabled={locked} value={draft[k]} style={input}
              onChange={e => setDraft({ ...draft, [k]: e.target.value })} onBlur={() => blurSave(k, scene[k])} />
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.7rem" }}>
        {FIELDS.map(f => (
          <div key={f.key} style={f.key === "image_prompt" || f.key === "what_we_see" ? { gridColumn: "1 / -1" } : undefined}>
            <label htmlFor={`${scene.id}-${f.key}`} style={label}>{f.key === "dialogue" ? soundLabel : f.text}</label>
            <textarea id={`${scene.id}-${f.key}`} rows={f.rows} disabled={locked} value={draft[f.key]} style={{ ...input, resize: "vertical" }}
              onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} onBlur={() => blurSave(f.key, scene[f.key])} />
          </div>
        ))}
      </div>
    </article>
  );
}

export default function ScriptStep({ projectId, settings, stepsDone, onChanged }: StepProps) {
  const film = settings?.film || {};
  const chosen = settings?.story?.chosen;
  const approved = stepsDone.includes("script");

  const initialLen = Number(film.length_s) || 60;
  const [lenUnit, setLenUnit] = useState<"seconds" | "minutes">(initialLen >= 60 && initialLen % 60 === 0 ? "minutes" : "seconds");
  const [lenValue, setLenValue] = useState<string>(String(initialLen >= 60 && initialLen % 60 === 0 ? initialLen / 60 : initialLen));
  const [mode, setMode] = useState<string>(film.scene_mode || "");
  const [shape, setShape] = useState<string>(film.shape || "");
  const [style, setStyle] = useState<string>(film.style || "");
  const [styleOther, setStyleOther] = useState<boolean>(!!film.style && !STYLES.includes(film.style));
  const [sound, setSound] = useState<string>(film.sound || "");
  const [writer, setWriter] = useState("");

  const [scenes, setScenes] = useState<SceneRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmRewrite, setConfirmRewrite] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);

  const totalSeconds = Math.round((Number(lenValue) || 0) * (lenUnit === "minutes" ? 60 : 1));
  const settingsReady = totalSeconds >= 20 && totalSeconds <= 3600 && !!mode && !!sound;
  const minScene = mode === "short" ? 4 : 10;
  const lastEnd = scenes.length ? Number(scenes[scenes.length - 1].end_s) || 0 : 0;
  const partial = scenes.length > 0 && !approved && totalSeconds - lastEnd >= minScene;
  const soundLabel = sound === "narration" ? "Narration" : sound === "song" ? "Lyrics" : "Dialogue";

  const loadScenes = useCallback(async () => {
    const r = await callApi(`/api/hub-studio?view=scenes&id=${projectId}`);
    if (r.ok) setScenes(r.body.scenes as SceneRow[]);
    else setMsg({ kind: "error", text: r.body?.error || `The scenes could not be loaded (${r.status}).` });
    setLoaded(true);
  }, [projectId]);

  const loadVersions = useCallback(async () => {
    const r = await callApi(`/api/hub-studio?view=versions&id=${projectId}`);
    if (r.ok) setVersions(r.body.versions as Version[]);
  }, [projectId]);

  useEffect(() => { loadScenes(); }, [loadScenes]);
  useEffect(() => { if (showVersions) loadVersions(); }, [showVersions, loadVersions]);

  // Shape and style save the moment they change (only that field is sent).
  async function savePart(film: { shape?: string; style?: string }) {
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "save_settings", id: projectId, patch: { film } } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `That setting could not be saved (${r.status}).` });
  }

  async function saveFilm(): Promise<boolean> {
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "save_settings", id: projectId, patch: { film: { length_s: totalSeconds, scene_mode: mode, shape, style, sound } } } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `The film settings could not be saved (${r.status}).` });
    return r.ok;
  }

  async function write(restart: boolean) {
    if (!writer) { setMsg({ kind: "error", text: "Choose a writer first." }); return; }
    setBusy(true);
    setMsg(null);
    setConfirmRewrite(false);
    if (!(await saveFilm())) { setBusy(false); return; }
    let first = true;
    for (let i = 0; i < 80; i++) {
      if (i === 0) setProgress("The writer is starting…");
      const r = await callApi("/api/hub-studio-writer", { method: "POST", body: { action: "script", project_id: projectId, writer, restart: restart && first } });
      first = false;
      if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The writer could not finish (${r.status}). Scenes written so far are kept; use Continue writing to pick up.` }); break; }
      setProgress(`${r.body.scene_count} scenes written · ${fmtTime(r.body.covered_s)} of ${fmtTime(totalSeconds)} covered`);
      if (r.body.done) { setMsg({ kind: "ok", text: "The script is written. Read it, edit anything, then approve it." }); break; }
    }
    setBusy(false);
    setProgress(null);
    await loadScenes();
    await onChanged();
    if (showVersions) loadVersions();
  }

  async function saveScene(id: string, fields: Record<string, unknown>): Promise<boolean> {
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "save_scene", scene_id: id, fields } });
    return r.ok;
  }

  async function sceneAction(action: string, scene: SceneRow, extra?: Record<string, unknown>) {
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action, scene_id: scene.id, ...(extra || {}) } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `That could not be done (${r.status}).` });
    await loadScenes();
  }

  async function insertAfter(position: number) {
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "add_scene", id: projectId, after_position: position } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `The scene could not be added (${r.status}).` });
    await loadScenes();
  }

  async function approve(on: boolean) {
    setBusy(true);
    setMsg(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: on ? "approve_script" : "unapprove_script", id: projectId } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `That could not be saved (${r.status}).` }); return; }
    setMsg({ kind: "ok", text: on ? "Script approved. The Cast step is next." : "Script reopened for editing." });
    await onChanged();
    if (showVersions) loadVersions();
  }

  async function restore(versionId: string) {
    setBusy(true);
    setConfirmRestore(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "restore_version", version_id: versionId } });
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The version could not be restored (${r.status}).` }); return; }
    setMsg({ kind: "ok", text: "Version restored." });
    await loadScenes();
    await onChanged();
    loadVersions();
  }

  if (!chosen?.title) {
    return (
      <div style={card}>
        <h2 style={h2}>Script</h2>
        <p style={small}>Choose a story on the Story step first. The writer turns the chosen story into scenes.</p>
      </div>
    );
  }

  const radio = (name: string, value: string, current: string, set: (v: string) => void, text: string, hint?: string) => (
    <label key={value} style={{ display: "flex", gap: 6, alignItems: "baseline", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: NAVY, marginRight: 16 }}>
      <input type="radio" name={name} value={value} checked={current === value} disabled={approved || busy} onChange={() => set(value)} />
      <span>{text}{hint ? <span style={{ ...small, display: "inline" }}> ({hint})</span> : null}</span>
    </label>
  );

  return (
    <div>
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Script</h2>
        <p style={{ ...small, marginBottom: "0.4rem" }}>Story: <strong>{chosen.title}</strong></p>
        {approved && <p style={{ ...small, color: "#1B6E3C", marginBottom: "0.8rem" }}>✓ Approved. Unapprove the script to change it.</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem", margin: "0.8rem 0" }}>
          <div>
            <label htmlFor="md-len" style={label}>Film length (20 seconds to 60 minutes)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input id="md-len" type="number" min={1} value={lenValue} disabled={approved || busy} onChange={e => setLenValue(e.target.value)} style={{ ...input, width: 100 }} />
              <select aria-label="Length unit" value={lenUnit} disabled={approved || busy} onChange={e => setLenUnit(e.target.value as "seconds" | "minutes")} style={{ ...input, width: 120 }}>
                <option value="seconds">seconds</option>
                <option value="minutes">minutes</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="md-shape" style={label}>Shape</label>
            <select id="md-shape" value={shape} disabled={approved || busy} onChange={e => { setShape(e.target.value); savePart({ shape: e.target.value }); }} style={input}>
              <option value="">Choose a shape…</option>
              {shape && !SHAPES.includes(shape) && <option value={shape}>{shape}</option>}
              {SHAPES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="md-style" style={label}>Visual style</label>
            <select id="md-style" value={styleOther ? OTHER : style} disabled={approved || busy} onChange={e => {
              if (e.target.value === OTHER) { setStyleOther(true); return; }
              setStyleOther(false); setStyle(e.target.value); savePart({ style: e.target.value });
            }} style={input}>
              <option value="">Choose a visual style…</option>
              {STYLES.map(o => <option key={o} value={o}>{o === "Pixar-style 3D animation" ? `${o} — most popular` : o}</option>)}
              <option value={OTHER}>Other (type your own)</option>
            </select>
            {styleOther && (
              <input aria-label="Your own visual style" value={style} disabled={approved || busy} onChange={e => setStyle(e.target.value)} onBlur={() => savePart({ style })} style={{ ...input, marginTop: 6 }} placeholder="Describe the look you want" />
            )}
          </div>
        </div>
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.8rem" }}>
          <legend style={label}>Scene length</legend>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {radio("md-mode", "short", mode, setMode, "Short takes", SCENE_LIMITS.short)}
            {radio("md-mode", "long", mode, setMode, "Long takes", SCENE_LIMITS.long)}
          </div>
        </fieldset>
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 1rem" }}>
          <legend style={label}>Sound</legend>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {radio("md-sound", "dialogue", sound, setSound, "Dialogue")}
            {radio("md-sound", "narration", sound, setSound, "Narration")}
            {radio("md-sound", "song", sound, setSound, "Song")}
          </div>
        </fieldset>

        {!approved && (
          <>
            <div style={{ maxWidth: 420, marginBottom: "0.9rem" }}>
              <WriterPicker id="md-script-writer" value={writer} onChange={setWriter} disabled={busy} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {scenes.length === 0 ? (
                <button style={btn(true, busy || !writer || !settingsReady)} disabled={busy || !writer || !settingsReady} onClick={() => write(false)}>{busy ? "Writing…" : "Write the script"}</button>
              ) : confirmRewrite ? (
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ ...small, color: "#B3261E" }}>Replace all {scenes.length} scenes? The current script is saved in version history.</span>
                  <button style={{ ...btn(true), background: "#B3261E", color: "#fff" }} onClick={() => write(true)}>Rewrite</button>
                  <button style={btn(false)} onClick={() => setConfirmRewrite(false)}>Cancel</button>
                </span>
              ) : (
                <>
                  {partial && <button style={btn(true, busy || !writer || !settingsReady)} disabled={busy || !writer || !settingsReady} onClick={() => write(false)}>{busy ? "Writing…" : "Continue writing"}</button>}
                  <button style={btn(!partial, busy || !writer || !settingsReady)} disabled={busy || !writer || !settingsReady} onClick={() => setConfirmRewrite(true)}>Rewrite the script</button>
                </>
              )}
              {!settingsReady && <span style={small}>Set the length, scene length and sound to continue.</span>}
              {progress && <span role="status" style={small}>{progress}</span>}
            </div>
          </>
        )}
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginTop: 10, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}
      </div>

      {loaded && scenes.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <h2 style={{ ...h2, margin: 0 }}>{scenes.length} {scenes.length === 1 ? "scene" : "scenes"} · {fmtTime(lastEnd)}</h2>
            <span style={{ flex: 1 }} />
            <button style={btn(false)} onClick={() => setShowVersions(v => !v)}>{showVersions ? "Hide version history" : "Version history"}</button>
            {approved ? (
              <button style={btn(false, busy)} disabled={busy} onClick={() => approve(false)}>Unapprove</button>
            ) : (
              <button style={btn(true, busy || partial)} disabled={busy || partial} title={partial ? "Finish writing the script first" : undefined} onClick={() => approve(true)}>Approve script</button>
            )}
          </div>

          {showVersions && (
            <div style={{ ...card, marginBottom: "1rem" }}>
              <h2 style={h2}>Version history</h2>
              {!versions ? <p style={small}>Loading…</p> : versions.length === 0 ? <p style={small}>No versions yet. One is saved each time a script is written or approved.</p> : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {versions.map((v, i) => (
                    <li key={v.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "0.5rem 0", borderTop: i === 0 ? "none" : "1px solid rgba(10,35,66,0.08)" }}>
                      <span style={{ flex: "1 1 220px", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: NAVY }}>{v.label} <span style={small}>· {v.scene_count} scenes · {new Date(v.created_at).toLocaleString("en-US", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></span>
                      {approved ? null : confirmRestore === v.id ? (
                        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ ...small, color: "#B3261E" }}>Replace the current scenes?</span>
                          <button style={{ ...btn(true), background: "#B3261E", color: "#fff", padding: "0.35rem 0.8rem" }} onClick={() => restore(v.id)}>Restore</button>
                          <button style={{ ...btn(false), padding: "0.35rem 0.8rem" }} onClick={() => setConfirmRestore(null)}>Cancel</button>
                        </span>
                      ) : (
                        <button style={{ ...btn(false, busy), padding: "0.35rem 0.8rem" }} disabled={busy} onClick={() => setConfirmRestore(v.id)}>Restore this version</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {approved && <p style={{ ...small, marginTop: 6 }}>Unapprove the script to restore a version.</p>}
            </div>
          )}

          {scenes.map((s, i) => (
            <div key={s.id}>
              <SceneCard scene={s} index={i} count={scenes.length} locked={approved || busy} soundLabel={soundLabel} onSave={saveScene} onAction={sceneAction} />
              {!approved && <button style={{ ...btn(false, busy), marginBottom: "0.9rem", padding: "0.35rem 0.9rem" }} disabled={busy} onClick={() => insertAfter(s.position)}>+ Insert a scene below</button>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
