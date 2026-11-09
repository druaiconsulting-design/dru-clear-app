import { useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { btn, card, h2, input, label, small, type StepProps } from "./ui";

// Step 1 — Product. The facts every writer works from, plus the film type.
// Everything saves as you type (a moment after you pause, and when you leave the step).
// "Save and continue" checks off the Product step.
const FILM_TYPES = ["True drama", "Story-led ad"];
const PAUSE_MS = 700;

export default function ProductStep({ projectId, settings, stepsDone, onChanged }: StepProps) {
  const p = settings?.product || {};
  const [name, setName] = useState<string>(p.name || "");
  const [what, setWhat] = useState<string>(p.what || "");
  const [audience, setAudience] = useState<string>(p.audience || "");
  const [link, setLink] = useState<string>(p.link || "");
  const [never, setNever] = useState<string>(p.never || "");
  const [filmType, setFilmType] = useState<string>(settings?.film_type || "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Always-current copies, so a delayed save or a save on leaving the step uses what is on screen.
  const latest = useRef({ name, what, audience, link, never, filmType });
  latest.current = { name, what, audience, link, never, filmType };
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const changed = useRef(onChanged);
  changed.current = onChanged;

  function body(markDone: boolean) {
    const v = latest.current;
    return {
      action: "save_settings", id: projectId, ...(markDone ? { mark_done: "product" } : {}),
      patch: { product: { name: v.name, what: v.what, audience: v.audience, link: v.link, never: v.never }, film_type: v.filmType },
    };
  }

  async function autosave() {
    timer.current = undefined;
    if (!dirty.current) return;
    dirty.current = false;
    setState("saving");
    const r = await callApi("/api/hub-studio", { method: "POST", body: body(false) });
    if (!r.ok) { dirty.current = true; setState("error"); return; }
    setState("saved");
    await changed.current();
  }

  function edit(set: (v: string) => void) {
    return (v: string) => {
      set(v);
      dirty.current = true;
      setState("idle");
      setMsg(null);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(autosave, PAUSE_MS);
    };
  }

  // Leaving the step (clicking another step or going back to Projects) saves anything still waiting.
  useEffect(() => () => {
    window.clearTimeout(timer.current);
    if (dirty.current) {
      dirty.current = false;
      callApi("/api/hub-studio", { method: "POST", body: body(false) }).then(() => changed.current());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAndContinue() {
    window.clearTimeout(timer.current);
    dirty.current = false;
    setState("saving");
    setMsg(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: body(true) });
    if (!r.ok) { setState("error"); setMsg({ kind: "error", text: r.body?.error || `That could not be saved (${r.status}).` }); return; }
    setState("saved");
    setMsg({ kind: "ok", text: "Product step done. The Story step is next." });
    await changed.current();
  }

  const field = (id: string, text: string, value: string, set: (v: string) => void, rows = 0, hint?: string) => (
    <div style={{ marginBottom: "0.9rem" }}>
      <label htmlFor={id} style={label}>{text}</label>
      {rows ? (
        <textarea id={id} value={value} rows={rows} onChange={e => edit(set)(e.target.value)} style={{ ...input, resize: "vertical" }} />
      ) : (
        <input id={id} value={value} onChange={e => edit(set)(e.target.value)} style={input} />
      )}
      {hint && <p style={{ ...small, marginTop: 3 }}>{hint}</p>}
    </div>
  );

  const ready = !!name.trim() && !!what.trim();

  return (
    <div style={card}>
      <h2 style={h2}>Product</h2>
      <p style={{ ...small, marginBottom: "1rem" }}>These details go to every writer. Add only what is true; writers build from exactly what you enter. Everything saves as you type.</p>
      {field("md-product-name", "Product or offer name", name, setName)}
      {field("md-product-what", "What it is", what, setWhat, 3, "One or two sentences.")}
      {field("md-product-audience", "Who it is for", audience, setAudience, 2)}
      {field("md-product-link", "Where the video sends people", link, setLink)}
      {field("md-product-never", "Must never be said or shown", never, setNever, 2, "Words, claims or images the story must leave out.")}
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="md-film-type" style={label}>Film type</label>
        <input id="md-film-type" list="md-film-types" value={filmType} onChange={e => edit(setFilmType)(e.target.value)} style={input} placeholder="Pick one or type your own" />
        <datalist id="md-film-types">{FILM_TYPES.map(t => <option key={t} value={t} />)}</datalist>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(true, state === "saving" || !ready)} disabled={state === "saving" || !ready} onClick={saveAndContinue}>
          {stepsDone.includes("product") ? "Save changes" : "Save and continue"}
        </button>
        <span aria-live="polite" style={{ ...small, color: state === "error" ? "#B3261E" : "rgba(10,35,66,0.6)" }}>
          {state === "saving" ? "Saving…" : state === "saved" ? "✓ Saved" : state === "error" ? "Not saved. Check your connection and keep typing to retry." : ""}
        </span>
        {msg && <span role="status" style={{ ...small, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</span>}
      </div>
      {!ready && <p style={{ ...small, marginTop: 8 }}>Add the product name and what it is to finish this step.</p>}
    </div>
  );
}
