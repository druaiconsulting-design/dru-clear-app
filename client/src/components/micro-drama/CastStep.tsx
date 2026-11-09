import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { NAVY, GOLD, btn, card, h2, input, label, small, fileToDataUrl, type Agent, type StepProps } from "./ui";

// Step 4 — Cast & references. One approved picture per character and for the product; later steps use these exact images.
// Characters are listed from the script by the writer who wrote it. A character's face comes from an invented
// description, an agent's photo or an upload.
interface Pic { id: string; view: "front" | "three_quarter"; source: string; url: string | null }
interface Character {
  id: string; name: string; role: string | null; age_range: string | null; look: string | null; wardrobe: string | null; before_after: string | null;
  face_source: "invented" | "agent" | "upload"; agent_slug: string; approved_id: string | null; approved_url: string | null; pictures: Pic[];
}
interface Product { name: string; what: string; approved_id: string | null; approved_url: string | null; pictures: Pic[] }
interface KitItem { id: string; kind: "character" | "product"; name: string; role: string | null; look: string | null; picture_url: string | null }

const API = "/api/hub-studio-pictures";
const TEXT_FIELDS: { key: keyof Character; text: string; rows: number }[] = [
  { key: "role", text: "Role", rows: 2 },
  { key: "age_range", text: "Age range", rows: 1 },
  { key: "look", text: "Look", rows: 3 },
  { key: "wardrobe", text: "Wardrobe per location", rows: 3 },
  { key: "before_after", text: "Before / After (if any)", rows: 2 },
];
const VIEW_LABEL = { front: "Front view", three_quarter: "Three-quarter view" } as const;

function Pictures({ pics, name, approvedId, busy, ratio, onApprove, onRemove }: {
  pics: Pic[]; name: string; approvedId: string | null; busy: boolean; ratio: string;
  onApprove: (pictureId: string | null) => void; onRemove: (pictureId: string) => void;
}) {
  if (!pics.length) return null;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "0.9rem" }}>
      {pics.map(p => {
        const approved = p.id === approvedId;
        return (
          <figure key={p.id} style={{ margin: 0, width: 170 }}>
            {p.url ? (
              <img src={p.url} alt={`${name}, ${VIEW_LABEL[p.view]}`} style={{ width: "100%", aspectRatio: ratio, objectFit: "cover", borderRadius: 8, border: approved ? `3px solid ${NAVY}` : "1px solid rgba(10,35,66,0.2)" }} />
            ) : <div style={{ ...small, padding: "3rem 0.5rem", textAlign: "center" }}>Picture unavailable</div>}
            <figcaption style={{ ...small, margin: "4px 0" }}>{ratio === "1 / 1" ? "Product" : VIEW_LABEL[p.view]}{p.source === "upload" ? " · uploaded" : p.source === "brand kit" ? " · brand kit" : ""}</figcaption>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ ...btn(!approved, busy), padding: "0.3rem 0.6rem", ...(approved ? { background: NAVY, color: GOLD, border: "none" } : {}) }} disabled={busy} onClick={() => onApprove(approved ? null : p.id)}>
                {approved ? "✓ Approved" : "Approve"}
              </button>
              <button style={{ ...btn(false, busy), padding: "0.3rem 0.6rem" }} disabled={busy} aria-label={`Remove this picture of ${name}`} onClick={() => onRemove(p.id)}>✕</button>
            </div>
          </figure>
        );
      })}
    </div>
  );
}

function CharacterCard({ c, agents, busy, onSave, onGenerate, onUpload, onApprove, onRemovePic, onRemove }: {
  c: Character; agents: Agent[]; busy: boolean;
  onSave: (id: string, fields: Record<string, unknown>) => Promise<boolean>;
  onGenerate: (c: Character) => void;
  onUpload: (c: Character, file: File) => void;
  onApprove: (c: Character, pictureId: string | null) => void;
  onRemovePic: (c: Character, pictureId: string) => void;
  onRemove: (c: Character) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = { name: c.name };
    for (const f of TEXT_FIELDS) d[f.key] = String((c[f.key] as string | null) ?? "");
    return d;
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const withPhoto = agents.filter(a => a.photo_url);

  async function blurSave(key: string, original: unknown) {
    if (String(original ?? "") === draft[key]) return;
    await onSave(c.id, { [key]: draft[key] });
  }

  return (
    <article style={{ ...card, marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <span style={{ ...label, background: "rgba(10,35,66,0.07)", borderRadius: 6, padding: "0.3rem 0.6rem", margin: 0 }}>Character</span>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor={`${c.id}-name`} style={label}>Name</label>
          <input id={`${c.id}-name`} value={draft.name} style={{ ...input, fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700 }}
            onChange={e => setDraft({ ...draft, name: e.target.value })} onBlur={() => blurSave("name", c.name)} />
        </div>
        {c.approved_url ? <span style={{ ...small, color: "#1B6E3C" }}>✓ Reference approved</span> : <span style={small}>No approved reference yet</span>}
        {confirmRemove ? (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...small, color: "#B3261E" }}>Remove {c.name}?</span>
            <button style={{ ...btn(true), background: "#B3261E", color: "#fff", padding: "0.35rem 0.8rem" }} onClick={() => onRemove(c)}>Remove</button>
            <button style={{ ...btn(false), padding: "0.35rem 0.8rem" }} onClick={() => setConfirmRemove(false)}>Cancel</button>
          </span>
        ) : (
          <button style={{ ...btn(false, busy), padding: "0.35rem 0.8rem" }} disabled={busy} onClick={() => setConfirmRemove(true)}>Remove</button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.7rem", marginBottom: "0.9rem" }}>
        {TEXT_FIELDS.map(f => (
          <div key={f.key}>
            <label htmlFor={`${c.id}-${f.key}`} style={label}>{f.text}</label>
            <textarea id={`${c.id}-${f.key}`} rows={f.rows} value={draft[f.key]} style={{ ...input, resize: "vertical" }}
              onChange={e => setDraft({ ...draft, [f.key]: e.target.value })} onBlur={() => blurSave(f.key, c[f.key])} />
          </div>
        ))}
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: "0 0 0.9rem" }}>
        <legend style={label}>Where the face comes from</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          {([["invented", "Invented from the description"], ["agent", "An agent's photo"], ["upload", "My own upload"]] as const).map(([v, t]) => (
            <label key={v} style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: NAVY }}>
              <input type="radio" name={`${c.id}-face`} checked={c.face_source === v} disabled={busy} onChange={() => onSave(c.id, { face_source: v })} />{t}
            </label>
          ))}
          {c.face_source === "agent" && (
            <select aria-label="Agent whose photo is the face" value={c.agent_slug} disabled={busy} onChange={e => onSave(c.id, { agent_slug: e.target.value })} style={{ ...input, width: 260 }}>
              <option value="">Choose an agent…</option>
              {withPhoto.map(a => <option key={a.slug} value={a.slug}>{a.name} — {a.role}</option>)}
            </select>
          )}
        </div>
      </fieldset>

      <Pictures pics={c.pictures} name={c.name} approvedId={c.approved_id} busy={busy} ratio="2 / 3" onApprove={id => onApprove(c, id)} onRemove={id => onRemovePic(c, id)} />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btn(false, busy)} disabled={busy} onClick={() => fileRef.current?.click()}>Upload reference</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(c, f); e.target.value = ""; }} />
        {c.face_source !== "upload" && (
          <button style={btn(true, busy)} disabled={busy} onClick={() => onGenerate(c)}>{busy ? "Working…" : "Generate front + three-quarter"}</button>
        )}
      </div>
    </article>
  );
}

export default function CastStep({ projectId, stepsDone, onChanged, onGoto }: StepProps) {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [scriptWriter, setScriptWriter] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [kit, setKit] = useState<KitItem[] | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const productFile = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=cast&id=${projectId}`);
    if (r.ok) { setCharacters(r.body.characters as Character[]); setProduct(r.body.product as Product); setScriptWriter(r.body.script_writer as string); }
    else setMsg({ kind: "error", text: r.body?.error || `The cast could not be loaded (${r.status}).` });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { callApi("/api/hub-studio?view=writers").then(r => { if (r.ok) setAgents(r.body.agents as Agent[]); }); }, []);
  useEffect(() => { if (showKit && !kit) callApi(`${API}?view=brandkit`).then(r => { if (r.ok) setKit(r.body.kit as KitItem[]); }); }, [showKit, kit]);

  async function post(body: Record<string, unknown>, errorText: string) {
    const r = await callApi(API, { method: "POST", body });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `${errorText} (${r.status}).` });
    return r;
  }

  async function refresh() { await load(); await onChanged(); }

  async function propose() {
    setBusy("propose"); setMsg(null);
    const r = await post({ action: "propose_cast", project_id: projectId }, "The cast could not be listed");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: r.body.added ? `${r.body.added} ${r.body.added === 1 ? "character" : "characters"} added from the script by ${r.body.writer}.` : "Every character in the script is already in the cast." });
    await refresh();
  }

  async function saveCharacter(id: string, fields: Record<string, unknown>): Promise<boolean> {
    const r = await post({ action: "save_character", character_id: id, fields }, "That could not be saved");
    if ("face_source" in fields || "agent_slug" in fields) await load();
    return r.ok;
  }

  async function generate(c: Character) {
    setBusy(c.id); setMsg(null);
    let total = 0, made = 0;
    for (const view of ["front", "three_quarter"] as const) {
      const r = await post({ action: "make_cast_picture", character_id: c.id, view }, "The picture could not be made");
      if (!r.ok) break;
      made++; total += Number(r.body.cost_usd || 0);
    }
    setBusy(null);
    if (made) setMsg({ kind: "ok", text: `Made ${made} ${made === 1 ? "picture" : "pictures"} for ${c.name}. Estimated cost $${total.toFixed(2)}. Approve the one you want.` });
    await refresh();
  }

  async function upload(c: Character, file: File) {
    setBusy(c.id); setMsg(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const view = c.pictures.some(p => p.view === "front") ? "three_quarter" : "front";
      const r = await post({ action: "upload_cast_picture", character_id: c.id, view, data_url: dataUrl }, "The picture could not be uploaded");
      if (r.ok) setMsg({ kind: "ok", text: "Reference uploaded. Approve it to use it." });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "The picture could not be read." });
    }
    setBusy(null);
    await refresh();
  }

  async function approve(c: Character, pictureId: string | null) {
    setBusy(c.id);
    await post({ action: "approve_cast_picture", character_id: c.id, picture_id: pictureId }, "That could not be saved");
    setBusy(null);
    await refresh();
  }

  async function removePic(c: Character, pictureId: string) {
    setBusy(c.id);
    await post({ action: "delete_cast_picture", character_id: c.id, picture_id: pictureId }, "That could not be removed");
    setBusy(null);
    await refresh();
  }

  async function removeCharacter(c: Character) {
    setBusy(c.id);
    await post({ action: "delete_character", character_id: c.id }, "The character could not be removed");
    setBusy(null);
    await refresh();
  }

  async function addBlank() {
    setBusy("add");
    await post({ action: "add_character", project_id: projectId }, "The character could not be added");
    setBusy(null);
    await refresh();
  }

  // Product reference ------------------------------------------------------------------
  async function generateProduct() {
    setBusy("product"); setMsg(null);
    const r = await post({ action: "make_product_picture", project_id: projectId }, "The product picture could not be made");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `Product picture made. Estimated cost $${Number(r.body.cost_usd || 0).toFixed(2)}. Approve it to use it.` });
    await refresh();
  }

  async function uploadProduct(file: File) {
    setBusy("product"); setMsg(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await post({ action: "upload_product_picture", project_id: projectId, data_url: dataUrl }, "The picture could not be uploaded");
      if (r.ok) setMsg({ kind: "ok", text: "Product reference uploaded. Approve it to use it." });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "The picture could not be read." });
    }
    setBusy(null);
    await refresh();
  }

  async function approveProduct(pictureId: string | null) {
    setBusy("product");
    await post({ action: "approve_product_picture", project_id: projectId, picture_id: pictureId }, "That could not be saved");
    setBusy(null);
    await refresh();
  }

  async function removeProductPic(pictureId: string) {
    setBusy("product");
    await post({ action: "delete_product_picture", project_id: projectId, picture_id: pictureId }, "That could not be removed");
    setBusy(null);
    await refresh();
  }

  // Brand kit ------------------------------------------------------------------------------
  async function saveToKit() {
    setBusy("kit"); setMsg(null);
    const r = await post({ action: "save_cast_to_brand_kit", project_id: projectId }, "The brand kit could not be saved");
    setBusy(null);
    if (r.ok) {
      setMsg({ kind: "ok", text: r.body.saved ? `${r.body.saved} ${r.body.saved === 1 ? "item" : "items"} saved to the brand kit.` : (r.body.note as string) });
      setKit(null);
    }
  }

  async function addFromKit(k: KitItem) {
    setBusy("kit");
    const r = await post({ action: "add_from_brand_kit", project_id: projectId, kit_id: k.id }, "That could not be added");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `${k.name} added from the brand kit. No new picture cost.` });
    await refresh();
  }

  async function removeKit(k: KitItem) {
    await post({ action: "delete_brand_kit", kit_id: k.id }, "That could not be removed");
    setKit(null);
  }

  const working = busy !== null;
  const approvedCount = (characters ? characters.filter(c => c.approved_url).length : 0) + (product?.approved_url ? 1 : 0);
  const totalCount = (characters ? characters.length : 0) + 1;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 360px" }}>
          <h2 style={{ ...h2, fontSize: "1.5rem" }}>Cast &amp; references</h2>
          <p style={small}>Approve one reference per character and for the product. Later steps use these exact images.</p>
        </div>
        <button style={btn(false)} onClick={() => onGoto?.("script")}>← Script</button>
        <button style={btn(true)} onClick={() => onGoto?.("audio")}>Audio →</button>
      </div>

      <div style={{ ...card, marginBottom: "1rem", padding: "0.8rem 1.1rem" }}>
        <p style={small}>Pictures are made with your own OpenAI account. You can also upload your own. Every picture shows on the Usage tab.</p>
        {stepsDone.includes("cast") && <p style={{ ...small, color: "#1B6E3C", marginTop: 6 }}>✓ Cast done. Every character and the product have an approved reference.</p>}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
        <button style={btn(true, working)} disabled={working} onClick={propose}>{busy === "propose" ? "Reading the script…" : "Propose missing cast from script"}</button>
        <button style={btn(false, working)} disabled={working} onClick={addBlank}>+ Character</button>
        <span style={small}>{approvedCount} of {totalCount} approved{scriptWriter ? ` · characters are listed by ${scriptWriter}, who wrote the script` : ""}</span>
      </div>
      {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginBottom: "1rem", color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}

      <div style={{ ...card, marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <h2 style={{ ...h2, fontSize: "1rem" }}>Brand kit cast</h2>
            <p style={small}>Save approved characters and the product here to reuse them in your next film for this brand. No new picture cost.</p>
          </div>
          <button style={btn(false, working)} disabled={working} onClick={() => setShowKit(v => !v)}>{showKit ? "Hide brand kit" : "Add from brand kit"}</button>
          <button style={btn(false, working || approvedCount === 0)} disabled={working || approvedCount === 0} onClick={saveToKit}>{busy === "kit" ? "Saving…" : "Save cast to brand kit"}</button>
        </div>
        {showKit && (
          <div style={{ marginTop: "1rem" }}>
            {!kit ? <p style={small}>Loading…</p> : kit.length === 0 ? <p style={small}>Nothing saved yet. Approve pictures, then press Save cast to brand kit.</p> : (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {kit.map(k => (
                  <figure key={k.id} style={{ margin: 0, width: 150 }}>
                    {k.picture_url && <img src={k.picture_url} alt={k.name} style={{ width: "100%", aspectRatio: k.kind === "product" ? "1 / 1" : "2 / 3", objectFit: "cover", borderRadius: 8 }} />}
                    <figcaption style={{ ...small, margin: "4px 0" }}>{k.name}{k.kind === "product" ? " (product)" : ""}</figcaption>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button style={{ ...btn(true, working), padding: "0.3rem 0.6rem" }} disabled={working} onClick={() => addFromKit(k)}>Add</button>
                      <button style={{ ...btn(false, working), padding: "0.3rem 0.6rem" }} disabled={working} aria-label={`Remove ${k.name} from the brand kit`} onClick={() => removeKit(k)}>✕</button>
                    </div>
                  </figure>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {product && (
        <article style={{ ...card, marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: "0.8rem" }}>
            <span style={{ ...label, background: "rgba(10,35,66,0.07)", borderRadius: 6, padding: "0.3rem 0.6rem", margin: 0 }}>Product reference</span>
            <strong style={{ fontFamily: "'Playfair Display', serif", color: NAVY }}>{product.name || "No product name yet"}</strong>
            {product.approved_url ? <span style={{ ...small, color: "#1B6E3C" }}>✓ Reference approved</span> : <span style={small}>No approved reference yet</span>}
          </div>
          {product.what && <p style={{ ...small, marginBottom: "0.8rem" }}>{product.what}</p>}
          <Pictures pics={product.pictures} name={product.name || "Product"} approvedId={product.approved_id} busy={working} ratio="1 / 1" onApprove={approveProduct} onRemove={removeProductPic} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={btn(false, working)} disabled={working} onClick={() => productFile.current?.click()}>Upload reference</button>
            <input ref={productFile} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadProduct(f); e.target.value = ""; }} />
            <button style={btn(true, working || !product.name)} disabled={working || !product.name} onClick={generateProduct}>{busy === "product" ? "Working…" : "Generate product picture"}</button>
          </div>
        </article>
      )}

      {characters === null ? <p style={small}>Loading the cast…</p> : characters.length === 0 ? (
        <p style={small}>No characters yet. Press Propose missing cast from script, add one with + Character, or bring one in from the brand kit.</p>
      ) : characters.map(c => (
        <CharacterCard key={c.id} c={c} agents={agents} busy={busy === c.id || busy === "propose"} onSave={saveCharacter} onGenerate={generate} onUpload={upload}
          onApprove={approve} onRemovePic={removePic} onRemove={removeCharacter} />
      ))}
    </div>
  );
}
