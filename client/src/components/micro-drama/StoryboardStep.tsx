import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import PreviewFilm from "./PreviewFilm";
import { NAVY, GOLD, btn, card, chip, h2, input, small, fmtTime, fileToDataUrl, type StepProps } from "./ui";

// Step 6 — Storyboard. One starting-frame picture per scene, made from the scene's picture prompt and the
// approved cast pictures. Draft quality is cheaper; Final is sharper. The first frame shows its real cost
// before the rest are made.
interface Frame {
  id: string; position: number; start_s: number | null; end_s: number | null; characters: string | null; prompt: string;
  frame_url: string | null; quality: string | null; approved: boolean; missing_cast: string[];
}

const API = "/api/hub-studio-pictures";

function FrameCard({ f, ratio, busy, quality, onMake, onFix, onUpload, onApprove }: {
  f: Frame; ratio: string; busy: boolean; quality: "draft" | "final";
  onMake: (f: Frame) => void; onFix: (f: Frame, text: string) => void; onUpload: (f: Frame, file: File) => void; onApprove: (f: Frame, on: boolean) => void;
}) {
  const [fixing, setFixing] = useState(false);
  const [fixText, setFixText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <article style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "'Playfair Display', serif", color: NAVY }}>Scene {f.position}</strong>
        <span style={small}>{fmtTime(Number(f.start_s) || 0)} – {fmtTime(Number(f.end_s) || 0)}</span>
        {f.frame_url && f.quality && <span style={small}>· {f.quality === "draft" ? "Draft" : f.quality === "final" ? "Final" : "Uploaded"}</span>}
        {f.approved && <span style={{ ...small, color: "#1B6E3C" }}>✓ Approved</span>}
      </div>
      {f.frame_url ? (
        <img src={f.frame_url} alt={`Scene ${f.position} starting frame`} style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: 8, border: f.approved ? `3px solid ${NAVY}` : "1px solid rgba(10,35,66,0.2)" }} />
      ) : (
        <div style={{ width: "100%", aspectRatio: ratio, borderRadius: 8, border: "1px dashed rgba(10,35,66,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={small}>No frame yet</span>
        </div>
      )}
      <p style={{ ...small, lineHeight: 1.4 }}>{f.prompt || "This scene has no picture prompt. Add one on the Script step."}</p>
      {f.missing_cast.length > 0 && (
        <p role="alert" style={{ ...small, color: "#B3261E" }}>Approve a picture for {f.missing_cast.join(" and ")} on the Cast step first.</p>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={btn(!f.frame_url, busy || f.missing_cast.length > 0)} disabled={busy || f.missing_cast.length > 0} onClick={() => onMake(f)}>
          {f.frame_url ? `Regenerate (${quality})` : `Make frame (${quality})`}
        </button>
        {f.frame_url && <button style={btn(false, busy)} disabled={busy} onClick={() => setFixing(v => !v)}>Fix</button>}
        <button style={btn(false, busy)} disabled={busy} onClick={() => fileRef.current?.click()}>Replace</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
          onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(f, file); e.target.value = ""; }} />
        {f.frame_url && (
          <button style={{ ...btn(!f.approved, busy), ...(f.approved ? { background: NAVY, color: GOLD, border: "none" } : {}) }} disabled={busy} onClick={() => onApprove(f, !f.approved)}>
            {f.approved ? "✓ Approved" : "Approve"}
          </button>
        )}
      </div>
      {fixing && f.frame_url && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input aria-label={`What to change in scene ${f.position}`} value={fixText} onChange={e => setFixText(e.target.value)} style={{ ...input, flex: "1 1 200px" }} placeholder="What should change? For example: warmer light, no phone in her hand" />
          <button style={btn(true, busy || !fixText.trim())} disabled={busy || !fixText.trim()} onClick={() => { onFix(f, fixText.trim()); setFixText(""); setFixing(false); }}>Apply fix</button>
        </div>
      )}
    </article>
  );
}

export default function StoryboardStep({ projectId, stepsDone, onChanged }: StepProps) {
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [shape, setShape] = useState("");
  const [quality, setQuality] = useState<"draft" | "final">("draft");
  const [view, setView] = useState<"frames" | "sheet" | "preview">("frames");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ remaining: Frame[]; each: number } | null>(null);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=frames&id=${projectId}`);
    if (r.ok) { setFrames(r.body.frames as Frame[]); setSize(r.body.size as string | null); setShape(r.body.shape as string); }
    else setMsg({ kind: "error", text: r.body?.error || `The frames could not be loaded (${r.status}).` });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function refresh() { await load(); await onChanged(); }

  async function makeOne(f: Frame, fix?: string): Promise<number | null> {
    const r = await callApi(API, { method: "POST", body: { action: "make_frame", scene_id: f.id, quality, ...(fix ? { fix } : {}) } });
    if (!r.ok) { setMsg({ kind: "error", text: `Scene ${f.position}: ${r.body?.error || `the frame could not be made (${r.status}).`}` }); return null; }
    return Number(r.body.cost_usd || 0);
  }

  async function single(f: Frame, fix?: string) {
    setBusy(f.id); setMsg(null);
    const cost = await makeOne(f, fix);
    setBusy(null);
    if (cost !== null) setMsg({ kind: "ok", text: `Scene ${f.position} made. Estimated cost $${cost.toFixed(2)}.` });
    await refresh();
  }

  // Makes the first missing frame, then offers the rest at the price just seen.
  async function makeAll() {
    if (!frames) return;
    const todo = frames.filter(f => !f.frame_url && f.missing_cast.length === 0);
    if (!todo.length) return;
    setBusy("all"); setMsg(null); setOffer(null); stopRef.current = false;
    setProgress(`Making scene ${todo[0].position}…`);
    const cost = await makeOne(todo[0]);
    setProgress(null);
    if (cost === null) { setBusy(null); await refresh(); return; }
    await refresh();
    if (todo.length === 1) { setBusy(null); setMsg({ kind: "ok", text: `Scene ${todo[0].position} made. Estimated cost $${cost.toFixed(2)}.` }); return; }
    setOffer({ remaining: todo.slice(1), each: cost });
    setBusy(null);
  }

  async function continueAll() {
    if (!offer) return;
    const { remaining } = offer;
    setOffer(null); setBusy("all"); stopRef.current = false;
    let total = 0, made = 0;
    for (const f of remaining) {
      if (stopRef.current) break;
      setProgress(`Making scene ${f.position}… (${made + 1} of ${remaining.length})`);
      const cost = await makeOne(f);
      if (cost === null) break;
      made++; total += cost;
    }
    setBusy(null); setProgress(null);
    setMsg({ kind: made === remaining.length ? "ok" : "error", text: `${made} of ${remaining.length} more frames made. Estimated cost $${total.toFixed(2)}.${made < remaining.length ? " It stopped early; see the message above if there is one." : ""}` });
    await refresh();
  }

  async function upload(f: Frame, file: File) {
    setBusy(f.id); setMsg(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await callApi(API, { method: "POST", body: { action: "upload_frame", scene_id: f.id, data_url: dataUrl } });
      if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `The picture could not be uploaded (${r.status}).` });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "The picture could not be read." });
    }
    setBusy(null);
    await refresh();
  }

  async function approve(f: Frame, on: boolean) {
    setBusy(f.id);
    const r = await callApi(API, { method: "POST", body: { action: "approve_frame", scene_id: f.id, on } });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `That could not be saved (${r.status}).` });
    setBusy(null);
    await refresh();
  }

  if (frames === null) return <p style={small}>Loading the storyboard…</p>;

  if (frames.length === 0) {
    return (
      <div style={card}>
        <h2 style={h2}>Storyboard</h2>
        <p style={small}>Write the script first. The storyboard has one frame for each scene.</p>
      </div>
    );
  }

  const ratio = size ? size.replace("x", " / ") : "1 / 1";
  const missingFrames = frames.filter(f => !f.frame_url && f.missing_cast.length === 0).length;
  const approvedCount = frames.filter(f => f.approved).length;
  const working = busy !== null;

  return (
    <div>
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Storyboard</h2>
        <p style={{ ...small, marginBottom: "0.8rem" }}>
          {size ? `Frames are made at ${size.replace("x", " × ")} pixels to match your film shape (${shape}). ` : ""}
          Pictures are made by OpenAI and billed to your OpenAI API account; every one shows on the Usage tab.
        </p>
        {!size && <p role="alert" style={{ ...small, color: "#B3261E", marginBottom: "0.8rem" }}>The storyboard needs a shape of 1:1, 9:16 or 16:9. Unapprove the script, set the shape on the Script step, then come back.</p>}
        {stepsDone.includes("storyboard") && <p style={{ ...small, color: "#1B6E3C", marginBottom: "0.8rem" }}>✓ Storyboard done. Every frame is approved.</p>}

        <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.9rem" }}>
          <legend style={{ ...small, fontWeight: 700, marginBottom: 4 }}>Quality</legend>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            {([["draft", "Draft", "cheapest, good for checking the idea"], ["final", "Final", "sharper, costs more"]] as const).map(([v, t, hint]) => (
              <label key={v} style={{ display: "flex", gap: 6, alignItems: "baseline", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: NAVY }}>
                <input type="radio" name="md-quality" checked={quality === v} disabled={working} onChange={() => setQuality(v)} />
                <span>{t} <span style={{ ...small, display: "inline" }}>({hint})</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn(true, working || !size || missingFrames === 0)} disabled={working || !size || missingFrames === 0} onClick={makeAll}>
            {busy === "all" ? "Working…" : missingFrames === 0 ? "All frames made" : `Make all frames (${missingFrames})`}
          </button>
          <span style={small}>{approvedCount} of {frames.length} approved</span>
          <span style={{ flex: 1 }} />
          <button style={chip(view === "frames")} onClick={() => setView("frames")}>Frames</button>
          <button style={chip(view === "sheet")} onClick={() => setView("sheet")}>Contact sheet</button>
          <button style={chip(view === "preview")} onClick={() => setView("preview")}>Preview film</button>
        </div>

        {offer && (
          <div role="status" style={{ marginTop: 12, padding: "0.8rem 1rem", border: `1px solid ${GOLD}`, borderRadius: 8, background: "rgba(212,175,55,0.12)" }}>
            <p style={{ ...small, color: NAVY, marginBottom: 8 }}>
              The first frame cost about ${offer.each.toFixed(2)}. Make the other {offer.remaining.length} for about ${(offer.each * offer.remaining.length).toFixed(2)}?
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn(true)} onClick={continueAll}>Make the other {offer.remaining.length}</button>
              <button style={btn(false)} onClick={() => setOffer(null)}>Stop here</button>
            </div>
          </div>
        )}
        {busy === "all" && progress && (
          <p role="status" style={{ ...small, marginTop: 10 }}>
            {progress} <button style={{ ...btn(false), padding: "0.2rem 0.6rem", marginLeft: 8 }} onClick={() => { stopRef.current = true; }}>Stop after this one</button>
          </p>
        )}
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginTop: 10, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}
      </div>

      {view === "preview" ? (
        <PreviewFilm key={`preview-${approvedCount}`} projectId={projectId} ratio={ratio} />
      ) : view === "frames" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
          {frames.map(f => (
            <FrameCard key={f.id} f={f} ratio={ratio} busy={working} quality={quality} onMake={fr => single(fr)} onFix={(fr, t) => single(fr, t)} onUpload={upload} onApprove={approve} />
          ))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
          {frames.map(f => (
            <figure key={f.id} style={{ margin: 0 }}>
              {f.frame_url ? (
                <img src={f.frame_url} alt={`Scene ${f.position}`} style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: 6, border: f.approved ? `3px solid ${NAVY}` : "1px solid rgba(10,35,66,0.2)" }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: ratio, borderRadius: 6, border: "1px dashed rgba(10,35,66,0.3)" }} />
              )}
              <figcaption style={{ ...small, marginTop: 3 }}>{f.position}{f.approved ? " ✓" : ""} · {fmtTime(Number(f.start_s) || 0)}</figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
