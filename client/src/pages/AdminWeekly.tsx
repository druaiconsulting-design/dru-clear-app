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
      const { error: dbError } = await supabase.from("weekly_pdfs").insert({
        title: pdfTitle.trim(), week_of: pdfWeekOf.trim(),
        pdf_url: pdfUrl.trim(), is_active: true,
      });
      if (dbError) throw dbError;
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
            Publish weekly framework PDFs visible to all members on the Resources page
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
            Upload the PDF to Supabase storage (resources bucket), paste the URL below, then publish. Visible immediately to all members on the Resources page.
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
              <input type="text" placeholder="Paste PDF URL from Supabase storage" value={pdfUrl}
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
            <li>PDF is saved to the <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>weekly_pdfs</code> table with <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>is_active: true</code></li>
            <li>The most recent active row appears as the current week's PDF on the members Resources page</li>
            <li>Older rows stay in the table — never delete rows</li>
            <li>All members (Navigator and Accelerator) can access weekly PDFs</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
