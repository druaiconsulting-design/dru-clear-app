import { useState, useEffect, useRef } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Video {
  id:             string
  bunny_video_id: string
  title:          string
  type:           string
  status:         string
  is_active:      boolean
  created_at:     string
}

type UploadStatus = 'idle' | 'creating' | 'uploading' | 'saving' | 'done' | 'error'

// ─── Constants ────────────────────────────────────────────────────────────────

const GHL_LAB_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/70d21e5b-66f9-4aa0-8eac-5c59ed55fcaa";

const LIBRARY_ID = import.meta.env.VITE_BUNNY_LIBRARY_ID as string

const VIDEO_TYPES = [
  { value: 'welcome',     label: 'Welcome Video' },
  { value: 'monthly_lab', label: 'Monthly Lab'   },
  { value: 'course',      label: 'Course Video'  },
  { value: 'general',     label: 'General'       },
]

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  welcome:     { color: '#1B4D8E', bg: 'rgba(27,77,142,0.1)'  },
  monthly_lab: { color: '#D4AF37', bg: 'rgba(212,175,55,0.1)' },
  course:      { color: '#C2185B', bg: 'rgba(194,24,91,0.1)'  },
  general:     { color: '#555',    bg: 'rgba(0,0,0,0.06)'     },
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)",
  borderRadius: 6, padding: "0.6rem 0.875rem", color: "#0A2342",
  fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700,
  color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: "0.35rem",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminLab() {

  // ── Existing lab state ─────────────────────────────────────────────────────
  const [labTitle,    setLabTitle]    = useState("");
  const [labMonth,    setLabMonth]    = useState("");
  const [labVideoUrl, setLabVideoUrl] = useState("");
  const [publishing,  setPublishing]  = useState(false);
  const [published,   setPublished]   = useState(false);
  const [error,       setError]       = useState("");

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadTitle,    setUploadTitle]    = useState("");
  const [uploadType,     setUploadType]     = useState("welcome");
  const [uploadFile,     setUploadFile]     = useState<File | null>(null);
  const [uploadStatus,   setUploadStatus]   = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError,    setUploadError]    = useState("");

  // ── Library state ──────────────────────────────────────────────────────────
  const [videos,        setVideos]        = useState<Video[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [togglingId,    setTogglingId]    = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load videos ────────────────────────────────────────────────────────────
  const loadVideos = async () => {
    setVideosLoading(true);
    const { data } = await supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setVideos((data ?? []) as Video[]);
    setVideosLoading(false);
  };

  useEffect(() => { loadVideos(); }, []);

  // ── Existing publish handler ───────────────────────────────────────────────
  const handlePublish = async () => {
    if (!labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) {
      setError("All fields are required before publishing."); return;
    }
    setPublishing(true); setError(""); setPublished(false);
    try {
      const { error: dbError } = await supabase.from("lab_videos").insert({
        title: labTitle.trim(), month_year: labMonth.trim(),
        video_url: labVideoUrl.trim(), is_active: true,
      });
      if (dbError) throw dbError;
      await fetch(GHL_LAB_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: "lab_video_published",
          video_title: labTitle.trim(),
          month_year: labMonth.trim(),
          lab_url: "https://app.druaiconsulting.com/lab",
          tier: "accelerator",
        }),
      });
      setPublished(true);
      setLabTitle(""); setLabMonth(""); setLabVideoUrl("");
      setTimeout(() => setPublished(false), 5000);
    } catch (err) {
      setError((err instanceof Error ? err.message : null) || "Publish failed. Please try again.");
    }
    setPublishing(false);
  };

  // ── Upload handler ─────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploadError(""); setUploadProgress(0);

    // Step 1 — create slot in Bunny
    setUploadStatus("creating");
    let videoId: string;
    try {
      const res = await fetch("/api/bunny-create-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: uploadTitle.trim(), type: uploadType }),
      });
      if (!res.ok) throw new Error("Failed to create video slot");
      videoId = (await res.json()).videoId;
    } catch (err) {
      setUploadError("Could not initialize upload. Check Bunny credentials.");
      setUploadStatus("error");
      return;
    }

    // Step 2 — upload via XHR for progress
    setUploadStatus("uploading");
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", `/api/bunny-upload-video?videoId=${videoId}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload  = () => xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(uploadFile);
      });
    } catch (err) {
      setUploadError((err as Error).message || "Upload failed.");
      setUploadStatus("error");
      return;
    }

    // Step 3 — save to Supabase
    setUploadStatus("saving");
    try {
      const { error: dbErr } = await supabase.from("videos").insert({
        bunny_video_id: videoId,
        title:          uploadTitle.trim(),
        type:           uploadType,
        thumbnail_url:  `https://iframe.mediadelivery.net/thumbs/${LIBRARY_ID}/${videoId}/thumbnail.jpg`,
        status:         "processing",
        is_active:      true,
        sort_order:     0,
      });
      if (dbErr) throw dbErr;
    } catch {
      setUploadError("Uploaded to Bunny but failed to save metadata. Refresh to verify.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("done");
    loadVideos();
    setTimeout(() => {
      setUploadTitle(""); setUploadFile(null); setUploadProgress(0); setUploadStatus("idle");
    }, 4000);
  };

  // ── Toggle active ──────────────────────────────────────────────────────────
  const toggleActive = async (video: Video) => {
    setTogglingId(video.id);
    await supabase.from("videos").update({ is_active: !video.is_active }).eq("id", video.id);
    setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, is_active: !v.is_active } : v));
    setTogglingId(null);
  };

  const markReady = async (id: string) => {
    await supabase.from("videos").update({ status: "ready" }).eq("id", id);
    setVideos((prev) => prev.map((v) => v.id === id ? { ...v, status: "ready" } : v));
  };

  const canUpload = !!uploadFile && !!uploadTitle.trim() && uploadStatus === "idle";

  const uploadLabel = () => {
    switch (uploadStatus) {
      case "creating":  return "Initializing…";
      case "uploading": return `Uploading ${uploadProgress}%`;
      case "saving":    return "Saving…";
      case "done":      return "✓ Upload Complete";
      case "error":     return "Error — try again";
      default:          return "Upload to Bunny";
    }
  };

  const labReady = labTitle.trim() && labMonth.trim() && labVideoUrl.trim();

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ padding: "2.5rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>
            DeAnna's Leadership Lab™
          </h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>
            Publish monthly Leadership Lab videos and manage all portal videos
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            TWO-COLUMN GRID — Publish Lab + Upload to Bunny
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem", alignItems: "start" }}>

        {/* ── SECTION 1 — Publish Monthly Lab Video ── */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🎬</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 }}>
              Publish Monthly Lab Video
            </p>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Upload your video to Bunny Stream, paste the URL below, then publish. Accelerator members are notified automatically via GHL.
          </p>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.875rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={labelStyle}>Video Title</label>
              <input type="text" placeholder="e.g. AI Leadership in Action" value={labTitle}
                onChange={e => { setLabTitle(e.target.value); setError(""); }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Month</label>
              <input type="text" placeholder="e.g. June 2026" value={labMonth}
                onChange={e => { setLabMonth(e.target.value); setError(""); }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Video URL</label>
              <input type="text" placeholder="Paste Bunny Stream embed URL" value={labVideoUrl}
                onChange={e => { setLabVideoUrl(e.target.value); setError(""); }} style={inputStyle} />
            </div>
          </div>

          {error && <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.875rem" }}>{error}</p>}

          <button onClick={handlePublish} disabled={publishing || !labReady}
            style={{
              width: "100%", border: "none", borderRadius: 8, padding: "0.875rem 1.5rem",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em",
              cursor: (publishing || !labReady) ? "default" : "pointer", transition: "all 0.2s",
              background: published ? "#43A047" : !labReady ? "rgba(212,175,55,0.2)" : "#D4AF37",
              color: published ? "#FFFFFF" : !labReady ? "rgba(212,175,55,0.4)" : "#0A2342",
            }}>
            {publishing ? "Publishing..." : published ? "✓ Published — Accelerator Members Notified" : "Publish + Notify Accelerator Members"}
          </button>
        </div>

        {/* ── SECTION 2 — Upload Video to Bunny ── */}
        <div style={{ background: "rgba(27,77,142,0.04)", border: "1px solid rgba(27,77,142,0.18)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🎥</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1B4D8E", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 }}>
              Upload Video to Bunny
            </p>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Upload directly from here — no need to go to Bunny's dashboard. Use the type selector to control where it appears in the portal.
          </p>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.875rem", marginBottom: "1.25rem" }}>

            {/* Title + Type */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
              <div>
                <label style={labelStyle}>Video Title *</label>
                <input type="text" placeholder="e.g. Welcome to DRU AI"
                  value={uploadTitle} onChange={(e) => { setUploadTitle(e.target.value); setUploadError(""); }}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Video Type *</label>
                <select value={uploadType} onChange={(e) => setUploadType(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  {VIDEO_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* File drop zone */}
            <div>
              <label style={labelStyle}>Video File *</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("video/")) setUploadFile(f); }}
                onDragOver={(e) => e.preventDefault()}
                style={{
                  border: "1.5px dashed rgba(10,35,66,0.2)", borderRadius: 8,
                  padding: "1.25rem", textAlign: "center" as const, cursor: "pointer",
                  background: uploadFile ? "rgba(27,77,142,0.04)" : "#FFFFFF", transition: "all 0.15s",
                }}>
                {uploadFile ? (
                  <div>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.78rem", color: "#0A2342", fontWeight: 600, margin: "0 0 3px" }}>
                      📎 {uploadFile.name}
                    </p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)", margin: 0 }}>
                      {(uploadFile.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    <button onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                      style={{ background: "none", border: "none", color: "#E53935", fontSize: "0.7rem", cursor: "pointer", marginTop: 4, fontFamily: "'Inter', sans-serif" }}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: "1.25rem", margin: "0 0 5px" }}>⬆️</p>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", color: "#0A2342", fontWeight: 600, margin: "0 0 2px" }}>
                      Click to select or drag & drop
                    </p>
                    <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.68rem", color: "rgba(10,35,66,0.4)", margin: 0 }}>
                      MP4, MOV, MKV — any size
                    </p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="video/*"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={{ display: "none" }} />
            </div>
          </div>

          {/* Progress bar */}
          {uploadStatus === "uploading" && (
            <div style={{ marginBottom: "0.875rem" }}>
              <div style={{ height: 5, background: "rgba(10,35,66,0.1)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #1B4D8E, #2d6abf)", borderRadius: 4, transition: "width 0.3s ease" }} />
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.68rem", color: "rgba(10,35,66,0.45)", marginTop: 4, textAlign: "right" as const }}>
                {uploadProgress}% uploaded
              </p>
            </div>
          )}

          {uploadError && (
            <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.875rem", lineHeight: 1.5 }}>
              {uploadError}
            </p>
          )}

          <button onClick={handleUpload} disabled={!canUpload}
            style={{
              width: "100%", border: "none", borderRadius: 8, padding: "0.875rem 1.5rem",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em",
              cursor: canUpload ? "pointer" : "default", transition: "all 0.2s",
              background: uploadStatus === "done"  ? "#43A047"
                        : uploadStatus === "error" ? "#E53935"
                        : !canUpload               ? "rgba(27,77,142,0.15)"
                        :                            "#1B4D8E",
              color: uploadStatus === "done" || uploadStatus === "error" ? "#FFFFFF"
                   : !canUpload ? "rgba(27,77,142,0.35)"
                   :              "#FFFFFF",
            }}>
            {uploadLabel()}
          </button>
        </div>

        </div>{/* end 2-column grid */}

        {/* ══════════════════════════════════════════════════════════════════
            SECTION 3 — Video Library
        ══════════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
              Video Library
            </h2>
            <button onClick={loadVideos}
              style={{ background: "none", border: "1px solid rgba(10,35,66,0.2)", borderRadius: 6, padding: "4px 10px", fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, color: "rgba(10,35,66,0.45)", cursor: "pointer", letterSpacing: "0.06em" }}>
              ↻ Refresh
            </button>
          </div>

          {videosLoading ? (
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.75rem", textAlign: "center" as const, padding: "1.5rem" }}>Loading…</p>
          ) : videos.length === 0 ? (
            <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 10, padding: "1.5rem", textAlign: "center" as const }}>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.78rem", margin: 0 }}>
                No videos uploaded yet.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
              {videos.map((video) => {
                const tc = TYPE_COLORS[video.type] || TYPE_COLORS.general;
                const isProcessing = video.status === "processing";
                return (
                  <div key={video.id} style={{
                    background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.08)", borderRadius: 8,
                    padding: "0.875rem 1rem", display: "flex", alignItems: "center", gap: "0.875rem",
                    opacity: video.is_active ? 1 : 0.55,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 3 }}>
                        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", fontWeight: 600, color: "#0A2342", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                          {video.title}
                        </p>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 20, background: tc.bg, color: tc.color, flexShrink: 0, textTransform: "uppercase" as const }}>
                          {VIDEO_TYPES.find(t => t.value === video.type)?.label || video.type}
                        </span>
                        <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 20, flexShrink: 0,
                          background: video.status === "ready" ? "rgba(67,160,71,0.1)" : video.status === "failed" ? "rgba(229,57,53,0.1)" : "rgba(212,175,55,0.12)",
                          color:      video.status === "ready" ? "#43A047" : video.status === "failed" ? "#E53935" : "#D4AF37",
                        }}>
                          {video.status === "ready" ? "Ready" : video.status === "failed" ? "Failed" : "Processing"}
                        </span>
                      </div>
                      <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.66rem", color: "rgba(10,35,66,0.4)", margin: 0 }}>
                        {new Date(video.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {isProcessing && (
                        <button onClick={() => markReady(video.id)}
                          style={{ background: "rgba(67,160,71,0.1)", border: "1px solid rgba(67,160,71,0.25)", borderRadius: 5, padding: "3px 9px", fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700, color: "#43A047", cursor: "pointer" }}>
                          Mark Ready
                        </button>
                      )}
                      <button onClick={() => toggleActive(video)} disabled={togglingId === video.id}
                        style={{
                          border: `1px solid ${video.is_active ? "rgba(10,35,66,0.15)" : "rgba(212,175,55,0.3)"}`,
                          background: video.is_active ? "rgba(10,35,66,0.06)" : "rgba(212,175,55,0.08)",
                          borderRadius: 5, padding: "3px 9px",
                          fontFamily: "'Montserrat', sans-serif", fontSize: "0.58rem", fontWeight: 700,
                          color: video.is_active ? "rgba(10,35,66,0.45)" : "#D4AF37",
                          cursor: togglingId === video.id ? "default" : "pointer",
                        }}>
                        {video.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── How it works ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.5rem" }}>How it works</p>
          <ul style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.72rem", lineHeight: 1.8, paddingLeft: "1.25rem", margin: 0 }}>
            <li><strong>Publish Monthly Lab Video</strong> — pastes the Bunny embed URL, saves to <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 4px", borderRadius: 3 }}>lab_videos</code>, and notifies Accelerator members via GHL</li>
            <li><strong>Upload Video to Bunny</strong> — uploads the file directly from here; saved to the <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 4px", borderRadius: 3 }}>videos</code> table for use across the portal</li>
            <li><strong>Welcome</strong> type plays on the Portal home page · <strong>Monthly Lab</strong> streams in Leadership Lab · <strong>Course</strong> delivers in the course player</li>
            <li>After upload, Bunny processes the video — click <strong>Mark Ready</strong> when done</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
