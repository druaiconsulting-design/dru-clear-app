import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import AdminLayout from "../components/AdminLayout";

// ─── Video Hub — Step 1: the shelf + manual upload ────────────────────────────
// Originals live in the private Supabase bucket `hub-videos` (admin login only).
// Each video has one row in `video_hub_items`. Copies go to Bunny in a later step.

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
    const { error: sErr } = await supabase.storage.from(BUCKET).remove([item.storage_path]);
    if (sErr) {
      setBusyId(null);
      return setMessage({ kind: "error", text: sErr.message });
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
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", color: "rgba(10,35,66,0.5)" }}>Nothing on the shelf yet. Upload your first video above.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map(item => (
                <div key={item.id} style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.12)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0, flex: "1 1 300px" }}>
                      <p style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "0.98rem", fontWeight: 700, margin: 0 }}>{item.title}</p>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.72rem", color: "rgba(10,35,66,0.6)", margin: "3px 0 0" }}>
                        {TYPE_LABEL[item.video_type]} · {SOURCE_LABEL[item.source] || item.source} · {formatLength(item.length_seconds)} · {item.aspect_ratio || "size unknown"} · {formatBytes(item.file_size_bytes)} · {new Date(item.created_at).toLocaleDateString()}
                      </p>
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
                      <button style={btn(false, busyId === item.id)} disabled={busyId === item.id} onClick={() => togglePlay(item)}>
                        {playing?.id === item.id ? "Close" : "Play"}
                      </button>
                      <button style={btn(false, busyId === item.id)} disabled={busyId === item.id} onClick={() => download(item)}>Download</button>
                      <button style={btn(true, !!sending)} disabled={!!sending} onClick={() => setSendMenuId(sendMenuId === item.id ? null : item.id)}>Send to…</button>
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
                    <video src={playing.url} controls autoPlay style={{ width: "100%", maxHeight: 460, marginTop: 12, borderRadius: 8, background: "#000" }} />
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
