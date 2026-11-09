import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import WriterPicker from "./WriterPicker";
import { NAVY, btn, card, h2, input, label, small, fileToDataUrl, type Agent, type StepProps } from "./ui";

// Step 4 — Cast. A card per character, a face source (invented, agent photo or upload), a front and a
// three-quarter picture to approve, and a brand kit of characters saved for other projects.
interface Pic { id: string; view: "front" | "three_quarter"; source: string; url: string | null }
interface Character {
  id: string; name: string; role: string | null; age_range: string | null; look: string | null; wardrobe: string | null; before_after: string | null;
  face_source: "invented" | "agent" | "upload"; agent_slug: string; approved_id: string | null; approved_url: string | null; pictures: Pic[];
}
interface KitItem { id: string; name: string; role: string | null; look: string | null; picture_url: string | null }

const API = "/api/hub-studio-pictures";
const TEXT_FIELDS: { key: keyof Character; text: string; rows: number }[] = [
  { key: "role", text: "Role", rows: 2 },
  { key: "age_range", text: "Age range", rows: 1 },
  { key: "look", text: "Look", rows: 3 },
  { key: "wardrobe", text: "Wardrobe", rows: 3 },
  { key: "before_after", text: "How they change", rows: 2 },
];
const VIEW_LABEL = { front: "Front view", three_quarter: "Three-quarter view" } as const;

function CharacterCard({ c, agents, busy, onSave, onRun, onUpload, onApprove, onRemovePic, onKit, onDelete }: {
  c: Character; agents: Agent[]; busy: boolean;
  onSave: (id: string, fields: Record<string, unknown>) => Promise<boolean>;
  onRun: (c: Character, views: ("front" | "three_quarter")[]) => void;
  onUpload: (c: Character, view: "front" | "three_quarter", file: File) => void;
  onApprove: (c: Character, pictureId: string | null) => void;
  onRemovePic: (c: Character, pictureId: string) => void;
  onKit: (c: Character) => void;
  onDelete: (c: Character) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = { name: c.name };
    for (const f of TEXT_FIELDS) d[f.key] = String((c[f.key] as string | null) ?? "");
    return d;
  });
  const [uploadView, setUploadView] = useState<"front" | "three_quarter">("front");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasFront = c.pictures.some(p => p.view === "front");
  const withPhoto = agents.filter(a => a.photo_url);

  async function blurSave(key: string, original: unknown) {
    if (String(original ?? "") === draft[key]) return;
    await onSave(c.id, { [key]: draft[key] });
  }

  return (
    <article style={{ ...card, marginBottom: "1rem" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor={`${c.id}-name`} style={label}>Name</label>
          <input id={`${c.id}-name`} value={draft.name} style={{ ...input, fontFamily: "'Playfair Display', serif", fontSize: "1.05rem", fontWeight: 700 }}
            onChange={e => setDraft({ ...draft, name: e.target.value })} onBlur={() => blurSave("name", c.name)} />
        </div>
        {c.approved_url ? <span style={{ ...small, color: "#1B6E3C" }}>✓ Picture approved</span> : <span style={small}>No approved picture yet</span>}
        {confirmDelete ? (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ ...small, color: "#B3261E" }}>Delete {c.name}?</span>
            <button style={{ ...btn(true), background: "#B3261E", color: "#fff", padding: "0.35rem 0.8rem" }} onClick={() => onDelete(c)}>Delete</button>
            <button style={{ ...btn(false), padding: "0.35rem 0.8rem" }} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </span>
        ) : (
          <button style={{ ...btn(false, busy), padding: "0.35rem 0.8rem" }} disabled={busy} onClick={() => setConfirmDelete(true)}>Delete</button>
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

      {c.pictures.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: "0.9rem" }}>
          {c.pictures.map(p => {
            const approved = p.id === c.approved_id;
            return (
              <figure key={p.id} style={{ margin: 0, width: 170 }}>
                {p.url ? (
                  <img src={p.url} alt={`${c.name}, ${VIEW_LABEL[p.view]}`} style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 8, border: approved ? `3px solid ${NAVY}` : "1px solid rgba(10,35,66,0.2)" }} />
                ) : <div style={{ ...small, padding: "3rem 0.5rem", textAlign: "center" }}>Picture unavailable</div>}
                <figcaption style={{ ...small, margin: "4px 0" }}>{VIEW_LABEL[p.view]}{p.source === "upload" ? " · uploaded" : p.source === "brand kit" ? " · brand kit" : ""}</figcaption>
                <div style={{ display: "flex", gap: 4 }}>
                  <button style={{ ...btn(!approved, busy), padding: "0.3rem 0.6rem", ...(approved ? { background: NAVY, color: "#D4AF37", border: "none" } : {}) }} disabled={busy} onClick={() => onApprove(c, approved ? null : p.id)}>
                    {approved ? "✓ Approved" : "Approve"}
                  </button>
                  <button style={{ ...btn(false, busy), padding: "0.3rem 0.6rem" }} disabled={busy} aria-label={`Remove this ${VIEW_LABEL[p.view]} of ${c.name}`} onClick={() => onRemovePic(c, p.id)}>✕</button>
                </div>
              </figure>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {c.face_source !== "upload" && (
          <>
            <button style={btn(true, busy)} disabled={busy} onClick={() => onRun(c, hasFront ? ["three_quarter"] : ["front", "three_quarter"])}>
              {busy ? "Working…" : hasFront ? "Make three-quarter view" : "Make pictures"}
            </button>
            {hasFront && <button style={btn(false, busy)} disabled={busy} onClick={() => onRun(c, ["front"])}>New front view</button>}
          </>
        )}
        <select aria-label="Which view to upload" value={uploadView} onChange={e => setUploadView(e.target.value as "front" | "three_quarter")} style={{ ...input, width: 170 }}>
          <option value="front">Front view</option>
          <option value="three_quarter">Three-quarter view</option>
        </select>
        <button style={btn(false, busy)} disabled={busy} onClick={() => fileRef.current?.click()}>Upload picture</button>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(c, uploadView, f); e.target.value = ""; }} />
        <button style={btn(false, busy || !c.approved_url)} disabled={busy || !c.approved_url} title={c.approved_url ? undefined : "Approve a picture first"} onClick={() => onKit(c)}>Save to brand kit</button>
      </div>
    </article>
  );
}

export default function CastStep({ projectId, stepsDone, onChanged }: StepProps) {
  const [characters, setCharacters] = useState<Character[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [kit, setKit] = useState<KitItem[] | null>(null);
  const [showKit, setShowKit] = useState(false);
  const [writer, setWriter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=cast&id=${projectId}`);
    if (r.ok) setCharacters(r.body.characters as Character[]);
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
    if (!writer) { setMsg({ kind: "error", text: "Choose a writer first." }); return; }
    setBusy("propose"); setMsg(null);
    const r = await post({ action: "propose_cast", project_id: projectId, writer }, "The writer could not finish");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: r.body.added ? `${r.body.added} ${r.body.added === 1 ? "character" : "characters"} added from the script.` : "Every character in the script is already in the cast." });
    await refresh();
  }

  async function saveCharacter(id: string, fields: Record<string, unknown>): Promise<boolean> {
    const r = await post({ action: "save_character", character_id: id, fields }, "That could not be saved");
    if ("face_source" in fields || "agent_slug" in fields) await load();
    return r.ok;
  }

  async function run(c: Character, views: ("front" | "three_quarter")[]) {
    setBusy(c.id); setMsg(null);
    let total = 0, made = 0;
    for (const view of views) {
      const r = await post({ action: "make_cast_picture", character_id: c.id, view }, "The picture could not be made");
      if (!r.ok) break;
      made++; total += Number(r.body.cost_usd || 0);
    }
    setBusy(null);
    if (made) setMsg({ kind: "ok", text: `Made ${made} ${made === 1 ? "picture" : "pictures"} for ${c.name}. Estimated cost $${total.toFixed(2)}. Approve the one you want.` });
    await refresh();
  }

  async function upload(c: Character, view: "front" | "three_quarter", file: File) {
    setBusy(c.id); setMsg(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await post({ action: "upload_cast_picture", character_id: c.id, view, data_url: dataUrl }, "The picture could not be uploaded");
      if (r.ok) setMsg({ kind: "ok", text: "Picture uploaded. Approve it to use it." });
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

  async function toKit(c: Character) {
    setBusy(c.id); setMsg(null);
    const r = await post({ action: "save_to_brand_kit", character_id: c.id }, "The brand kit could not be saved");
    setBusy(null);
    if (r.ok) { setMsg({ kind: "ok", text: `${c.name} is saved in the brand kit.` }); setKit(null); }
  }

  async function remove(c: Character) {
    setBusy(c.id);
    await post({ action: "delete_character", character_id: c.id }, "The character could not be deleted");
    setBusy(null);
    await refresh();
  }

  async function addBlank() {
    setBusy("add");
    await post({ action: "add_character", project_id: projectId }, "The character could not be added");
    setBusy(null);
    await refresh();
  }

  async function addFromKit(k: KitItem) {
    setBusy("add");
    const r = await post({ action: "add_from_brand_kit", project_id: projectId, kit_id: k.id }, "The character could not be added");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `${k.name} added from the brand kit.` });
    await refresh();
  }

  async function removeKit(k: KitItem) {
    await post({ action: "delete_brand_kit", kit_id: k.id }, "That could not be removed");
    setKit(null);
  }

  const working = busy !== null;
  const approvedCount = characters ? characters.filter(c => c.approved_url).length : 0;

  return (
    <div>
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Cast</h2>
        <p style={{ ...small, marginBottom: "1rem" }}>
          Each character needs one approved picture. Pictures are made by OpenAI and billed to your OpenAI API account; every one shows on the Usage tab.
        </p>
        {stepsDone.includes("cast") && <p style={{ ...small, color: "#1B6E3C", marginBottom: "0.8rem" }}>✓ Cast done. Every character has an approved picture.</p>}
        <div style={{ maxWidth: 420, marginBottom: "0.9rem" }}>
          <WriterPicker id="md-cast-writer" value={writer} onChange={setWriter} disabled={working} />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btn(true, working || !writer)} disabled={working || !writer} onClick={propose}>{busy === "propose" ? "Reading the script…" : "Propose the cast from the script"}</button>
          <button style={btn(false, working)} disabled={working} onClick={addBlank}>+ Add a character</button>
          <button style={btn(false, working)} disabled={working} onClick={() => setShowKit(v => !v)}>{showKit ? "Hide brand kit" : "Add from brand kit"}</button>
          {characters && characters.length > 0 && <span style={small}>{approvedCount} of {characters.length} approved</span>}
        </div>
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginTop: 10, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}
      </div>

      {showKit && (
        <div style={{ ...card, marginBottom: "1rem" }}>
          <h2 style={h2}>Brand kit</h2>
          {!kit ? <p style={small}>Loading…</p> : kit.length === 0 ? <p style={small}>No saved characters yet. Use "Save to brand kit" on a character with an approved picture.</p> : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {kit.map(k => (
                <figure key={k.id} style={{ margin: 0, width: 150 }}>
                  {k.picture_url && <img src={k.picture_url} alt={k.name} style={{ width: "100%", aspectRatio: "2 / 3", objectFit: "cover", borderRadius: 8 }} />}
                  <figcaption style={{ ...small, margin: "4px 0" }}>{k.name}</figcaption>
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

      {characters === null ? <p style={small}>Loading the cast…</p> : characters.length === 0 ? (
        <p style={small}>No characters yet. Propose the cast from the script, add one, or bring one in from the brand kit.</p>
      ) : characters.map(c => (
        <CharacterCard key={c.id} c={c} agents={agents} busy={busy === c.id || busy === "propose"} onSave={saveCharacter} onRun={run} onUpload={upload}
          onApprove={approve} onRemovePic={removePic} onKit={toKit} onDelete={remove} />
      ))}
    </div>
  );
}
