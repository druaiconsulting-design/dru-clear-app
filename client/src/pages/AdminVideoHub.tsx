import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "../components/AdminLayout";

// ─── Video Hub ────────────────────────────────────────────────────────────────
// Originals live in the private Supabase bucket `hub-videos` (admin login only).
// Each video (or voice-over) has one row in `video_hub_items`. Copies go to Bunny on request.
// Sections: Travis's Videos (HeyGen, with HeyGen or ElevenLabs voices), manual upload, and the shelf.

const BUCKET = "hub-videos";

type VideoType = "micro_drama" | "course" | "social" | "other";

interface HubItem {
  id: string;
  title: string;
  video_type: VideoType;
  source: string;
  length_seconds: number | null;
  aspect_ratio: string | null;
  storage_path: string;
  file_name: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  bunny_copies: BunnyCopy[] | null;
  script_text: string | null;
  provider_video_id: string | null;
  error_detail: string | null;
}

type Destination = "social" | "course" | "members";

interface BunnyCopy {
  destination: Destination;
  library_id: string;
  bunny_video_id: string;
  sent_at: string;
}

const DEST_LABEL: Record<Destination, string> = {
  social: "Social",
  course: "Course",
  members: "Members",
};

const TYPE_LABEL: Record<VideoType, string> = {
  micro_drama: "Micro drama",
  course: "Course",
  social: "Social",
  other: "Other",
};

const SOURCE_LABEL: Record<string, string> = {
  upload: "Manual upload",
  higgsfield: "Higgsfield",
  heygen: "HeyGen",
  elevenlabs: "ElevenLabs",
};

const NAVY = "#0A2342";
const GOLD = "#D4AF37";

function isAudio(item: { mime_type: string | null }): boolean {
  return !!item.mime_type && item.mime_type.startsWith("audio/");
}

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function formatLength(s: number | null): string {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")} min`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

// Match the common sizes; otherwise show the reduced ratio.
function aspectLabel(w: number, h: number): string {
  if (!w || !h) return "";
  const r = w / h;
  const known: [string, number][] = [
    ["16:9", 16 / 9], ["9:16", 9 / 16], ["1:1", 1], ["4:3", 4 / 3], ["3:4", 3 / 4], ["21:9", 21 / 9],
  ];
  for (const [label, val] of known) if (Math.abs(r - val) < 0.03) return label;
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

// Read length and size from the file itself, in the browser.
function readVideoMeta(file: File): Promise<{ seconds: number | null; aspect: string }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    const done = (seconds: number | null, aspect: string) => {
      URL.revokeObjectURL(url);
      resolve({ seconds, aspect });
    };
    v.onloadedmetadata = () => done(isFinite(v.duration) ? v.duration : null, aspectLabel(v.videoWidth, v.videoHeight));
    v.onerror = () => done(null, "");
    v.src = url;
  });
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

interface ApiResult { ok: boolean; status: number; body: any }

// Calls one of the app's own backend routes with the signed-in admin token.
async function callApi(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, status: 401, body: { error: "You are signed out. Sign in again and retry." } };
  const res = await fetch(path, {
    method: init?.method || "GET",
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  let body: any = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  return { ok: res.ok && body?.ok !== false, status: res.status, body };
}

interface Choice { id: string; label: string }
interface AgentChoice { id: string; name: string; role: string | null; photo_url: string }
interface VoiceChoice { voice_id: string; name: string; category: string | null; preview_url?: string | null; description?: string | null }

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "9:16", label: "Vertical (9:16)" },
  { value: "16:9", label: "Horizontal (16:9)" },
  { value: "1:1", label: "Square (1:1)" },
];
const VOICE_OVER_LIMIT = 10000;

// Upload with real progress (supabase-js standard upload has no progress callback).
function uploadWithProgress(
  path: string,
  file: File,
  token: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const base = import.meta.env.VITE_SUPABASE_URL as string;
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", anon);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        msg = body.message || body.error || msg;
      } catch { /* keep default */ }
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error("The connection dropped during the upload."));
    xhr.send(file);
  });
}

export default function AdminVideoHub() {
  const [items, setItems] = useState<HubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [videoType, setVideoType] = useState<VideoType>("micro_drama");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sending, setSending] = useState<{ id: string; dest: Destination } | null>(null);
  const [sendMenuId, setSendMenuId] = useState<string | null>(null);

  // Travis's Videos (HeyGen)
  const [tvAgents, setTvAgents] = useState<AgentChoice[]>([]);
  const [tvVoices, setTvVoices] = useState<Choice[]>([]);
  const [tvLoadError, setTvLoadError] = useState<string | null>(null);
  const [tvNotes, setTvNotes] = useState<string[]>([]);
  const [tvTitle, setTvTitle] = useState("");
  const [tvType, setTvType] = useState<VideoType>("micro_drama");
  const [tvSize, setTvSize] = useState("9:16");
  const [tvAvatar, setTvAvatar] = useState("");
  const [tvVoice, setTvVoice] = useState("");
  const [tvScript, setTvScript] = useState("");
  const [tvConfirm, setTvConfirm] = useState(false);
  const [tvBusy, setTvBusy] = useState(false);
  const [tvMessage, setTvMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [tvCheckNote, setTvCheckNote] = useState<string | null>(null);

  // ElevenLabs voices (offered in Travis's Videos)
  const [voVoices, setVoVoices] = useState<VoiceChoice[]>([]);
  const [voLoadError, setVoLoadError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from("video_hub_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
      setLoadError(null);
      setItems((data || []) as HubItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Load the avatar/voice choices and the ElevenLabs voices once.
  useEffect(() => {
    (async () => {
      const hg = await callApi("/api/hub-heygen");
      if (hg.ok) {
        const agents: AgentChoice[] = hg.body.agents || [];
        const voices: Choice[] = hg.body.voices || [];
        setTvAgents(agents);
        setTvVoices(voices);
        setTvNotes(hg.body.notes || []);
        setTvAvatar(a => a || agents[0]?.id || "");
        setTvVoice(v => v || (voices[0] ? `hg:${voices[0].id}` : ""));
      } else {
        setTvLoadError(hg.body?.error || `HeyGen options could not be loaded (${hg.status}).`);
      }
      const el = await callApi("/api/hub-elevenlabs");
      if (el.ok) {
        const voices: VoiceChoice[] = el.body.voices || [];
        setVoVoices(voices);
        setTvVoice(v => v || (voices[0] ? `el:${voices[0].voice_id}` : ""));
      } else {
        setVoLoadError(el.body?.error || `ElevenLabs voices could not be loaded (${el.status}).`);
      }
    })();
  }, []);

  // While any HeyGen video is still being made, ask HeyGen every 30 seconds; finished ones land on the shelf.
  const checking = useRef(false);
  const anyMaking = items.some(i => i.status === "making" || i.status === "saving");
  useEffect(() => {
    if (!anyMaking) return;
    const run = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const r = await callApi("/api/hub-heygen", { method: "POST", body: { action: "check" } });
        if (r.ok) {
          const problems: string[] = r.body.problems || [];
          setTvCheckNote(problems.length ? problems.join(" · ") : null);
          if ((r.body.finished || 0) > 0 || (r.body.failed || 0) > 0) await loadItems();
        } else {
          setTvCheckNote(r.body?.error || `Checking HeyGen failed (${r.status}).`);
        }
      } finally {
        checking.current = false;
      }
    };
    run();
    const t = setInterval(run, 30000);
    return () => clearInterval(t);
  }, [anyMaking, loadItems]);

  const startHeygen = async () => {
    setTvConfirm(false);
    setTvBusy(true);
    setTvMessage(null);
    const r = await callApi("/api/hub-heygen", {
      method: "POST",
      body: {
        action: "create", title: tvTitle, script: tvScript, agent_id: tvAvatar,
        voice_id: tvVoice.slice(3), voice_source: tvVoice.startsWith("el:") ? "elevenlabs" : "heygen",
        voice_name: tvVoice.startsWith("el:") ? voVoices.find(v => v.voice_id === tvVoice.slice(3))?.name : undefined,
        aspect_ratio: tvSize, video_type: tvType,
      },
    });
    setTvBusy(false);
    if (!r.ok) return setTvMessage({ kind: "error", text: r.body?.error || `HeyGen could not start the video (${r.status}).` });
    setTvMessage({ kind: "ok", text: `“${tvTitle.trim()}” is being made. It shows on the shelf as Making… and lands there when HeyGen finishes.` });
    setTvTitle(""); setTvScript("");
    await loadItems();
  };

  const askHeygenConfirm = () => {
    setTvMessage(null);
    if (!tvTitle.trim()) return setTvMessage({ kind: "error", text: "Give the video a title." });
    if (!tvScript.trim()) return setTvMessage({ kind: "error", text: "Paste a script first." });
    if (!tvAvatar) return setTvMessage({ kind: "error", text: "Choose an agent." });
    if (!tvVoice) return setTvMessage({ kind: "error", text: "Choose a voice." });
    if (tvVoice.startsWith("el:") && tvScript.trim().length > VOICE_OVER_LIMIT) {
      return setTvMessage({ kind: "error", text: `This script is ${tvScript.trim().length.toLocaleString()} characters. ElevenLabs reads up to ${VOICE_OVER_LIMIT.toLocaleString()} at a time. Shorten it or split it into two videos.` });
    }
    setTvConfirm(true);
  };

  const pickFile = (f: File | null) => {
    setFile(f);
    setMessage(null);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const startUpload = async () => {
    if (!file) return setMessage({ kind: "error", text: "Choose a video file first." });
    if (!title.trim()) return setMessage({ kind: "error", text: "Give the video a title." });
    setUploading(true);
    setProgress(0);
    setMessage(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("You are signed out. Sign in again and retry.");

      const meta = await readVideoMeta(file);
      const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${safeName(file.name)}`;

      await uploadWithProgress(path, file, token, setProgress);

      const { error } = await supabase.from("video_hub_items").insert({
        title: title.trim(),
        video_type: videoType,
        source: "upload",
        length_seconds: meta.seconds !== null ? Math.round(meta.seconds) : null,
        aspect_ratio: meta.aspect || null,
        storage_path: path,
        file_name: file.name,
        file_size_bytes: file.size,
        mime_type: file.type || null,
        notes: notes.trim() || null,
      });
      if (error) {
        // Keep the shelf and storage in step: remove the file if its row could not be saved.
        await supabase.storage.from(BUCKET).remove([path]);
        throw new Error(error.message);
      }

      setMessage({ kind: "ok", text: `“${title.trim()}” is on the shelf.` });
      setTitle(""); setNotes(""); setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadItems();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Upload failed.";
      const tooBig = /maximum allowed size|too large|exceed/i.test(raw);
      setMessage({
        kind: "error",
        text: tooBig
          ? `Storage refused this file because of its size limit (${formatBytes(file.size)}). Tell Claude and the limit will be raised. Details: ${raw}`
          : raw,
      });
    } finally {
      setUploading(false);
    }
  };

  const togglePlay = async (item: HubItem) => {
    if (playing?.id === item.id) return setPlaying(null);
    setBusyId(item.id);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 3600);
    setBusyId(null);
    if (error || !data) return setMessage({ kind: "error", text: error?.message || "Could not open this video." });
    setPlaying({ id: item.id, url: data.signedUrl });
  };

  const download = async (item: HubItem) => {
    setBusyId(item.id);
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.storage_path, 3600, { download: item.file_name || true });
    setBusyId(null);
    if (error || !data) return setMessage({ kind: "error", text: error?.message || "Could not prepare the download." });
    window.location.href = data.signedUrl;
  };

  // Copy the original into a Bunny library. The original stays in the Hub.
  const sendToBunny = async (item: HubItem, dest: Destination) => {
    setSendMenuId(null);
    setSending({ id: item.id, dest });
    setMessage(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("You are signed out. Sign in again and retry.");
      const res = await fetch("/api/hub-send-to-bunny", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ item_id: item.id, destination: dest }),
      });
      let body: { ok?: boolean; error?: string } = {};
      try { body = await res.json(); } catch { /* non-JSON error page */ }
      if (!res.ok || !body.ok) throw new Error(body.error || `Sending failed (${res.status}).`);
      setMessage({ kind: "ok", text: `“${item.title}” was copied to the ${DEST_LABEL[dest]} library. The original is still here.` });
      await loadItems();
    } catch (e) {
      setMessage({ kind: "error", text: e instanceof Error ? e.message : "Sending failed." });
    } finally {
      setSending(null);
    }
  };

  const remove = async (item: HubItem) => {
    setBusyId(item.id);
    if (item.storage_path) {
      const { error: sErr } = await supabase.storage.from(BUCKET).remove([item.storage_path]);
      if (sErr) {
        setBusyId(null);
        return setMessage({ kind: "error", text: sErr.message });
      }
    }
    const { error: dErr } = await supabase.from("video_hub_items").delete().eq("id", item.id);
    setBusyId(null);
    setConfirmDelete(null);
    if (dErr) return setMessage({ kind: "error", text: dErr.message });
    if (playing?.id === item.id) setPlaying(null);
    await loadItems();
  };

  const label: React.CSSProperties = {
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700,
    letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(10,35,66,0.6)", marginBottom: 4, display: "block",
  };
  const input: React.CSSProperties = {
    fontFamily: "'Inter', sans-serif", fontSize: "0.85rem", color: NAVY, width: "100%", boxSizing: "border-box",
    padding: "0.55rem 0.7rem", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 8, background: "#FFFFFF",
  };
  const btn = (primary = true, disabled = false): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.05em",
    padding: "0.55rem 1.1rem", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1,
    border: primary ? "none" : `1px solid ${NAVY}`, background: primary ? NAVY : "transparent", color: primary ? GOLD : NAVY,
  });

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.75rem", fontWeight: 700, margin: "0 0 0.2rem" }}>Video Hub</h1>
          <p style={{ color: "rgba(10,35,66,0.55)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", margin: 0 }}>
            Every original video lives here. Only copies go to Bunny.
          </p>
        </div>

        {/* Travis's Videos — HeyGen */}
        <section style={{ background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.1rem", margin: "0 0 0.2rem" }}>Travis's Videos</h2>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.55)", margin: "0 0 0.9rem" }}>
            Paste a script, choose the software, and Travis makes the video. The finished video lands on the shelf below.
          </p>
          {tvLoadError && <p role="alert" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: "#B3261E", margin: "0 0 0.8rem" }}>{tvLoadError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.9rem" }}>
            <div>
              <label style={label} htmlFor="tv-title">Title</label>
              <input id="tv-title" style={input} value={tvTitle} onChange={e => setTvTitle(e.target.value)} disabled={tvBusy} placeholder="Name this video" />
            </div>
            <div>
              <label style={label} htmlFor="tv-type">Type</label>
              <select id="tv-type" style={input} value={tvType} onChange={e => setTvType(e.target.value as VideoType)} disabled={tvBusy}>
                {(Object.keys(TYPE_LABEL) as VideoType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="tv-size">Size</label>
              <select id="tv-size" style={input} value={tvSize} onChange={e => setTvSize(e.target.value)} disabled={tvBusy}>
                {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="tv-avatar">Avatar (agent)</label>
              <select id="tv-avatar" style={input} value={tvAvatar} onChange={e => setTvAvatar(e.target.value)} disabled={tvBusy || tvAgents.length === 0}>
                {tvAgents.length === 0 && <option value="">No agents found</option>}
                {tvAgents.map(a => <option key={a.id} value={a.id}>{a.name}{a.role ? ` — ${a.role}` : ""}</option>)}
              </select>
              {(() => {
                const chosen = tvAgents.find(a => a.id === tvAvatar);
                if (!chosen) return null;
                return (
                  <img src={chosen.photo_url} alt={`Photo of ${chosen.name}`} loading="lazy"
                    style={{ marginTop: "0.5rem", width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid rgba(212,175,55,0.4)" }} />
                );
              })()}
            </div>
            <div>
              <label style={label} htmlFor="tv-voice">Voice</label>
              <select id="tv-voice" style={input} value={tvVoice} onChange={e => setTvVoice(e.target.value)} disabled={tvBusy || (tvVoices.length === 0 && voVoices.length === 0)}>
                {tvVoices.length === 0 && voVoices.length === 0 && <option value="">No voices found</option>}
                {voVoices.length > 0 && (
                  <optgroup label="ElevenLabs voices">
                    {voVoices.map(v => <option key={`el:${v.voice_id}`} value={`el:${v.voice_id}`}>ElevenLabs · {v.name}{v.category ? ` · ${v.category}` : ""}</option>)}
                  </optgroup>
                )}
                {tvVoices.length > 0 && (
                  <optgroup label="HeyGen voices">
                    {tvVoices.map(v => <option key={`hg:${v.id}`} value={`hg:${v.id}`}>HeyGen · {v.label}</option>)}
                  </optgroup>
                )}
              </select>
              {(() => {
                if (!tvVoice.startsWith("el:")) return null;
                const chosen = voVoices.find(v => v.voice_id === tvVoice.slice(3));
                if (!chosen) return null;
                return (
                  <div style={{ marginTop: "0.5rem" }}>
                    {chosen.description && (
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.6)", margin: "0 0 0.3rem" }}>{chosen.description}</p>
                    )}
                    {chosen.preview_url ? (
                      <audio key={chosen.voice_id} controls preload="none" src={chosen.preview_url} style={{ width: "100%", height: 34 }} aria-label={`Sample of ${chosen.name}`} />
                    ) : (
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.5)", margin: 0 }}>No sample available for this voice.</p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <label style={label} htmlFor="tv-script">Script</label>
            <textarea id="tv-script" style={{ ...input, minHeight: 150, resize: "vertical", fontFamily: "'Inter', sans-serif" }}
              value={tvScript} onChange={e => setTvScript(e.target.value)} disabled={tvBusy} placeholder="Paste the script here" />
          </div>
          {voLoadError && (
            <p role="alert" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "#B3261E", margin: "0.6rem 0 0" }}>ElevenLabs voices are not available: {voLoadError}</p>
          )}
          {tvNotes.length > 0 && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.55)", margin: "0.6rem 0 0" }}>{tvNotes.join(" ")}</p>
          )}
          <div style={{ marginTop: "1rem", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {tvConfirm ? (
              <>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: NAVY }}>
                  {tvVoice.startsWith("el:")
                    ? "ElevenLabs uses characters and HeyGen charges credits for each video. Make this one?"
                    : "HeyGen charges credits for each video. Make this one?"}
                </span>
                <button style={btn(true, tvBusy)} disabled={tvBusy} onClick={startHeygen}>Yes, make it</button>
                <button style={btn(false)} onClick={() => setTvConfirm(false)}>Cancel</button>
              </>
            ) : (
              <>
                <button style={btn(true, tvBusy || !!tvLoadError)} disabled={tvBusy || !!tvLoadError} onClick={askHeygenConfirm}>
                  {tvBusy ? "Starting…" : "HeyGen"}
                </button>
                <button style={btn(false, true)} disabled title="Higgsfield comes in a later step">Higgsfield — coming next</button>
              </>
            )}
            {tvMessage && (
              <span role="status" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: tvMessage.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>{tvMessage.text}</span>
            )}
          </div>
          {tvCheckNote && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "#B3261E", margin: "0.6rem 0 0" }}>{tvCheckNote}</p>
          )}
        </section>

        {/* Upload */}
        <section style={{ background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 12, padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.1rem", margin: "0 0 0.9rem" }}>Upload a video</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.9rem" }}>
            <div>
              <label style={label} htmlFor="vh-title">Title</label>
              <input id="vh-title" style={input} value={title} onChange={e => setTitle(e.target.value)} disabled={uploading} placeholder="Name this video" />
            </div>
            <div>
              <label style={label} htmlFor="vh-type">Type</label>
              <select id="vh-type" style={input} value={videoType} onChange={e => setVideoType(e.target.value as VideoType)} disabled={uploading}>
                {(Object.keys(TYPE_LABEL) as VideoType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="vh-file">Video file (MP4, MOV, WebM)</label>
              <input id="vh-file" ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
                style={input} disabled={uploading} onChange={e => pickFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div style={{ marginTop: "0.9rem" }}>
            <label style={label} htmlFor="vh-notes">Notes (optional)</label>
            <input id="vh-notes" style={input} value={notes} onChange={e => setNotes(e.target.value)} disabled={uploading} placeholder="Anything to remember about this video" />
          </div>

          {file && (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.6)", margin: "0.7rem 0 0" }}>
              {file.name} · {formatBytes(file.size)} · length and size are read from the file when you upload
            </p>
          )}

          {uploading && (
            <div style={{ marginTop: "0.9rem" }}>
              <div style={{ height: 8, background: "rgba(10,35,66,0.1)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${progress}%`, height: "100%", background: GOLD, transition: "width 0.2s" }} />
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.6)", margin: "0.35rem 0 0" }}>Uploading… {progress}%</p>
            </div>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button style={btn(true, uploading || !file)} disabled={uploading || !file} onClick={startUpload}>
              {uploading ? "Uploading…" : "Upload"}
            </button>
            {message && (
              <span role="status" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", color: message.kind === "ok" ? "#1B6E3C" : "#B3261E" }}>
                {message.text}
              </span>
            )}
          </div>
        </section>

        {/* Shelf */}
        <section>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.1rem", margin: "0 0 0.75rem" }}>
            The shelf {items.length > 0 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.5)", fontWeight: 400 }}>· {items.length} video{items.length === 1 ? "" : "s"}</span>}
          </h2>

          {loading ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", color: "rgba(10,35,66,0.5)" }}>Loading the shelf…</p>
          ) : loadError ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", color: "#B3261E" }}>Could not load the shelf: {loadError}</p>
          ) : items.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", color: "rgba(10,35,66,0.5)" }}>Nothing on the shelf yet. Make or upload your first video above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(item => (
                <div key={item.id} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.12)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                      <p style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "0.98rem", fontWeight: 700, margin: 0 }}>{item.title}</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.6)", margin: "3px 0 0" }}>
                        {isAudio(item)
                          ? `Voice-over · ${SOURCE_LABEL[item.source] || item.source} · ${formatLength(item.length_seconds)} · ${formatBytes(item.file_size_bytes)} · ${new Date(item.created_at).toLocaleDateString()}`
                          : `${TYPE_LABEL[item.video_type]} · ${SOURCE_LABEL[item.source] || item.source} · ${item.status === "ready" ? `${formatLength(item.length_seconds)} · ` : ""}${item.aspect_ratio || "size unknown"} · ${item.status === "ready" ? `${formatBytes(item.file_size_bytes)} · ` : ""}${new Date(item.created_at).toLocaleDateString()}`}
                      </p>
                      {(item.status === "making" || item.status === "saving") && (
                        <p role="status" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.74rem", color: "#8A6D00", margin: "5px 0 0" }}>
                          Making… HeyGen is creating this video. This page checks every 30 seconds and the video lands here when it is done.
                        </p>
                      )}
                      {item.status === "failed" && (
                        <p role="alert" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.74rem", color: "#B3261E", margin: "5px 0 0" }}>
                          HeyGen could not make this video: {item.error_detail || "no reason given"}
                        </p>
                      )}
                      {item.notes && <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.5)", margin: "3px 0 0" }}>{item.notes}</p>}
                      {(item.bunny_copies || []).length > 0 && (
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "#1B6E3C", margin: "5px 0 0" }}>
                          Copies in Bunny: {(item.bunny_copies || []).map(c => `${DEST_LABEL[c.destination]} (video ID ${c.bunny_video_id})`).join(" · ")}
                        </p>
                      )}
                      {sending?.id === item.id && (
                        <p role="status" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.7)", margin: "5px 0 0" }}>
                          Copying to the {DEST_LABEL[sending.dest]} library… large videos can take a few minutes. Keep this page open.
                        </p>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {item.status === "ready" && (
                        <>
                          <button style={btn(false, busyId === item.id)} disabled={busyId === item.id} onClick={() => togglePlay(item)}>
                            {playing?.id === item.id ? "Close" : "Play"}
                          </button>
                          <button style={btn(false, busyId === item.id)} disabled={busyId === item.id} onClick={() => download(item)}>Download</button>
                          {!isAudio(item) && (
                            <button style={btn(true, !!sending)} disabled={!!sending} onClick={() => setSendMenuId(sendMenuId === item.id ? null : item.id)}>Send to…</button>
                          )}
                        </>
                      )}
                      {confirmDelete === item.id ? (
                        <>
                          <button style={{ ...btn(true, busyId === item.id), background: "#B3261E", color: "#FFFFFF" }} disabled={busyId === item.id} onClick={() => remove(item)}>Delete for good</button>
                          <button style={btn(false)} onClick={() => setConfirmDelete(null)}>Keep it</button>
                        </>
                      ) : (
                        <button style={btn(false, busyId === item.id)} disabled={busyId === item.id} onClick={() => setConfirmDelete(item.id)}>Delete</button>
                      )}
                    </div>
                  </div>
                  {sendMenuId === item.id && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
                      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.6)" }}>Copy to the Bunny library for:</span>
                      {(Object.keys(DEST_LABEL) as Destination[]).map(d => {
                        const already = (item.bunny_copies || []).some(c => c.destination === d);
                        return (
                          <button key={d} style={btn(false, already)} disabled={already} onClick={() => sendToBunny(item, d)}>
                            {DEST_LABEL[d]}{already ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {playing?.id === item.id && (
                    isAudio(item)
                      ? <audio src={playing.url} controls autoPlay style={{ width: "100%", marginTop: 12 }} />
                      : <video src={playing.url} controls autoPlay style={{ width: "100%", maxHeight: 460, marginTop: 12, borderRadius: 8, background: "#000" }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </AdminLayout>
  );
}
