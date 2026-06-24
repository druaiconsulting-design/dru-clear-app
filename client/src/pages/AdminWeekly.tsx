import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

export default function AdminWeekly() {
  const [pdfTitle,    setPdfTitle]    = useState("");
  const [pdfWeekOf,   setPdfWeekOf]   = useState("");
  const [pdfUrl,      setPdfUrl]      = useState("");
  const [publishing,  setPublishing]  = useState(false);
  const [published,   setPublished]   = useState(false);
  const [error,       setError]       = useState("");

  const handlePublish = async () => {
    if (!pdfTitle.trim() || !pdfWeekOf.trim() || !pdfUrl.trim()) {
      setError("All fields are required before publishing."); return;
    }
    setPublishing(true); setError(""); setPublished(false);
    try {
      const trimmedTitle = pdfTitle.trim();

      // Case-insensitive match: if a row with this title already exists,
      // update it (refresh URL/week + bump created_at so it reads as
      // current) instead of inserting a duplicate. Avoids two rows for
      // the same PDF when a Get URL link expires and needs replacing.
      const { data: existing, error: lookupError } = await supabase
        .from("weekly_pdfs")
        .select("id")
        .ilike("title", trimmedTitle)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("weekly_pdfs")
          .update({
            week_of: pdfWeekOf.trim(),
            pdf_url: pdfUrl.trim(),
            is_active: true,
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("weekly_pdfs").insert({
          title: trimmedTitle, week_of: pdfWeekOf.trim(),
          pdf_url: pdfUrl.trim(), is_active: true,
        });
        if (insertError) throw insertError;
      }

      setPublished(true);
      setPdfTitle(""); setPdfWeekOf(""); setPdfUrl("");
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

  const ready = pdfTitle.trim() && pdfWeekOf.trim() && pdfUrl.trim();

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ padding: "2.5rem 1.5rem", maxWidth: 720, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.25rem" }}>
            Weekly Resources PDF
          </h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem" }}>
            Publish weekly framework PDFs visible to Accelerator members on the Resources page
          </p>
        </div>

        {/* Publish form */}
        <div style={{ background: "rgba(30,136,229,0.05)", border: "1px solid rgba(30,136,229,0.2)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.1rem" }}>📄</span>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1E88E5", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, margin: 0 }}>
              New Weekly PDF
            </p>
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.45)", fontSize: "0.72rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
            Upload the PDF to the <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>acc-weekly-pdfs</code> bucket, use "Get URL" (pick an expiry — 1 year recommended) on the file, paste that URL below, then publish.
          </p>

          <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.875rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>PDF Title</label>
              <input type="text" placeholder="e.g. DRU CLEAR™ AI Leadership Manual 101" value={pdfTitle}
                onChange={e => { setPdfTitle(e.target.value); setError(""); }}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>Week Of</label>
              <input type="text" placeholder="e.g. June 9, 2026" value={pdfWeekOf}
                onChange={e => { setPdfWeekOf(e.target.value); setError(""); }}
                style={inputStyle} />
            </div>
            <div>
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>PDF URL</label>
              <input type="text" placeholder="Paste URL from Supabase Storage → Get URL" value={pdfUrl}
                onChange={e => { setPdfUrl(e.target.value); setError(""); }}
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
              background: published ? "#43A047" : !ready ? "rgba(30,136,229,0.15)" : "#1E88E5",
              color: published ? "#FFFFFF" : !ready ? "rgba(30,136,229,0.4)" : "#FFFFFF",
            }}>
            {publishing ? "Publishing..." : published ? "✓ Published — Now Live on Resources Page" : "Publish to Resources Page"}
          </button>
        </div>

        {/* Info card */}
        <div style={{ marginTop: "1.5rem", background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 10, padding: "1rem 1.25rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.72rem", fontWeight: 700, marginBottom: "0.5rem" }}>How it works</p>
          <ul style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.55)", fontSize: "0.72rem", lineHeight: 1.8, paddingLeft: "1.25rem", margin: 0 }}>
            <li>Publishing checks for an existing row with the same title (case-insensitive) — if found, it updates that row's URL and week instead of creating a duplicate; if not, it creates a new row</li>
            <li>The most recent row (by last updated) appears as the current week's PDF on the members Resources page</li>
            <li>Older, different-titled rows stay in the table as Archive — they're never deleted automatically</li>
            <li>Accelerator members only — Navigator and free-tier members won't see this on their Resources page</li>
            <li>The pasted URL has an expiry set when you generate it — pick "1 year" so it doesn't quietly break; you'll need to re-publish with a fresh URL once it does</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
