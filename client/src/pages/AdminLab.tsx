import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────

const GHL_LAB_WEBHOOK_URL =
  "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/70d21e5b-66f9-4aa0-8eac-5c59ed55fcaa";

// ─── Types ────────────────────────────────────────────────────────────────────

type VideoType  = "monthly" | "community";
type CommTarget = "open" | "accelerator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Accepts either a clean Bunny link (Direct Play or Embed) OR the full HTML
// snippet Bunny's "Embed" box gives you, and always returns just the clean URL.
function cleanBunnyUrl(raw: string): string {
  const trimmed = raw.trim();
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  return srcMatch ? srcMatch[1] : trimmed;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)",
  borderRadius: 6, padding: "0.6rem 0.875rem", color: "#0A2342",
  fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700,
  color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase",
  display: "block", marginBottom: "0.35rem",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminLab() {

  // ── Shared ─────────────────────────────────────────────────────────────────
  const [videoType, setVideoType] = useState<VideoType>("monthly");

  // ── Monthly state ──────────────────────────────────────────────────────────
  const [labTitle,    setLabTitle]    = useState("");
  const [labMonth,    setLabMonth]    = useState("");
  const [labText,     setLabText]     = useState("");
  const [labVideoUrl, setLabVideoUrl] = useState("");
  const [labThumbUrl, setLabThumbUrl] = useState("");
  const [publishing,  setPublishing]  = useState(false);
  const [published,   setPublished]   = useState(false);
  const [error,       setError]       = useState("");

  // ── Community state ────────────────────────────────────────────────────────
  const [commTitle,      setCommTitle]      = useState("");
  const [commText,       setCommText]       = useState("");
  const [commVideoUrl,   setCommVideoUrl]   = useState("");
  const [commThumbUrl,   setCommThumbUrl]   = useState("");
  const [commTarget,     setCommTarget]     = useState<CommTarget>("open");
  const [commPublishing, setCommPublishing] = useState(false);
  const [commPublished,  setCommPublished]  = useState(false);
  const [commError,      setCommError]      = useState("");

  // ── Monthly publish handler ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!labTitle.trim() || !labMonth.trim() || !labVideoUrl.trim()) {
      setError("All fields are required before publishing."); return;
    }
    setPublishing(true); setError(""); setPublished(false);
    try {
      const { error: dbError } = await supabase.from("lab_videos").insert({
        title:         labTitle.trim(),
        month_year:    labMonth.trim(),
        content:       labText.trim(),
        video_url:     cleanBunnyUrl(labVideoUrl),
        thumbnail_url: labThumbUrl.trim() || null,
        is_active:     true,
      });
      if (dbError) throw dbError;

      await fetch(GHL_LAB_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trigger_type: "lab_video_published",
          video_title:  labTitle.trim(),
          month_year:   labMonth.trim(),
          lab_url:      "https://app.druaiconsulting.com/lab",
          tier:         "accelerator",
        }),
      });

      setPublished(true);
      setLabTitle(""); setLabMonth(""); setLabText(""); setLabVideoUrl(""); setLabThumbUrl("");
      setTimeout(() => setPublished(false), 5000);
    } catch (err) {
      setError((err instanceof Error ? err.message : null) || "Publish failed. Please try again.");
    }
    setPublishing(false);
  };

  // ── Community publish handler ──────────────────────────────────────────────
  const handleCommunityPublish = async () => {
    if (!commTitle.trim() || !commVideoUrl.trim()) {
      setCommError("Title and video URL are required."); return;
    }
    setCommPublishing(true); setCommError(""); setCommPublished(false);
    try {
      const { error: dbError } = await supabase.from("community_posts").insert({
        title:         commTitle.trim(),
        content:       commText.trim(),
        video_url:     cleanBunnyUrl(commVideoUrl),
        thumbnail_url: commThumbUrl.trim() || null,
        tier_required: commTarget === "accelerator" ? "accelerator" : "navigator",
        post_type:     "leadership_video",
        agent_name:    "DeAnna Upshaw",
        is_active:     true,
        published_at:  new Date().toISOString(),
      });
      if (dbError) throw dbError;

      setCommPublished(true);
      setCommTitle(""); setCommText(""); setCommVideoUrl(""); setCommThumbUrl(""); setCommTarget("open");
      setTimeout(() => setCommPublished(false), 5000);
    } catch (err) {
      setCommError((err instanceof Error ? err.message : null) || "Publish failed. Please try again.");
    }
    setCommPublishing(false);
  };

  const labReady  = !!(labTitle.trim() && labMonth.trim() && labVideoUrl.trim());
  const commReady = !!(commTitle.trim() && commVideoUrl.trim());

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>
            DeAnna's Leadership Lab™
          </h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>
            Publish monthly Leadership Lab videos and post videos to the community
          </p>
        </div>

        {/* ── Publish Card ── */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "1.5rem", marginBottom: "1.5rem" }}>

          {/* ── Video Type Toggle ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🎬</span>
            <div style={{ display: "flex", background: "rgba(10,35,66,0.06)", borderRadius: 8, padding: 3, gap: 3 }}>
              {(["monthly", "community"] as VideoType[]).map((t) => {
                const active = videoType === t;
                const isMonthly = t === "monthly";
                return (
                  <button
                    key={t}
                    onClick={() => { setVideoType(t); setError(""); setCommError(""); }}
                    style={{
                      border: "none", borderRadius: 6, padding: "0.45rem 1rem",
                      fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700,
                      letterSpacing: "0.06em", cursor: "pointer", transition: "all 0.18s",
                      background: active ? (isMonthly ? "#D4AF37" : "#1B4D8E") : "transparent",
                      color: active ? (isMonthly ? "#0A2342" : "#FFFFFF") : "rgba(10,35,66,0.45)",
                    }}>
                    {isMonthly ? "Monthly Lab" : "Community Post"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ══ MONTHLY FIELDS ══ */}
          {videoType === "monthly" && (
            <>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Upload your video to Bunny Stream first, then paste the embed URL below. Accelerator members are notified automatically via GHL.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>
                <div>
                  <label style={labelStyle}>Video Title</label>
                  <input type="text" placeholder="e.g. AI Leadership in Action"
                    value={labTitle} onChange={e => { setLabTitle(e.target.value); setError(""); }}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Month</label>
                  <input type="text" placeholder="e.g. June 2026"
                    value={labMonth} onChange={e => { setLabMonth(e.target.value); setError(""); }}
                    style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Post Body (optional)</label>
                  <textarea
                    placeholder="Add context, a note, or a call to action for your Accelerator members..."
                    value={labText}
                    onChange={e => setLabText(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Bunny Embed URL</label>
                  <input type="text" placeholder="Paste Bunny Stream embed URL"
                    value={labVideoUrl} onChange={e => { setLabVideoUrl(e.target.value); setError(""); }}
                    style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Thumbnail URL (optional)</label>
                  <input type="text" placeholder="Paste Bunny Stream Thumbnail URL"
                    value={labThumbUrl} onChange={e => setLabThumbUrl(e.target.value)}
                    style={inputStyle} />
                  {labThumbUrl.trim() && (
                    <img src={labThumbUrl.trim()} alt="Thumbnail preview"
                      style={{ marginTop: "0.5rem", width: 160, aspectRatio: "16/9", objectFit: "cover", borderRadius: 6, border: "1px solid rgba(10,35,66,0.15)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
              </div>

              {error && (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.875rem" }}>
                  {error}
                </p>
              )}

              <button onClick={handlePublish} disabled={publishing || !labReady}
                style={{
                  width: "100%", border: "none", borderRadius: 8, padding: "0.875rem 1.5rem",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  letterSpacing: "0.08em", transition: "all 0.2s",
                  cursor: (publishing || !labReady) ? "default" : "pointer",
                  background: published ? "#43A047" : !labReady ? "rgba(212,175,55,0.2)" : "#D4AF37",
                  color:      published ? "#FFFFFF"  : !labReady ? "rgba(212,175,55,0.4)" : "#0A2342",
                }}>
                {publishing ? "Publishing..." : published ? "✓ Published — Accelerator Members Notified" : "Publish + Notify Accelerator Members"}
              </button>
            </>
          )}

          {/* ══ COMMUNITY FIELDS ══ */}
          {videoType === "community" && (
            <>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                Post a video directly to the community feed. Choose which community to post to below.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", marginBottom: "1.25rem" }}>

                <div>
                  <label style={labelStyle}>Video Title</label>
                  <input type="text" placeholder="e.g. This Week's AI Leadership Insight"
                    value={commTitle} onChange={e => { setCommTitle(e.target.value); setCommError(""); }}
                    style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Post Body (optional)</label>
                  <textarea
                    placeholder="Add context, a question, or a call to action for your members..."
                    value={commText}
                    onChange={e => setCommText(e.target.value)}
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Bunny Embed URL</label>
                  <input type="text" placeholder="Paste Bunny Stream embed URL"
                    value={commVideoUrl} onChange={e => { setCommVideoUrl(e.target.value); setCommError(""); }}
                    style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Thumbnail URL (optional)</label>
                  <input type="text" placeholder="Paste Bunny Stream Thumbnail URL"
                    value={commThumbUrl} onChange={e => setCommThumbUrl(e.target.value)}
                    style={inputStyle} />
                  {commThumbUrl.trim() && (
                    <img src={commThumbUrl.trim()} alt="Thumbnail preview"
                      style={{ marginTop: "0.5rem", width: 160, aspectRatio: "16/9", objectFit: "cover", borderRadius: 6, border: "1px solid rgba(10,35,66,0.15)" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Post To</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {([
                      { value: "open",        label: "Open Community",    desc: "All Navigator + Accelerator members" },
                      { value: "accelerator", label: "Accelerator Circle", desc: "Accelerator members only"           },
                    ] as { value: CommTarget; label: string; desc: string }[]).map((opt) => {
                      const active = commTarget === opt.value;
                      return (
                        <button key={opt.value} onClick={() => setCommTarget(opt.value)}
                          style={{
                            flex: 1, border: `1.5px solid ${active ? "#1B4D8E" : "rgba(10,35,66,0.15)"}`,
                            borderRadius: 8, padding: "0.6rem 0.75rem", cursor: "pointer",
                            background: active ? "rgba(27,77,142,0.06)" : "#FFFFFF",
                            textAlign: "left", transition: "all 0.15s",
                          }}>
                          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: active ? "#1B4D8E" : "rgba(10,35,66,0.5)", marginBottom: 2 }}>
                            {active ? "✓ " : ""}{opt.label}
                          </div>
                          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: "rgba(10,35,66,0.35)" }}>
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {commError && (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.875rem" }}>
                  {commError}
                </p>
              )}

              <button onClick={handleCommunityPublish} disabled={commPublishing || !commReady}
                style={{
                  width: "100%", border: "none", borderRadius: 8, padding: "0.875rem 1.5rem",
                  fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  letterSpacing: "0.08em", transition: "all 0.2s",
                  cursor: (commPublishing || !commReady) ? "default" : "pointer",
                  background: commPublished ? "#43A047" : !commReady ? "rgba(27,77,142,0.12)" : "#1B4D8E",
                  color:      commPublished ? "#FFFFFF"  : !commReady ? "rgba(27,77,142,0.3)"  : "#FFFFFF",
                }}>
                {commPublishing ? "Publishing..." : commPublished
                  ? `✓ Posted to ${commTarget === "accelerator" ? "Accelerator Circle" : "Open Community"}`
                  : `Post to ${commTarget === "accelerator" ? "Accelerator Circle" : "Open Community"}`}
              </button>
            </>
          )}

        </div>

        {/* ── How it works ── */}
        <div style={{ background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.5rem" }}>How it works</p>
          <ul style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.72rem", lineHeight: 1.8, paddingLeft: "1.25rem", margin: 0 }}>
            <li><strong>Monthly Lab</strong> — paste the Bunny embed URL, saves to <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 4px", borderRadius: 3 }}>lab_videos</code>, notifies Accelerator members via GHL. Newest active row plays automatically on the Lab page.</li>
            <li><strong>Community Post</strong> — adds the video directly to the community feed with your title and body text. Choose Open Community (Navigator+) or Accelerator Circle (Accelerator only).</li>
            <li>Upload your video to Bunny Stream first, then copy the embed URL from the Bunny dashboard and paste it here.</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
