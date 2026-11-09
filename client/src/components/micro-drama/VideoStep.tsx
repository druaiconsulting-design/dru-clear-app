import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { btn, card, h2, input, label, small, type StepProps } from "./ui";

// Step 7 — Video. One short clip per scene, made by Higgsfield (Seedance 2.5) from the scene's approved Storyboard frame.
// Making a clip uses Higgsfield API funds. Playing a finished clip is free.
interface Scene {
  id: string; position: number; scene_seconds: number; frame_key: string | null; clip_key: string | null; frame_url: string | null; frame_approved: boolean;
  prompt: string; length: number; resolution: string; status: string; error: string | null;
  clip_url: string | null; source: string | null; cost_usd: number | null; approved: boolean; needs_review: boolean; estimate_usd: number;
}

const API = "/api/hub-studio-video";
// Measured on the real Higgsfield bill: a 6-second 720p clip with sound off cost $2.36.
const FROM_USD_PER_SECOND = 2.36 / 6;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const money = (n: number | null) => (n === null ? "" : `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`);
const pending = (s: Scene) => s.status === "queued" || s.status === "in_progress";

function fileToVideoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(file);
  });
}

export default function VideoStep({ projectId, stepsDone, onChanged, onGoto }: StepProps) {
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [keyError, setKeyError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const checking = useRef(false);
  const uploadFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Each reload hands out fresh temporary links. Keeping the first link for a given picture or clip stops the players restarting.
  const urlCache = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=video&id=${projectId}`);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The video step could not be loaded (${r.status}).` }); return; }
    const serverSteps = (r.body.steps_done as string[]) || [];
    if (serverSteps.length !== stepsDone.length || serverSteps.some(x => !stepsDone.includes(x))) onChanged();
    setKeyError((r.body.key_error as string | null) || "");
    const stable = (r.body.scenes as Scene[]).map(sc => {
      const keep = (kind: string, key: string | null, url: string | null) => {
        if (!key || !url) return url;
        const id = `${sc.id}:${kind}:${key}`;
        if (!urlCache.current[id]) urlCache.current[id] = url;
        return urlCache.current[id];
      };
      return { ...sc, frame_url: keep("frame", sc.frame_key, sc.frame_url), clip_url: keep("clip", sc.clip_key, sc.clip_url) };
    });
    setScenes(stable);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function post(body: Record<string, unknown>, errorText: string) {
    const r = await callApi(API, { method: "POST", body });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `${errorText} (${r.status}).` });
    return r;
  }
  async function refresh() { await load(); await onChanged(); }

  // While any clip is being made, ask Higgsfield how it is doing every few seconds.
  const anyPending = !!scenes?.some(pending);
  const checkPending = useCallback(async (list: Scene[]) => {
    if (checking.current) return;
    checking.current = true;
    try {
      let finished = false;
      for (const s of list.filter(pending)) {
        const r = await callApi(API, { method: "POST", body: { action: "check_clip", scene_id: s.id } });
        if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `A clip could not be checked (${r.status}).` }); continue; }
        if (r.body.status === "completed") { finished = true; setMsg({ kind: "ok", text: `Scene ${s.position}'s clip is ready. Play it, then approve it.` }); }
        if (r.body.status === "failed") { finished = true; setMsg({ kind: "error", text: r.body.error || `Scene ${s.position}'s clip could not be made.` }); }
      }
      await load();
      if (finished) await onChanged();
    } finally { checking.current = false; }
  }, [load, onChanged]);

  useEffect(() => {
    if (!anyPending || !scenes) return;
    const t = setInterval(() => { checkPending(scenes); }, 6000);
    return () => clearInterval(t);
  }, [anyPending, scenes, checkPending]);

  function edit(id: string, patch: Partial<Scene>) {
    setScenes(list => (list || []).map(s => (s.id === id ? { ...s, ...patch } : s)));
  }
  async function saveSettings(s: Scene) {
    await post({ action: "save_clip_settings", scene_id: s.id, prompt: s.prompt, length: s.length, resolution: s.resolution }, "The settings could not be saved");
  }

  async function makeClip(s: Scene) {
    setBusy(s.id); setMsg(null);
    await saveSettings(s);
    const r = await post({ action: "make_clip", scene_id: s.id }, "The clip could not be started");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `Scene ${s.position}'s clip has started. It usually takes a few minutes. You can leave this page open, or come back and press Check.` });
    await load();
  }

  async function makeAll() {
    if (!scenes) return;
    setConfirmAll(false); setBusy("all"); setMsg(null);
    let started = 0;
    for (const s of scenes) {
      if (!s.frame_approved || !s.frame_url || pending(s) || s.clip_url) continue;
      await saveSettings(s);
      const r = await post({ action: "make_clip", scene_id: s.id }, `Scene ${s.position}'s clip could not be started`);
      if (!r.ok) break;
      started++;
    }
    setBusy(null);
    if (started) setMsg({ kind: "ok", text: `${started} clip${started === 1 ? "" : "s"} started. They usually take a few minutes each.` });
    await load();
  }

  async function sceneAction(s: Scene, action: "approve_clip" | "delete_clip" | "cancel_clip", approved?: boolean) {
    setBusy(s.id);
    await post({ action, scene_id: s.id, approved }, "That could not be saved");
    setBusy(null);
    await refresh();
  }

  async function checkNow(s: Scene) {
    setBusy(s.id); setMsg(null);
    await checkPending([s]);
    setBusy(null);
  }

  async function onPickFile(file: File | undefined) {
    const id = uploadFor.current;
    uploadFor.current = null;
    if (!file || !id) return;
    if (file.size > MAX_UPLOAD_BYTES) { setMsg({ kind: "error", text: "That clip is too large to upload here. Use one under 3 MB." }); return; }
    setBusy(id); setMsg(null);
    try {
      const dataUrl = await fileToVideoDataUrl(file);
      const r = await post({ action: "upload_clip", scene_id: id, data_url: dataUrl }, "The clip could not be uploaded");
      if (r.ok) setMsg({ kind: "ok", text: "Clip uploaded. Play it, then approve it." });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "That file could not be read." });
    }
    setBusy(null);
    await refresh();
    if (fileInput.current) fileInput.current.value = "";
  }

  const working = busy !== null;
  const approvedCount = scenes?.filter(s => s.approved).length ?? 0;
  const toMake = (scenes || []).filter(s => s.frame_approved && s.frame_url && !s.clip_url && !pending(s));
  const totalEstimate = toMake.reduce((n, s) => n + s.length * FROM_USD_PER_SECOND, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 360px" }}>
          <h2 style={{ ...h2, fontSize: "1.5rem" }}>Video</h2>
          <p style={small}>Each scene's approved Storyboard frame becomes the first picture of its clip. Make a clip for each scene, watch it, and approve it.</p>
        </div>
        <button style={btn(false)} onClick={() => onGoto?.("storyboard")}>← Storyboard</button>
      </div>

      <div style={{ ...card, marginBottom: "1rem", padding: "0.8rem 1.1rem" }}>
        <p style={small}>Playing a finished clip is free. Making a clip uses Higgsfield API funds, which are separate from your Higgsfield subscription. Your real Higgsfield bill for a 6-second clip at 720p with sound off was $2.36, about $0.39 per second, and the estimates here use that rate. Other resolutions have not been measured yet. Every clip is logged on the Usage tab. Clips are made without sound, because your Audio recordings are added later.</p>
        {stepsDone.includes("video") && <p style={{ ...small, color: "#1B6E3C", marginTop: 6 }}>✓ Video done. Every scene has an approved clip.</p>}
        {keyError && <p style={{ ...small, color: "#B3261E", marginTop: 6 }}>{keyError}</p>}
      </div>

      {msg && <p style={{ ...small, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E", marginBottom: "0.8rem" }}>{msg.text}</p>}

      <input ref={fileInput} type="file" accept="video/mp4,video/quicktime" style={{ display: "none" }} onChange={e => onPickFile(e.target.files?.[0])} />

      {scenes === null ? (
        <p style={small}>Loading…</p>
      ) : scenes.length === 0 ? (
        <div style={card}><p style={small}>There are no scenes yet. Write the script first.</p></div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: "1rem", padding: "0.8rem 1.1rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <p style={{ ...small, flex: "1 1 260px" }}>{approvedCount} of {scenes.length} clips approved.{toMake.length > 0 ? ` ${toMake.length} scene${toMake.length === 1 ? "" : "s"} still need a clip.` : ""}</p>
            {toMake.length > 0 && !confirmAll && !keyError && (
              <button style={btn(false, working)} disabled={working} onClick={() => setConfirmAll(true)}>Make all clips</button>
            )}
            {confirmAll && (
              <>
                <p style={{ ...small, color: "#0A2342" }}>This starts {toMake.length} clip{toMake.length === 1 ? "" : "s"} and costs about {money(totalEstimate)} in Higgsfield funds.</p>
                <button style={btn(true, working)} disabled={working} onClick={makeAll}>Yes, make them</button>
                <button style={btn(false)} onClick={() => setConfirmAll(false)}>Cancel</button>
              </>
            )}
          </div>

          <div style={{ display: "grid", gap: "1rem" }}>
            {scenes.map(s => {
              const isBusy = busy === s.id || busy === "all";
              const isPending = pending(s);
              const noFrame = !s.frame_url || !s.frame_approved;
              return (
                <div key={s.id} style={card}>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: "0 1 170px", minWidth: 130 }}>
                      <p style={{ ...small, marginBottom: 6 }}>Starting frame</p>
                      {s.frame_url ? (
                        <img src={s.frame_url} alt={`Scene ${s.position} frame`} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                      ) : (
                        <div style={{ ...small, padding: "2rem 0.8rem", textAlign: "center", border: "1px dashed rgba(10,35,66,0.3)", borderRadius: 8 }}>No frame yet</div>
                      )}
                    </div>

                    <div style={{ flex: "0 1 170px", minWidth: 130 }}>
                      <p style={{ ...small, marginBottom: 6 }}>{s.clip_url ? (s.source === "upload" ? "Your own clip" : "Clip · generated") : "Clip"}</p>
                      {s.clip_url ? (
                        <video key={s.clip_key || s.clip_url} src={s.clip_url} controls playsInline preload="metadata" style={{ width: "100%", borderRadius: 8, background: "#000", display: "block" }} />
                      ) : (
                        <div style={{ ...small, padding: "2rem 0.8rem", textAlign: "center", border: "1px dashed rgba(10,35,66,0.3)", borderRadius: 8 }}>{isPending ? "Being made…" : "No clip yet"}</div>
                      )}
                    </div>

                    <div style={{ flex: "1 1 320px", minWidth: 260 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                        <h2 style={{ ...h2, margin: 0 }}>Scene {s.position}</h2>
                        <span style={small}>scene length {s.scene_seconds} s</span>
                        {s.approved && <span style={{ ...small, color: "#1B6E3C", fontWeight: 700 }}>✓ Approved</span>}
                      </div>

                      {noFrame && <p style={{ ...small, color: "#B3261E", marginBottom: 6 }}>Approve this scene's frame on the Storyboard step first. The clip starts from that picture.</p>}
                      {s.needs_review && <p style={{ ...small, color: "#B3261E", marginBottom: 6 }}>The frame or the prompt changed after this clip was made. Watch it again, or make it again.</p>}
                      {isPending && <p style={{ ...small, color: "#0A2342", marginBottom: 6 }}>⏳ Higgsfield is making this clip ({s.status === "queued" ? "waiting in line" : "in progress"}). This page checks every few seconds.</p>}
                      {s.status === "failed" && s.error && <p style={{ ...small, color: "#B3261E", marginBottom: 6 }}>{s.error}</p>}

                      <label style={label}>What happens in the clip</label>
                      <textarea
                        style={{ ...input, minHeight: 84, resize: "vertical" }}
                        value={s.prompt}
                        disabled={isPending}
                        onChange={e => edit(s.id, { prompt: e.target.value })}
                        onBlur={() => saveSettings(s)}
                      />

                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                        <div style={{ width: 110 }}>
                          <label style={label}>Length (s)</label>
                          <input
                            style={input} type="number" min={4} max={30} value={s.length} disabled={isPending}
                            onChange={e => edit(s.id, { length: Number(e.target.value) })}
                            onBlur={() => { const v = Math.min(30, Math.max(4, Math.round(s.length) || 5)); const next = { ...s, length: v }; edit(s.id, { length: v, estimate_usd: Math.round(v * FROM_USD_PER_SECOND * 100) / 100 }); saveSettings(next); }}
                          />
                        </div>
                        <div style={{ width: 130 }}>
                          <label style={label}>Resolution</label>
                          <select style={input} value={s.resolution} disabled={isPending} onChange={e => { edit(s.id, { resolution: e.target.value }); saveSettings({ ...s, resolution: e.target.value }); }}>
                            <option value="480p">480p</option>
                            <option value="720p">720p</option>
                            <option value="1080p">1080p</option>
                          </select>
                        </div>
                        <div style={{ width: 110 }}>
                          <label style={label}>Sound</label>
                          <input style={{ ...input, background: "#F1F1EE" }} value="Off" disabled readOnly />
                        </div>
                      </div>

                      <p style={{ ...small, marginTop: 8 }}>
                        Estimate: about {money(Math.round(s.length * FROM_USD_PER_SECOND * 100) / 100)}{s.resolution === "720p" ? " (measured at 720p)." : " (measured at 720p; this resolution is not measured yet)."}
                        {s.cost_usd !== null ? ` This clip was logged at ${money(s.cost_usd)}.` : ""}
                      </p>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        {isPending ? (
                          <>
                            <button style={btn(true, isBusy)} disabled={isBusy} onClick={() => checkNow(s)}>Check</button>
                            <button style={btn(false, isBusy)} disabled={isBusy} onClick={() => sceneAction(s, "cancel_clip")}>Cancel clip</button>
                          </>
                        ) : (
                          <>
                            <button style={btn(!s.clip_url, isBusy || noFrame || !!keyError)} disabled={isBusy || noFrame || !!keyError} onClick={() => makeClip(s)}>
                              {isBusy && busy === s.id ? "Starting…" : s.clip_url ? "Make again" : "Make clip"}
                            </button>
                            {s.clip_url && (
                              <button style={btn(true, isBusy)} disabled={isBusy} onClick={() => sceneAction(s, "approve_clip", !s.approved)}>
                                {s.approved ? "Unapprove" : "Approve clip"}
                              </button>
                            )}
                            <button style={btn(false, isBusy)} disabled={isBusy} onClick={() => { uploadFor.current = s.id; fileInput.current?.click(); }}>Upload my own clip</button>
                            {s.clip_url && <button style={btn(false, isBusy)} disabled={isBusy} onClick={() => sceneAction(s, "delete_clip")}>Remove</button>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
