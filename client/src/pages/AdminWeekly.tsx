import { useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";

const MEMBERS_API_BASE = "https://members.druaiconsulting.com";

export default function AdminWeekly() {
  const [pdfTitle,    setPdfTitle]    = useState("");
  const [pdfWeekOf,   setPdfWeekOf]   = useState("");
  const [pdfPath,     setPdfPath]     = useState("");
  const [publishing,  setPublishing]  = useState(false);
  const [published,   setPublished]   = useState(false);
  const [error,       setError]       = useState("");
  const [testing,     setTesting]     = useState(false);
  const [testError,   setTestError]   = useState("");

  const handleTestLink = async () => {
    if (!pdfPath.trim()) {
      setTestError("Enter a storage path first."); return;
    }
    setTesting(true); setTestError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setTestError("Not logged in."); setTesting(false); return; }

      const res = await fetch(
        `${MEMBERS_API_BASE}/api/weekly-pdf-url?path=${encodeURIComponent(pdfPath.trim())}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );

      if (!res.ok) {
        setTestError(res.status === 404 ? "File not found at that path — check spelling and bucket." : "Couldn't generate a test link.");
        setTesting(false); return;
      }

      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setTestError("Couldn't generate a test link. Try again.");
    }
    setTesting(false);
  };

  const handlePublish = async () => {
    if (!pdfTitle.trim() || !pdfWeekOf.trim() || !pdfPath.trim()) {
      setError("All fields are required before publishing."); return;
    }
    setPublishing(true); setError(""); setPublished(false);
    try {
      const { error: dbError } = await supabase.from("weekly_pdfs").insert({
        title: pdfTitle.trim(), week_of: pdfWeekOf.trim(),
        pdf_url: pdfPath.trim(), is_active: true,
      });
      if (dbError) throw dbError;
      setPublished(true);
      setPdfTitle(""); setPdfWeekOf(""); setPdfPath("");
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

  const ready = pdfTitle.trim() && pdfWeekOf.trim() && pdfPath.trim();

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
            Upload the PDF to the private <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>acc-weekly-pdfs</code> bucket, paste its storage path below (not a URL), test it, then publish.
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
              <label style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "rgba(10,35,66,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" as const, display: "block", marginBottom: "0.35rem" }}>Storage Path</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input type="text" placeholder="e.g. 2026-06-23-five-mistakes.pdf" value={pdfPath}
                  onChange={e => { setPdfPath(e.target.value); setError(""); setTestError(""); }}
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleTestLink} disabled={testing || !pdfPath.trim()}
                  style={{
                    padding: "0.6rem 1rem", borderRadius: 6, border: "1px solid rgba(30,136,229,0.3)",
                    background: "#fff", color: "#1E88E5", fontFamily: "'Montserrat', sans-serif",
                    fontSize: "0.72rem", fontWeight: 700, whiteSpace: "nowrap" as const,
                    cursor: (testing || !pdfPath.trim()) ? "default" : "pointer",
                    opacity: (testing || !pdfPath.trim()) ? 0.5 : 1,
                  }}>
                  {testing ? "Testing…" : "Test Link"}
                </button>
              </div>
              {testError && (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "#E53935", fontSize: "0.7rem", marginTop: "0.4rem" }}>{testError}</p>
              )}
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
            <li>The PDF file lives in the private <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>acc-weekly-pdfs</code> Storage bucket — this form only stores its path, not a public URL</li>
            <li>The row is saved to the <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>weekly_pdfs</code> table with <code style={{ background: "rgba(10,35,66,0.06)", padding: "1px 5px", borderRadius: 3 }}>is_active: true</code></li>
            <li>The most recent active row appears as the current week's PDF on the members Resources page</li>
            <li>Older rows stay in the table — never delete rows</li>
            <li>Accelerator members only — Navigator and free-tier members won't see this on their Resources page</li>
            <li>Members get a fresh signed link each time they click View or Download — links expire after 15 minutes, so an old shared link won't work later</li>
          </ul>
        </div>

      </main>
    </AdminLayout>
  );
}
