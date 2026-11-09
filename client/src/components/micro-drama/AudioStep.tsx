import { useCallback, useEffect, useRef, useState } from "react";
import { callApi } from "../../lib/adminApi";
import { NAVY, GOLD, btn, card, h2, input, label, small, type StepProps } from "./ui";

// Step 5 — Audio. A voice for each speaker, one recording per scene (each speaker in their own voice), and optional music.
// Playing samples and recordings costs nothing. Making a recording or music track uses ElevenLabs credits.
interface Voice { voice_id: string; name: string; category: string | null; preview_url: string | null; description: string | null }
interface Speaker { key: string; name: string; in_cast: boolean; voice_id: string; voice_name: string }
interface Scene {
  id: string; position: number; length_s: number; lines: { speaker: string; text: string }[]; problem: string | null;
  recording_url: string | null; seconds: number | null; cost_usd: number | null; approved: boolean; stale: boolean;
}
interface Music { prompt: string; instrumental: boolean; source: string; seconds: number | null; cost_usd: number | null; approved: boolean; url: string | null }

const API = "/api/hub-studio-audio";
const money = (n: number | null) => (n === null ? "" : `$${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`);

function fileToAudioDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file could not be read."));
    r.readAsDataURL(file);
  });
}

export default function AudioStep({ projectId, stepsDone, onChanged, onGoto }: StepProps) {
  const [sound, setSound] = useState("");
  const [filmLength, setFilmLength] = useState(0);
  const [speakers, setSpeakers] = useState<Speaker[] | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [music, setMusic] = useState<Music | null>(null);
  const [voices, setVoices] = useState<Voice[] | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [brief, setBrief] = useState("");
  const [instrumental, setInstrumental] = useState(true);
  const briefLoaded = useRef(false);
  const sample = useRef<HTMLAudioElement | null>(null);
  const musicFile = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await callApi(`${API}?view=audio&id=${projectId}`);
    if (!r.ok) { setMsg({ kind: "error", text: r.body?.error || `The audio step could not be loaded (${r.status}).` }); return; }
    setSound(r.body.sound as string); setFilmLength(Number(r.body.length_s || 0));
    setSpeakers(r.body.speakers as Speaker[]); setScenes(r.body.scenes as Scene[]);
    const m = r.body.music as Music | null;
    setMusic(m);
    if (!briefLoaded.current) { briefLoaded.current = true; setBrief(m?.prompt || ""); setInstrumental(m ? m.instrumental : true); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    callApi("/api/hub-elevenlabs").then(r => {
      if (r.ok) setVoices(r.body.voices as Voice[]);
      else { setVoices([]); setVoiceError(r.body?.error || `Your ElevenLabs voices could not be loaded (${r.status}).`); }
    });
  }, []);
  useEffect(() => () => { sample.current?.pause(); }, []);

  async function post(body: Record<string, unknown>, errorText: string) {
    const r = await callApi(API, { method: "POST", body });
    if (!r.ok) setMsg({ kind: "error", text: r.body?.error || `${errorText} (${r.status}).` });
    return r;
  }
  async function refresh() { await load(); await onChanged(); }

  function playSample(v: Voice | undefined) {
    if (!v?.preview_url) return;
    sample.current?.pause();
    sample.current = new Audio(v.preview_url);
    sample.current.play().catch(() => setMsg({ kind: "error", text: "The sample could not be played in this browser." }));
  }

  async function chooseVoice(s: Speaker, voiceId: string) {
    const v = voices?.find(x => x.voice_id === voiceId);
    setSpeakers(list => (list || []).map(x => (x.key === s.key ? { ...x, voice_id: voiceId, voice_name: v?.name || "" } : x)));
    await post({ action: "save_voice", project_id: projectId, speaker: s.name, voice_id: voiceId, voice_name: v?.name || "" }, "The voice could not be saved");
  }

  async function makeRecording(s: Scene) {
    setBusy(s.id); setMsg(null);
    const r = await post({ action: "make_recording", scene_id: s.id }, "The recording could not be made");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `Scene ${s.position} recorded (about ${r.body.seconds} s). Estimated cost ${money(Number(r.body.cost_usd || 0))}. Play it, then approve it.` });
    await refresh();
  }

  async function sceneAction(s: Scene, action: "approve_recording" | "delete_recording", approved?: boolean) {
    setBusy(s.id);
    await post({ action, scene_id: s.id, approved }, "That could not be saved");
    setBusy(null);
    await refresh();
  }

  async function saveBrief() {
    if (briefLoaded.current) await post({ action: "save_music_brief", project_id: projectId, prompt: brief, instrumental }, "The music description could not be saved");
  }

  async function makeMusic() {
    setBusy("music"); setMsg(null);
    const r = await post({ action: "make_music", project_id: projectId, prompt: brief, instrumental }, "The music could not be made");
    setBusy(null);
    if (r.ok) setMsg({ kind: "ok", text: `Music made. Estimated cost ${money(Number(r.body.cost_usd || 0))}. Play it, then approve it.` });
    await refresh();
  }

  async function uploadMusic(file: File) {
    setBusy("music"); setMsg(null);
    try {
      const dataUrl = await fileToAudioDataUrl(file);
      const r = await post({ action: "upload_music", project_id: projectId, data_url: dataUrl }, "The music could not be uploaded");
      if (r.ok) setMsg({ kind: "ok", text: "Music uploaded. Play it, then approve it." });
    } catch (e: any) {
      setMsg({ kind: "error", text: e?.message || "That file could not be read." });
    }
    setBusy(null);
    await refresh();
  }

  async function musicAction(action: "approve_music" | "delete_music", approved?: boolean) {
    setBusy("music");
    await post({ action, project_id: projectId, approved }, "That could not be saved");
    setBusy(null);
    await refresh();
  }

  const working = busy !== null;
  const spoken = scenes.filter(s => s.lines.length > 0);
  const approvedCount = spoken.filter(s => s.approved && !s.stale).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "1rem" }}>
        <div style={{ flex: "1 1 360px" }}>
          <h2 style={{ ...h2, fontSize: "1.5rem" }}>Audio</h2>
          <p style={small}>Choose a voice for each speaker, make one recording per scene, and approve each one. Later steps use these exact recordings.</p>
        </div>
        <button style={btn(false)} onClick={() => onGoto?.("cast")}>← Cast</button>
        <button style={btn(true)} onClick={() => onGoto?.("storyboard")}>Storyboard →</button>
      </div>

      <div style={{ ...card, marginBottom: "1rem", padding: "0.8rem 1.1rem" }}>
        <p style={small}>Playing a voice sample or a recording is free. Making a recording or a music track uses ElevenLabs credits, and the estimated cost shows on each card and on the Usage tab. Commercial use of ElevenLabs audio needs a paid ElevenLabs plan.</p>
        {stepsDone.includes("audio") && <p style={{ ...small, color: "#1B6E3C", marginTop: 6 }}>✓ Audio done. Every scene with spoken lines has an approved recording.</p>}
      </div>
      {msg && <p role={msg.kind === "error" ? "alert" : "status"} style={{ ...small, marginBottom: "1rem", color: msg.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{msg.text}</p>}
      {sound === "song" && (
        <p role="status" style={{ ...small, marginBottom: "1rem" }}>This film's sound is set to song. Sung lyrics are coming in the next part of this step. For now, add a music track below, or make one in Suno and upload it.</p>
      )}

      <div style={{ ...card, marginBottom: "1rem" }}>
        <h2 style={{ ...h2, fontSize: "1rem" }}>Voices</h2>
        {voiceError && <p role="alert" style={{ ...small, color: "#B3261E" }}>{voiceError}</p>}
        {speakers === null ? <p style={small}>Loading…</p> : speakers.length === 0 ? (
          <p style={small}>No speakers yet. Spoken lines appear here once the script has them, each starting with the speaker's name and a colon.</p>
        ) : speakers.map(s => (
          <div key={s.key} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "0.6rem 0" }}>
            <div style={{ flex: "0 0 160px", fontFamily: "'Playfair Display', serif", fontWeight: 700, color: NAVY }}>
              {s.name}{s.in_cast ? "" : <span style={{ ...small, fontFamily: "'Inter', sans-serif", fontWeight: 400 }}> (not in cast)</span>}
            </div>
            <label htmlFor={`voice-${s.key}`} style={{ ...label, margin: 0 }}>Voice</label>
            <select id={`voice-${s.key}`} value={s.voice_id} disabled={voices === null} onChange={e => chooseVoice(s, e.target.value)} style={{ ...input, width: 280 }}>
              <option value="">{voices === null ? "Loading voices…" : "Choose a voice…"}</option>
              {s.voice_id && !voices?.some(v => v.voice_id === s.voice_id) && <option value={s.voice_id}>{s.voice_name || s.voice_id}</option>}
              {(voices || []).map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}{v.description ? ` — ${v.description}` : ""}</option>)}
            </select>
            <button style={btn(false, !voices?.find(v => v.voice_id === s.voice_id)?.preview_url)} disabled={!voices?.find(v => v.voice_id === s.voice_id)?.preview_url}
              onClick={() => playSample(voices?.find(v => v.voice_id === s.voice_id))}>▶ Play sample</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 0.6rem" }}>
        <h2 style={{ ...h2, fontSize: "1.1rem" }}>Scene recordings</h2>
        <span style={small}>{spoken.length ? `${approvedCount} of ${spoken.length} approved` : ""}</span>
      </div>
      {scenes.length === 0 ? <p style={small}>No scenes yet. Write the script first.</p> : scenes.map(s => {
        const over = s.seconds !== null && s.length_s > 0 && s.seconds > s.length_s + 0.5;
        return (
          <article key={s.id} style={{ ...card, marginBottom: "0.8rem" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <strong style={{ fontFamily: "'Playfair Display', serif", color: NAVY }}>Scene {s.position}</strong>
              <span style={small}>{s.length_s ? `${s.length_s} s` : ""}</span>
              {s.approved && !s.stale && <span style={{ ...small, color: "#1B6E3C" }}>✓ Approved</span>}
            </div>
            {s.problem ? <p role="alert" style={{ ...small, color: "#B3261E" }}>{s.problem}</p> : s.lines.length === 0 ? (
              <p style={small}>No spoken lines in this scene.</p>
            ) : (
              <>
                <ul style={{ margin: "0 0 0.7rem", paddingLeft: "1.1rem", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: NAVY }}>
                  {s.lines.map((l, i) => <li key={i}><strong>{l.speaker}:</strong> {l.text}</li>)}
                </ul>
                {s.stale && <p role="alert" style={{ ...small, color: "#B3261E", marginBottom: 6 }}>The lines changed on the Script step after this was recorded. Make the recording again.</p>}
                {s.recording_url && <audio controls src={s.recording_url} style={{ width: "100%", maxWidth: 420, marginBottom: 6 }} aria-label={`Recording for scene ${s.position}`} />}
                {s.seconds !== null && (
                  <p style={{ ...small, color: over ? "#B3261E" : undefined, marginBottom: 6 }}>
                    About {s.seconds} s{s.length_s ? ` of ${s.length_s} s` : ""}{over ? " — longer than the scene. Shorten the lines on the Script step and re-make it." : ""}
                    {s.cost_usd !== null ? ` · estimated cost ${money(s.cost_usd)}` : ""}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={btn(!s.recording_url, working)} disabled={working} onClick={() => makeRecording(s)}>{busy === s.id ? "Working…" : s.recording_url ? "Re-make recording" : "Make recording"}</button>
                  {s.recording_url && (
                    <button style={{ ...btn(!s.approved, working), ...(s.approved ? { background: NAVY, color: GOLD, border: "none" } : {}) }} disabled={working} onClick={() => sceneAction(s, "approve_recording", !s.approved)}>
                      {s.approved ? "✓ Approved" : "Approve"}
                    </button>
                  )}
                  {s.recording_url && <button style={btn(false, working)} disabled={working} onClick={() => sceneAction(s, "delete_recording")}>Remove</button>}
                </div>
              </>
            )}
          </article>
        );
      })}

      <div style={{ ...card, marginTop: "1rem" }}>
        <h2 style={{ ...h2, fontSize: "1rem" }}>Background music (optional)</h2>
        <p style={{ ...small, marginBottom: "0.7rem" }}>Describe the music in your own words. It is made as long as the film{filmLength ? ` (${filmLength} s)` : ""}. You can also make a song in Suno and upload the file.</p>
        <label htmlFor="music-brief" style={label}>Describe the music</label>
        <textarea id="music-brief" rows={3} value={brief} maxLength={4100} style={{ ...input, resize: "vertical", marginBottom: "0.6rem" }}
          onChange={e => setBrief(e.target.value)} onBlur={saveBrief} />
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: NAVY, marginBottom: "0.8rem" }}>
          <input type="checkbox" checked={instrumental} onChange={e => setInstrumental(e.target.checked)} onBlur={saveBrief} /> Instrumental (no singing)
        </label>
        {music?.url && <audio controls src={music.url} style={{ width: "100%", maxWidth: 420, marginBottom: 6 }} aria-label="Background music" />}
        {music?.url && (
          <p style={{ ...small, marginBottom: 6 }}>
            {music.source === "upload" ? "Uploaded track" : `Made by ElevenLabs${music.seconds ? `, ${music.seconds} s` : ""}`}
            {music.cost_usd !== null ? ` · estimated cost ${money(music.cost_usd)}` : ""}
            {music.approved ? " · ✓ Approved" : ""}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btn(!music?.url, working || !brief.trim())} disabled={working || !brief.trim()} onClick={makeMusic}>{busy === "music" ? "Working…" : music?.url ? "Re-make music" : "Make music"}</button>
          <button style={btn(false, working)} disabled={working} onClick={() => musicFile.current?.click()}>Upload music</button>
          <input ref={musicFile} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadMusic(f); e.target.value = ""; }} />
          {music?.url && (
            <button style={{ ...btn(!music.approved, working), ...(music.approved ? { background: NAVY, color: GOLD, border: "none" } : {}) }} disabled={working} onClick={() => musicAction("approve_music", !music.approved)}>
              {music.approved ? "✓ Approved" : "Approve"}
            </button>
          )}
          {music?.url && <button style={btn(false, working)} disabled={working} onClick={() => musicAction("delete_music")}>Remove</button>}
        </div>
        <p style={{ ...small, marginTop: 8 }}>Uploads work up to 3 MB (about a 2-minute MP3).</p>
      </div>
    </div>
  );
}
