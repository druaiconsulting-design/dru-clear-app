import { useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import WriterPicker from "./WriterPicker";
import { NAVY, GOLD, btn, card, chip, h2, input, label, small, type StepProps, type StoryCard } from "./ui";

// Step 2 — Story. A writer proposes story ideas as cards; DeAnna picks one.
export default function StoryStep({ projectId, settings, onChanged }: StepProps) {
  const story = settings?.story || {};
  const options: StoryCard[] = Array.isArray(story.options) ? story.options : [];
  const chosenId: string | undefined = story.chosen?.id;
  const hasProduct = !!(settings?.product?.name && settings?.product?.what);

  const [writer, setWriter] = useState("");
  const [ownIdea, setOwnIdea] = useState<string>(story.own_idea || "");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [filter, setFilter] = useState("All");
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const SR: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;

  async function ask(mode: "new" | "more" | "more_dramatic" | "another", baseId?: string) {
    if (!writer) { setMsg({ kind: "error", text: "Choose a writer first." }); return; }
    setBusy(mode + (baseId || ""));
    setMsg(null);
    const r = await callApi("/api/hub-studio-writer", { method: "POST", body: { action: "story_ideas", project_id: projectId, writer, mode, base_id: baseId, own_idea: ownIdea } });
    setBusy(null);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The writer could not finish (${r.status}).` }); return; }
    setFilter("All");
    await onChanged();
  }

  async function tidy() {
    if (!ownIdea.trim()) return;
    setBusy("clean");
    setMsg(null);
    const r = await callApi("/api/hub-studio-writer", { method: "POST", body: { action: "clean_up", project_id: projectId, text: ownIdea } });
    setBusy(null);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The clean-up could not finish (${r.status}).` }); return; }
    setOwnIdea(r.body.text as string);
    await saveIdea(r.body.text as string);
  }

  async function saveIdea(text: string) {
    if (text === (story.own_idea || "")) return;
    await callApi("/api/hub-studio", { method: "POST", body: { action: "save_settings", id: projectId, patch: { own_idea: text } } });
  }

  async function choose(c: StoryCard) {
    setBusy("choose" + c.id);
    setMsg(null);
    const r = await callApi("/api/hub-studio", { method: "POST", body: { action: "choose_story", id: projectId, story_id: c.id } });
    setBusy(null);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The story could not be saved (${r.status}).` }); return; }
    setMsg({ kind: "ok", text: "Story chosen. The Script step is next." });
    await onChanged();
  }

  function dictate() {
    if (!SR) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      let said = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) said += e.results[i][0].transcript;
      if (said) setOwnIdea(prev => (prev ? prev.replace(/\s*$/, " ") : "") + said.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const categories = ["All", ...Array.from(new Set(options.map(o => o.category)))];
  const shown = filter === "All" ? options : options.filter(o => o.category === filter);
  const working = busy !== null;

  if (!hasProduct) {
    return (
      <div style={card}>
        <h2 style={h2}>Story</h2>
        <p style={small}>Fill in the product name and what it is on the Product step first. The writers build every story from those details.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={h2}>Story</h2>
        <p style={{ ...small, marginBottom: "1rem" }}>Choose a writer and ask for story ideas. Add your own idea below if you have one; the writer builds on it.</p>
        <div style={{ maxWidth: 420, marginBottom: "1rem" }}>
          <WriterPicker id="md-story-writer" value={writer} onChange={setWriter} disabled={working} />
        </div>

        <label htmlFor="md-own-idea" style={label}>Your own story idea (optional)</label>
        <textarea id="md-own-idea" rows={4} value={ownIdea} onChange={e => setOwnIdea(e.target.value)} onBlur={() => saveIdea(ownIdea)} style={{ ...input, resize: "vertical" }}
          placeholder="Tell us your own story, type it or dictate it." />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "0.6rem 0 1rem" }}>
          {SR && <button style={btn(false, working)} disabled={working} onClick={dictate}>{listening ? "■ Stop dictating" : "🎤 Dictate"}</button>}
          <button style={btn(false, working || !ownIdea.trim())} disabled={working || !ownIdea.trim()} onClick={tidy}>{busy === "clean" ? "Cleaning up…" : "Clean it up"}</button>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={btn(true, working || !writer)} disabled={working || !writer} onClick={() => ask("new")}>
            {busy === "new" ? "Writing…" : options.length ? "Write new story ideas" : "Write story ideas"}
          </button>
          {options.length > 0 && (
            <button style={btn(false, working || !writer)} disabled={working || !writer} onClick={() => ask("more")}>{busy === "more" ? "Writing…" : "Show three more"}</button>
          )}
          {working && <span style={small}>The writer is working. This can take up to a minute.</span>}
        </div>
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginTop: 10, color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}
      </div>

      {options.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0.8rem" }} role="group" aria-label="Filter stories by category">
            {categories.map(c => <button key={c} style={chip(filter === c)} onClick={() => setFilter(c)}>{c}</button>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
            {shown.map(c => {
              const isChosen = c.id === chosenId;
              return (
                <article key={c.id} style={{ ...card, border: isChosen ? `2px solid ${NAVY}` : card.border, display: "flex", flexDirection: "column" }}>
                  <span style={{ alignSelf: "flex-start", fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: NAVY, background: "rgba(212,175,55,0.2)", borderRadius: 999, padding: "0.2rem 0.6rem" }}>{c.category}</span>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.05rem", margin: "0.6rem 0 0.3rem" }}>{c.title}</h3>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", color: "rgba(10,35,66,0.8)", lineHeight: 1.5, margin: "0 0 0.8rem", flex: 1 }}>{c.summary}</p>
                  {c.writer && <p style={{ ...small, marginBottom: 8 }}>Written by {c.writer}</p>}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button style={{ ...btn(!isChosen, working), ...(isChosen ? { color: GOLD, background: NAVY, border: "none" } : {}) }} disabled={working} onClick={() => choose(c)}>
                      {isChosen ? "✓ Chosen" : busy === "choose" + c.id ? "Saving…" : "Choose this story"}
                    </button>
                    <button style={btn(false, working || !writer)} disabled={working || !writer} title={writer ? undefined : "Choose a writer first"} onClick={() => ask("more_dramatic", c.id)}>
                      {busy === "more_dramatic" + c.id ? "Writing…" : "More dramatic"}
                    </button>
                    <button style={btn(false, working || !writer)} disabled={working || !writer} title={writer ? undefined : "Choose a writer first"} onClick={() => ask("another", c.id)}>
                      {busy === "another" + c.id ? "Writing…" : "Another version"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
