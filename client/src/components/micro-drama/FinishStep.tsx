import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { supabase } from "../../lib/supabase";
import { btn, card, h2, input, label, small, type StepProps } from "./ui";
import { buildCues, measureDuration, runFilm, segDur, sizeFor, toSrt, totalOf, type Plan, type Seg } from "./finishEngine";

// Step 8 — Finish. Puts the approved clips, recordings and music together into one film, in the browser.
// Previewing is free. Rendering is free too: the film is made on this device and saved to private storage.
interface FScene {
  id: string; position: number; needs_s: number; clip_key: string | null; clip_url: string | null;
  audio_key: string | null; audio_url: string | null; audio_seconds: number | null; lines: { speaker: string; text: string }[];
}
interface Flag { kind: string; where: string; quote: string; why: string; fix: string }
interface AdCheck { hash: string; at: string; flags: Flag[] }
interface Exp { id: string; n: number; version: string; path: string; mime: string; created_at: string; seconds: number | null; expected_seconds: number | null; width: number | null; height: number | null; bytes: number | null; verified: boolean; url: string | null; queue_item_id?: string }
interface Trim { in: number; out: number }
interface EndCardState { on: boolean; cta: string; website: string; seconds: number; logo: "none" | "product" }

const API = "/api/hub-studio-finish";
const VERSION_LABEL: Record<string, string> = { full: "Full film", cut30: "30-second cutdown", cut15: "15-second cutdown" };
const TARGET: Record<string, number> = { cut30: 30, cut15: 15 };
const r1 = (n: number) => Math.round(n * 10) / 10;
const secs = (n: number) => `${r1(n)}s`;

export default function FinishStep({ projectId, stepsDone, onChanged, onGoto }: StepProps) {
  const [title, setTitle] = useState("");
  const [filmShape, setFilmShape] = useState("");
  const [scenes, setScenes] = useState<FScene[] | null>(null);
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [trims, setTrims] = useState<Record<string, Trim>>({});
  const [include, setInclude] = useState<Record<string, string[]>>({});
  const [version, setVersion] = useState("full");
  const [shape, setShape] = useState("film");
  const [captions, setCaptions] = useState<"on" | "off">("off");
  const [endcard, setEndcard] = useState<EndCardState>({ on: false, cta: "", website: "", seconds: 3, logo: "none" });
  const [clipLen, setClipLen] = useState<Record<string, number>>({});
  const [ad, setAd] = useState<AdCheck | null>(null);
  const [adStale, setAdStale] = useState(false);
  const [adAck, setAdAck] = useState(false);
  const [exportsList, setExportsList] = useState<Exp[]>([]);
  const [watching, setWatching] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [stage, setStage] = useState("");
  const [progress, setProgress] = useState<{ t: number; total: number } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const loaded = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlCache = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=finish&id=${projectId}`);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The Finish step could not be loaded (${r.status}).` }); return; }
    const b = r.body;
    const serverSteps = (b.steps_done as string[]) || [];
    if (serverSteps.length !== stepsDone.length || serverSteps.some((x: string) => !stepsDone.includes(x))) onChanged();
    const keep = (id: string, key: string | null, url: string | null) => {
      if (!key || !url) return url;
      const k = `${id}:${key}`;
      if (!urlCache.current[k]) urlCache.current[k] = url;
      return urlCache.current[k];
    };
    const list = (b.scenes as FScene[]).map(s => ({ ...s, clip_url: keep(`${s.id}:clip`, s.clip_key, s.clip_url), audio_url: keep(`${s.id}:audio`, s.audio_key, s.audio_url) }));
    setScenes(list);
    setTitle(String(b.title || "Film"));
    setFilmShape(String(b.film?.shape || ""));
    setMusicUrl(b.music?.url || null);
    setProductUrl(b.product_photo?.url || null);
    setExportsList(b.exports as Exp[]);
    setAd((b.ad_check as AdCheck | null) || null);
    if (!loaded.current) {
      loaded.current = true;
      const f = b.finish;
      const saved: string[] = f.order || [];
      setOrder([...saved.filter((id: string) => list.some(s => s.id === id)), ...list.filter(s => !saved.includes(s.id)).map(s => s.id)]);
      setTrims(f.trims || {}); setInclude(f.include || {}); setVersion(f.version); setShape(f.shape); setCaptions(f.captions); setEndcard(f.endcard);
      setAdStale(!(b.ad_check && b.ad_check.hash === b.ad_hash));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { abort.current?.abort(); if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // How long each approved clip really is.
  useEffect(() => {
    (scenes || []).forEach(s => {
      if (!s.clip_url || clipLen[s.id] !== undefined) return;
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => setClipLen(m => ({ ...m, [s.id]: Number.isFinite(v.duration) ? r1(v.duration) : 0 }));
      v.onerror = () => setClipLen(m => ({ ...m, [s.id]: 0 }));
      v.src = s.clip_url;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  const byId = useMemo(() => new Map((scenes || []).map(s => [s.id, s])), [scenes]);
  const ordered = order.map(id => byId.get(id)).filter(Boolean) as FScene[];
  const trimOf = (s: FScene): Trim => {
    const t = trims[s.id];
    const len = clipLen[s.id];
    if (t) return t;
    return { in: 0, out: r1(len && len > 0 ? Math.min(s.needs_s, len) : s.needs_s) };
  };
  const inVersion = (s: FScene) => version === "full" || (include[version] ? include[version].includes(s.id) : true);
  const selected = ordered.filter(inVersion);
  const segs: Seg[] = selected.filter(s => s.clip_url).map(s => {
    const t = trimOf(s);
    return { sceneId: s.id, position: s.position, clipUrl: s.clip_url as string, inS: t.in, outS: t.out, audioUrl: s.audio_url, audioSeconds: s.audio_seconds, lines: s.lines };
  });
  const total = totalOf(segs);
  const fullTotal = ordered.reduce((n, s) => n + (s.clip_url ? segDur({ sceneId: "", position: 0, clipUrl: "", inS: trimOf(s).in, outS: trimOf(s).out, audioUrl: null, audioSeconds: null, lines: [] }) : 0), 0);
  const outShape = shape === "film" ? filmShape : shape;
  const size = sizeFor(outShape);
  const missing = selected.filter(s => !s.clip_url);
  const target = TARGET[version];
  const over = target !== undefined && total > target + 0.5;
  const versions = ["full", ...(fullTotal > 30.5 ? ["cut30"] : []), ...(fullTotal > 15.5 ? ["cut15"] : [])];
  const cues = useMemo(() => buildCues(segs), [segs.map(s => `${s.sceneId}${s.inS}${s.outS}${s.audioUrl}`).join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const warnings: string[] = [];
  selected.forEach(s => {
    if (!s.clip_url) return;
    const t = trimOf(s), len = clipLen[s.id];
    const d = t.out - t.in;
    if (len && len > s.needs_s + 0.05 && t.out < len - 0.05 && d < len) warnings.push(`Scene ${s.position}: the clip is ${secs(len)} and the scene needs ${secs(s.needs_s)}. The part outside In and Out is cut. Make it again at the right length in the Video step, or adjust In and Out.`);
    else if (len && len < s.needs_s - 0.05) warnings.push(`Scene ${s.position}: the clip is ${secs(len)} but the scene needs ${secs(s.needs_s)}, so this scene runs ${secs(d)}.`);
    if (s.audio_seconds !== null && s.audio_seconds > d + 0.1) warnings.push(`Scene ${s.position}: the recording (${secs(s.audio_seconds)}) is longer than the scene as trimmed (${secs(d)}) and is cut at the scene change.`);
  });

  // Saving
  function persist(next: Partial<{ order: string[]; trims: Record<string, Trim>; include: Record<string, string[]>; version: string; shape: string; captions: string; endcard: EndCardState }>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      callApi(API, { method: "POST", body: { action: "save_finish", project_id: projectId, finish: next } }).then(r => {
        if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `That could not be saved (${r.status}).` });
      });
    }, 500);
  }
  const touchAd = () => { setAdStale(true); setAdAck(false); };
  const allState = (over: Partial<{ order: string[]; trims: Record<string, Trim>; include: Record<string, string[]>; version: string; shape: string; captions: string; endcard: EndCardState }> = {}) =>
    ({ order, trims, include, version, shape, captions, endcard, ...over });

  function move(id: string, to: number) {
    const from = order.indexOf(id);
    if (from < 0 || to < 0 || to >= order.length || from === to) return;
    const next = [...order]; next.splice(from, 1); next.splice(to, 0, id);
    setOrder(next); touchAd(); persist(allState({ order: next }));
  }
  function setTrim(s: FScene, patch: Partial<Trim>) {
    const cur = trimOf(s);
    setTrims(m => ({ ...m, [s.id]: { ...cur, ...patch } }));
  }
  function commitTrim(s: FScene) {
    const t = trimOf(s), len = clipLen[s.id] || 1e9;
    const i = Math.min(Math.max(0, r1(Number(t.in) || 0)), Math.max(0, len - 0.1));
    const o = Math.min(Math.max(i + 0.1, r1(Number(t.out) || 0)), len);
    const next = { ...trims, [s.id]: { in: i, out: o } };
    setTrims(next); touchAd(); persist(allState({ trims: next }));
  }
  function toggleInclude(s: FScene) {
    const cur = include[version] || ordered.map(x => x.id);
    const next = { ...include, [version]: cur.includes(s.id) ? cur.filter(x => x !== s.id) : [...cur, s.id] };
    setInclude(next); touchAd(); persist(allState({ include: next }));
  }
  function setEnd(patch: Partial<EndCardState>) {
    const next = { ...endcard, ...patch };
    setEndcard(next); touchAd(); persist(allState({ endcard: next }));
  }

  // Free preview
  async function preview() {
    if (!size || !segs.length || !canvasRef.current) return;
    setMsg(null); setBusy("preview"); abort.current = new AbortController();
    const plan = makePlan();
    try {
      await runFilm(plan, canvasRef.current, { record: false, signal: abort.current.signal, onProgress: (t, tt) => setProgress({ t, total: tt }), onStage: setStage });
    } catch (e: any) {
      if (e?.message !== "Stopped.") setMsg({ kind: "error", text: e?.message || "The preview could not play." });
    }
    setBusy(null); setStage(""); setProgress(null);
  }
  function stop() { abort.current?.abort(); }

  function makePlan(): Plan {
    return {
      segs, musicUrl, width: size!.width, height: size!.height, fps: 30, captions: captions === "on",
      endcard: { on: endcard.on, cta: endcard.cta, website: endcard.website, seconds: endcard.seconds, logoUrl: endcard.logo === "product" ? productUrl : null },
    };
  }

  async function runAdCheck(): Promise<AdCheck | null> {
    setBusy("ad"); setStage("Checking the words against ad rules…");
    await callApi(API, { method: "POST", body: { action: "save_finish", project_id: projectId, finish: allState() } });
    const r = await callApi(API, { method: "POST", body: { action: "ad_check", project_id: projectId } });
    setBusy(null); setStage("");
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The ad-policy check could not run (${r.status}).` }); return null; }
    const result: AdCheck = { hash: r.body.hash, at: new Date().toISOString(), flags: r.body.flags as Flag[] };
    setAd(result); setAdStale(false); setAdAck(false);
    return result;
  }

  async function render() {
    if (!size || !segs.length || !canvasRef.current) return;
    setMsg(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    let check = ad;
    if (adStale || !check) { check = await runAdCheck(); if (!check) return; }
    if (check.flags.length > 0 && !(adAck && !adStale)) {
      setMsg({ kind: "error", text: "The ad-policy check found wording to look at. Read it, then tick the box to render anyway." });
      return;
    }
    setBusy("render"); abort.current = new AbortController();
    try {
      const plan = makePlan();
      const out = await runFilm(plan, canvasRef.current, { record: true, signal: abort.current.signal, onProgress: (t, tt) => setProgress({ t, total: tt }), onStage: setStage });
      if (!out.blob || !out.mime) throw new Error("The browser made no film. Try again.");
      if (out.blob.size > 50 * 1024 * 1024) throw new Error("The finished film is over 50 MB, which is more than the storage allows. Make a shorter version.");
      setStage("Checking the finished film…");
      const seconds = await measureDuration(out.blob);
      const verified = Math.abs(seconds - out.seconds) <= 0.7;
      setStage("Saving the film…");
      const up = await callApi(API, { method: "POST", body: { action: "upload_url", project_id: projectId, mime: out.mime } });
      if (!up.ok) throw new Error(up.body?.error || `The film could not be saved (${up.status}).`);
      const put = await supabase.storage.from("studio-media").uploadToSignedUrl(up.body.path as string, up.body.token as string, out.blob, { contentType: out.mime });
      if (put.error) throw new Error(`The film could not be uploaded: ${put.error.message}`);
      const reg = await callApi(API, { method: "POST", body: { action: "register_export", project_id: projectId, path: up.body.path, mime: out.mime, version, seconds, expected_seconds: out.seconds, width: size.width, height: size.height, bytes: out.blob.size, verified } });
      if (!reg.ok) throw new Error(reg.body?.error || `The film was saved but could not be listed (${reg.status}).`);
      setMsg({ kind: "ok", text: `${VERSION_LABEL[version]} is ready in Exports below${verified ? "" : ". Its length did not match the plan, so check it before using it"}.` });
      await load(); await onChanged();
    } catch (e: any) {
      if (e?.message !== "Stopped.") setMsg({ kind: "error", text: e?.message || "The film could not be made." });
    }
    setBusy(null); setStage(""); setProgress(null);
  }

  async function removeExport(x: Exp) {
    setBusy(`del-${x.id}`);
    const r = await callApi(API, { method: "POST", body: { action: "delete_export", project_id: projectId, export_id: x.id } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `That could not be removed (${r.status}).` });
    setBusy(null); await load(); await onChanged();
  }
  async function toQueue(x: Exp) {
    setBusy(`q-${x.id}`); setMsg(null);
    const r = await callApi(API, { method: "POST", body: { action: "export_to_queue", project_id: projectId, export_id: x.id } });
    setMsg(r.ok ? { kind: "ok", text: `v${x.n} is in Video Que (Video Hub).` } : { kind: "error", text: r.body?.error || `It could not be sent to Video Que (${r.status}).` });
    setBusy(null); await load();
  }
  async function download(x: Exp) {
    if (!x.url) return;
    setBusy(`dl-${x.id}`);
    try {
      const blob = await (await fetch(x.url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "film"}-v${x.n}-${x.version}.${x.mime === "video/webm" ? "webm" : "mp4"}`;
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch { setMsg({ kind: "error", text: "The download could not start. Try Watch, then save from the player." }); }
    setBusy(null);
  }
  function downloadSrt() {
    const text = toSrt(cues);
    if (!text) { setMsg({ kind: "error", text: "There are no approved recordings with spoken lines to caption yet." }); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    a.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "film"}-${version}.srt`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  const working = busy !== null;
  const adNeedsAck = !!ad && ad.flags.length > 0 && !adStale;
  const renderBlocked = !size || !segs.length || missing.length > 0 || over || (adNeedsAck && !adAck);
  const renderReason = !size ? "The film's shape is not set, so there is no output size. Set it on the Script step." : !segs.length ? "There are no approved clips in this version yet." : missing.length ? `Approve a clip for Scene ${missing.map(s => s.position).join(", ")} on the Video step, or remove ${missing.length === 1 ? "it" : "them"} from this version.` : over ? `This version is ${secs(total)} and the limit is ${target}s. Remove or trim ${secs(total - target)} more.` : adNeedsAck && !adAck ? "Read the ad-policy notes, then tick the box to render anyway." : "";

  if (scenes === null) return <p style={small}>Loading…</p>;
  if (!scenes.length) return <div style={card}><p style={small}>There are no scenes yet. Write the script first.</p></div>;

  const pct = progress && progress.total ? Math.min(100, Math.round((progress.t / progress.total) * 100)) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 360px" }}>
          <h2 style={{ ...h2, fontSize: "1.5rem" }}>Finish</h2>
          <p style={small}>{size ? `${size.width}×${size.height}` : "No output size"} · 30 fps · audio {secs(total)}</p>
        </div>
        <button style={btn(false)} onClick={() => onGoto?.("video")}>← Video</button>
      </div>

      <div style={{ ...card, marginBottom: "1rem", padding: "0.8rem 1.1rem" }}>
        <p style={small}>The film is put together in your browser on this device. Keep this tab open and the screen on until it finishes. If you leave, press Render again. Previewing and rendering cost nothing. The finished film is saved to your private storage.</p>
        {stepsDone.includes("finish") && <p style={{ ...small, color: "#1B6E3C", marginTop: 6 }}>✓ Finish done. A full-film export exists.</p>}
      </div>
      {msg && <p role={msg.kind === "error" ? "alert" : undefined} style={{ ...small, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E", marginBottom: "0.8rem" }}>{msg.text}</p>}

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Timeline</h2>
        <p style={{ ...small, marginBottom: "0.8rem" }}>Drag a row, or use the arrows, to reorder. In and Out trim the clip, in seconds. Each recording stays with its scene.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {ordered.map((s, i) => {
            const t = trimOf(s), len = clipLen[s.id];
            const included = inVersion(s);
            return (
              <div key={s.id} draggable onDragStart={() => setDragId(s.id)} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) move(dragId, i); setDragId(null); }}
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", border: "1px solid rgba(10,35,66,0.15)", borderRadius: 10, padding: "0.5rem 0.7rem", background: included ? "#FFFFFF" : "#F1F1EE", opacity: included ? 1 : 0.7 }}>
                <span aria-hidden style={{ cursor: "grab", color: "rgba(10,35,66,0.5)" }}>⠿</span>
                {version !== "full" && <input type="checkbox" aria-label={`Include Scene ${s.position}`} checked={included} onChange={() => toggleInclude(s)} />}
                <strong style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", minWidth: 62 }}>Scene {s.position}</strong>
                <span style={{ ...small, minWidth: 150 }}>{s.clip_url ? `needs ${secs(s.needs_s)} · clip ${len === undefined ? "…" : secs(len)}` : "No approved clip yet"}</span>
                {s.clip_url && (
                  <>
                    <label style={{ ...small, display: "flex", alignItems: "center", gap: 4 }}>In
                      <input type="number" step={0.1} min={0} value={t.in} onChange={e => setTrim(s, { in: Number(e.target.value) })} onBlur={() => commitTrim(s)} style={{ ...input, width: 78, padding: "0.3rem 0.4rem" }} />
                    </label>
                    <label style={{ ...small, display: "flex", alignItems: "center", gap: 4 }}>Out
                      <input type="number" step={0.1} min={0} value={t.out} onChange={e => setTrim(s, { out: Number(e.target.value) })} onBlur={() => commitTrim(s)} style={{ ...input, width: 78, padding: "0.3rem 0.4rem" }} />
                    </label>
                  </>
                )}
                <span style={{ flex: 1 }} />
                <button aria-label="Move up" style={btn(false, i === 0)} disabled={i === 0} onClick={() => move(s.id, i - 1)}>↑</button>
                <button aria-label="Move down" style={btn(false, i === ordered.length - 1)} disabled={i === ordered.length - 1} onClick={() => move(s.id, i + 1)}>↓</button>
              </div>
            );
          })}
        </div>
        <p style={{ ...small, marginTop: 8 }}>Audio track · {musicUrl ? "recordings with music underneath" : "recordings"} · 0s to {secs(total)}</p>
      </div>

      {warnings.length > 0 && (
        <div style={{ ...card, marginBottom: "1rem", borderColor: "rgba(179,38,30,0.4)", background: "#FDF3F2" }}>
          <h2 style={{ ...h2, fontSize: "1rem" }}>Some clips do not match their scene length</h2>
          <ul style={{ ...small, margin: 0, paddingLeft: "1.1rem" }}>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>On-screen text</h2>
        <label style={{ ...small, display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <input type="checkbox" checked={endcard.on} onChange={e => setEnd({ on: e.target.checked })} /> End card over the last seconds
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem" }}>
          <div>
            <label htmlFor="fin-cta" style={label}>Call to action</label>
            <input id="fin-cta" style={input} value={endcard.cta} disabled={!endcard.on} onChange={e => setEndcard({ ...endcard, cta: e.target.value })} onBlur={() => setEnd({})} />
          </div>
          <div>
            <label htmlFor="fin-web" style={label}>Website</label>
            <input id="fin-web" style={input} value={endcard.website} disabled={!endcard.on} onChange={e => setEndcard({ ...endcard, website: e.target.value })} onBlur={() => setEnd({})} />
          </div>
          <div>
            <label htmlFor="fin-sec" style={label}>Seconds on screen</label>
            <select id="fin-sec" style={input} value={endcard.seconds} disabled={!endcard.on} onChange={e => setEnd({ seconds: Number(e.target.value) })}>
              {[2, 3, 4, 5, 6, 8].map(n => <option key={n} value={n}>{n}s</option>)}
            </select>
          </div>
          <div>
            <span style={label}>Logo or product photo</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={btn(endcard.logo === "none", !endcard.on)} disabled={!endcard.on} onClick={() => setEnd({ logo: "none" })}>None</button>
              {productUrl ? (
                <button aria-label="Use the product picture" disabled={!endcard.on} onClick={() => setEnd({ logo: "product" })} style={{ border: endcard.logo === "product" ? "2px solid #0A2342" : "1px solid rgba(10,35,66,0.25)", borderRadius: 8, padding: 2, background: "#fff", cursor: "pointer" }}>
                  <img src={productUrl} alt="Approved product picture" style={{ width: 54, height: 54, objectFit: "cover", borderRadius: 6, display: "block" }} />
                </button>
              ) : <span style={small}>Approve a product picture on the Cast step to use it here.</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginTop: 12 }}>
          <div style={{ width: 200 }}>
            <label htmlFor="fin-cap" style={label}>Captions</label>
            <select id="fin-cap" style={input} value={captions} onChange={e => { const v = e.target.value as "on" | "off"; setCaptions(v); persist(allState({ captions: v })); }}>
              <option value="off">Off</option>
              <option value="on">On the video</option>
            </select>
          </div>
          <button style={btn(false)} onClick={downloadSrt}>Download captions file (.srt)</button>
        </div>
        <p style={{ ...small, marginTop: 6 }}>Captions use your approved script lines, timed to each recording.</p>
      </div>

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Version</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ width: 240 }}>
            <label htmlFor="fin-len" style={label}>Length</label>
            <select id="fin-len" style={input} value={version} onChange={e => { setVersion(e.target.value); touchAd(); persist(allState({ version: e.target.value })); }}>
              {versions.map(v => <option key={v} value={v}>{v === "full" ? `Full film (${secs(fullTotal)})` : VERSION_LABEL[v]}</option>)}
            </select>
          </div>
          <div style={{ width: 280 }}>
            <label htmlFor="fin-shape" style={label}>Shape</label>
            <select id="fin-shape" style={input} value={shape} onChange={e => { setShape(e.target.value); persist(allState({ shape: e.target.value })); }}>
              <option value="film">Same as the film ({filmShape || "not set"})</option>
              <option value="9:16">Vertical 9:16 (centered crop)</option>
              <option value="1:1">Square 1:1 (centered crop)</option>
              <option value="16:9">Wide 16:9 (centered crop)</option>
            </select>
          </div>
        </div>
        <p style={{ ...small, marginTop: 8 }}>
          {version === "full" ? "All scenes. Render once per version you need." : `Tick the scenes in this cutdown above and trim them. It can be up to ${target}s and is ${secs(total)} now.`}
        </p>
      </div>

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Preview before rendering</h2>
        <p style={{ ...small, marginBottom: "0.8rem" }}>Free. Nothing is rendered. Watch the clips and audio together to check that the lines land on the right scenes.</p>
        <div style={{ maxWidth: 360, margin: "0 auto 0.8rem" }}>
          <canvas ref={canvasRef} style={{ width: "100%", aspectRatio: size ? `${size.width} / ${size.height}` : "9 / 16", background: "#000", borderRadius: 8, display: "block" }} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {busy === "preview" ? <button style={btn(true)} onClick={stop}>■ Stop</button> : <button style={btn(false, working || !size || !segs.length)} disabled={working || !size || !segs.length} onClick={preview}>▶ Preview the whole film</button>}
          {progress && <div style={{ flex: 1, minWidth: 140 }}><div style={{ height: 6, background: "rgba(10,35,66,0.12)", borderRadius: 3 }}><div style={{ width: `${pct}%`, height: 6, background: "#0A2342", borderRadius: 3 }} /></div></div>}
          {stage && <span style={small}>{stage}</span>}
        </div>
      </div>

      <div style={{ ...card, marginBottom: "1rem", borderColor: ad && ad.flags.length ? "rgba(179,38,30,0.4)" : undefined, background: ad && ad.flags.length ? "#FDF3F2" : undefined }}>
        <h2 style={h2}>Ad-policy check</h2>
        <p style={{ ...small, marginBottom: 6 }}>Claude reads the spoken words and the end card against Meta's published rules on unrealistic outcomes and TikTok's rules on misleading and false content, and lists anything that might get the ad rejected. It is a second pair of eyes, not a decision.</p>
        {!ad ? <p style={small}>Not checked yet. Rendering runs it first.</p> : (
          <>
            {adStale && <p style={{ ...small, color: "#B3261E" }}>The words changed since this check. It runs again when you render.</p>}
            {ad.flags.length === 0 ? <p style={{ ...small, color: "#1B6E3C" }}>No problems found in the words{adStale ? " (before your latest changes)" : ""}.</p> : (
              <>
                <p style={{ ...small, marginBottom: 6 }}>These might get the ad rejected on Meta or TikTok:</p>
                {ad.flags.map((f, i) => (
                  <p key={i} style={{ ...small, color: "#0A2342", marginBottom: 6 }}>
                    <strong>{f.kind}</strong> · {f.where} · “{f.quote}” — {f.why} {f.fix}
                  </p>
                ))}
                <label style={{ ...small, display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <input type="checkbox" checked={adAck && !adStale} disabled={adStale} onChange={e => setAdAck(e.target.checked)} /> I've checked these and want to render anyway
                </label>
              </>
            )}
          </>
        )}
        <p style={{ ...small, marginTop: 8 }}>This film is made with AI. TikTok asks for AI-generated content to be labeled when you post it.</p>
        <div style={{ marginTop: 8 }}><button style={btn(false, working || !segs.length)} disabled={working || !segs.length} onClick={() => runAdCheck()}>{busy === "ad" ? "Checking…" : "Check now"}</button></div>
      </div>

      <div style={{ marginBottom: "1.2rem", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {busy === "render" ? <button style={btn(true)} onClick={stop}>■ Stop</button> : <button style={btn(true, working || renderBlocked)} disabled={working || renderBlocked} onClick={render}>Render {VERSION_LABEL[version]}</button>}
        {busy === "render" && progress && <div style={{ flex: 1, minWidth: 160 }}><div style={{ height: 8, background: "rgba(10,35,66,0.12)", borderRadius: 4 }}><div style={{ width: `${pct}%`, height: 8, background: "#D4AF37", borderRadius: 4 }} /></div><p style={small}>{stage} {pct}%</p></div>}
        {busy !== "render" && renderBlocked && renderReason && <span style={{ ...small, color: "#B3261E" }}>{renderReason}</span>}
      </div>

      <div style={card}>
        <h2 style={h2}>Exports</h2>
        {exportsList.length === 0 ? <p style={small}>Nothing rendered yet.</p> : (
          <div style={{ display: "grid", gap: 8 }}>
            {[...exportsList].sort((a, b) => b.n - a.n).map(x => (
              <div key={x.id} style={{ border: "1px solid rgba(10,35,66,0.15)", borderRadius: 10, padding: "0.6rem 0.8rem", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>v{x.n}</strong>
                  <span style={{ ...small, border: "1px solid rgba(10,35,66,0.25)", borderRadius: 999, padding: "0.1rem 0.5rem" }}>{VERSION_LABEL[x.version] || x.version}</span>
                  <span style={{ ...small, flex: "1 1 240px" }}>
                    {new Date(x.created_at).toLocaleString()} · {x.seconds ? `${r1(x.seconds)}s` : ""}{x.expected_seconds ? ` (planned ${r1(x.expected_seconds)}s)` : ""} · {x.width}×{x.height} · {x.bytes ? `${(x.bytes / 1048576).toFixed(1)} MB` : ""} · {x.mime === "video/webm" ? "WebM" : "MP4"} · {x.verified ? "verified" : "length differs from plan"}
                  </span>
                  <button style={btn(false, !x.url)} disabled={!x.url} onClick={() => setWatching(watching === x.id ? null : x.id)}>{watching === x.id ? "Hide" : "Watch"}</button>
                  <button style={btn(false, !x.url || busy === `dl-${x.id}`)} disabled={!x.url || busy === `dl-${x.id}`} onClick={() => download(x)}>Download</button>
                  {x.queue_item_id ? <span style={{ ...small, color: "#1B6E3C" }}>✓ In Video Que</span> : <button style={btn(false, working)} disabled={working} onClick={() => toQueue(x)}>{busy === `q-${x.id}` ? "Sending…" : "Export to Video Que"}</button>}
                  <button style={btn(false, working)} disabled={working} onClick={() => removeExport(x)}>Remove</button>
                </div>
                {watching === x.id && x.url && <video src={x.url} controls playsInline style={{ width: "100%", maxWidth: 420, display: "block", margin: "0.7rem auto 0", borderRadius: 8, background: "#000" }} />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
