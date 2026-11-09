import { useState } from "react";
import { callApi } from "../../lib/adminApi";
import { btn, card, h2, input, label, small, type StepProps } from "./ui";

// Step 1 — Product. The facts every writer works from, plus the film type.
const FILM_TYPES = ["True drama", "Story-led ad"];

export default function ProductStep({ projectId, settings, stepsDone, onChanged }: StepProps) {
  const p = settings?.product || {};
  const [name, setName] = useState<string>(p.name || "");
  const [what, setWhat] = useState<string>(p.what || "");
  const [audience, setAudience] = useState<string>(p.audience || "");
  const [link, setLink] = useState<string>(p.link || "");
  const [never, setNever] = useState<string>(p.never || "");
  const [filmType, setFilmType] = useState<string>(settings?.film_type || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await callApi("/api/hub-studio", {
      method: "POST",
      body: { action: "save_settings", id: projectId, mark_done: "product", patch: { product: { name, what, audience, link, never }, film_type: filmType } },
    });
    setSaving(false);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `That could not be saved (${r.status}).` }); return; }
    setMsg({ kind: "ok", text: "Saved. The Story step is next." });
    await onChanged();
  }

  const field = (id: string, text: string, value: string, set: (v: string) => void, rows = 0, hint?: string) => (
    <div style={{ marginBottom: "0.9rem" }}>
      <label htmlFor={id} style={label}>{text}</label>
      {rows ? (
        <textarea id={id} value={value} rows={rows} onChange={e => set(e.target.value)} style={{ ...input, resize: "vertical" }} />
      ) : (
        <input id={id} value={value} onChange={e => set(e.target.value)} style={input} />
      )}
      {hint && <p style={{ ...small, marginTop: 3 }}>{hint}</p>}
    </div>
  );

  return (
    <div style={card}>
      <h2 style={h2}>Product</h2>
      <p style={{ ...small, marginBottom: "1rem" }}>These details go to every writer. Add only what is true; writers build from exactly what you enter.</p>
      {field("md-product-name", "Product or offer name", name, setName)}
      {field("md-product-what", "What it is", what, setWhat, 3, "One or two sentences.")}
      {field("md-product-audience", "Who it is for", audience, setAudience, 2)}
      {field("md-product-link", "Where the video sends people", link, setLink)}
      {field("md-product-never", "Must never be said or shown", never, setNever, 2, "Words, claims or images the story must leave out.")}
      <div style={{ marginBottom: "1rem" }}>
        <label htmlFor="md-film-type" style={label}>Film type</label>
        <input id="md-film-type" list="md-film-types" value={filmType} onChange={e => setFilmType(e.target.value)} style={input} placeholder="Pick one or type your own" />
        <datalist id="md-film-types">{FILM_TYPES.map(t => <option key={t} value={t} />)}</datalist>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button style={btn(true, saving || !name.trim() || !what.trim())} disabled={saving || !name.trim() || !what.trim()} onClick={save}>
          {saving ? "Saving…" : stepsDone.includes("product") ? "Save changes" : "Save and continue"}
        </button>
        {msg && <span role="status" style={{ ...small, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</span>}
      </div>
    </div>
  );
}
