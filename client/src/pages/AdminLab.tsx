import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

const GHL_LAB_WEBHOOK_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/70d21e5b-66f9-4aa0-8eac-5c59ed55fcaa";

export default function AdminLab() {
  const [labTitle,     setLabTitle]     = useState("");
  const [labMonth,     setLabMonth]     = useState("");
  const [labVideoUrl,  setLabVideoUrl]  = useState("");
  const [publishing,   setPublishing]   = useState(false);
  const [published,    setPublished]    = useState(false);
  const [error,        setError]        = useState("");

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

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.2)",
    borderRadius: 6, padding: "0.6rem 0.875rem", color: "#0A2342",
    fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", outline: "none", boxSizing: "border-box",
  };

  const ready = labTitle.trim() && labMonth.trim() && labVideoUrl.trim();

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>
            DeAnna's Leadership Lab™
          </h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>
            Publish monthly Leadership Lab videos for Accelerator members
          </p>
        </div>

        {/* Publish form */}
        <div style={{ background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>🎬</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 }}>
              New Lab Video
            </p>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Upload your video to Supabase storage or Bunny Stream, paste the URL below, then publish. Accelerator members are notified automatically via GHL.
          </p>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.875rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>Video Title</label>
              <input type="text" placeholder="e.g. AI Leadership in Action" value={labTitle}
                onChange={e => { setLabTitle(e.target.value); setError(""); }}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>Month</label>
              <input type="text" placeholder="e.g. June 2026" value={labMonth}
                onChange={e => { setLabMonth(e.target.value); setError(""); }}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>Video URL</label>
              <input type="text" placeholder="Paste video URL from Supabase storage or Bunny Stream" value={labVideoUrl}
                onChange={e => { setLabVideoUrl(e.target.value); setError(""); }}
                style={inputStyle} />
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.72rem", marginBottom: "0.875rem" }}>{error}</p>
          )}

          <button onClick={handlePublish} disabled={publishing || !ready}
            style={{
              width: "100%", border: "none", borderRadius: 8, padding: "0.875rem 1.5rem",
              fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em",
              cursor: (publishing || !ready) ? "default" : "pointer", transition: "all 0.2s",
              background: published ? "#43A047" : !ready ? "rgba(212,175,55,0.2)" : "#D4AF37",
              color: published ? "#FFFFFF" : !ready ? "rgba(212,175,55,0.4)" : "#0A2342",
            }}>
            {publishing ? "Publishing..." : published ? "✓ Published — Accelerator Members Notified" : "Publish + Notify Accelerator Members"}
          </button>
        </div>

        {/* Info card */}
        <div style={{ marginTop: "1.5rem", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.5rem" }}>How it works</p>
          <ul style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.72rem", lineHeight: 1.8, paddingLeft: "1.25rem", margin: 0 }}>
            <li>Video is saved to the <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>lab_videos</code> table with <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>is_active: true</code></li>
            <li>Members portal streams the most recent active video</li>
            <li>GHL webhook fires automatically to notify all Accelerator members</li>
            <li>Previous videos remain in the table for the Replays page</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
