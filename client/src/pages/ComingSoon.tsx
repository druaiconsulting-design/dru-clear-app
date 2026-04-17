import { useState } from "react";
import NavBar from "../components/NavBar";

const WEBHOOK_LEAD_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleWaitlist = async () => {
    if (!email || !firstName) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        event_type: "waitlist_signup",
        tags: "Waitlist-DRU-Scale-System",
        first_name: firstName,
        email,
        offer_title: "DRU Scale System",
        timestamp: new Date().toISOString(),
      });
      await fetch(`${WEBHOOK_LEAD_URL}?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "",
      });
    } catch {}
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/coming-soon" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Coming Soon</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Something Big Is Coming</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
            The DRU Scale System™ is launching soon — the exact system DeAnna used to build a global AI consulting empire. Join the waitlist to be first in.
          </p>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, padding: "1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Join the Waitlist</p>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1rem" }}>Be first to know when the DRU Scale System™ launches.</p>
          {!submitted ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
              <button onClick={handleWaitlist} disabled={loading || !email || !firstName} style={{ background: "#C2185B", color: "#FFFFFF", border: "none", borderRadius: 6, padding: "0.75rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", letterSpacing: "0.08em", cursor: email && firstName ? "pointer" : "not-allowed", opacity: email && firstName ? 1 : 0.5 }}>
                {loading ? "Joining..." : "Join the Waitlist →"}
              </button>
            </div>
          ) : (
            <div style={{ background: "rgba(67,160,71,0.08)", border: "1px solid rgba(67,160,71,0.3)", borderRadius: 6, padding: "0.75rem", textAlign: "center" }}>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#43A047", fontWeight: 700, fontSize: "0.8rem" }}>✓ You're on the waitlist! We'll be in touch.</p>
            </div>
          )}
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C2185B", background: "rgba(194,24,91,0.12)", border: "1px solid rgba(194,24,91,0.3)", borderRadius: 4, padding: "0.2rem 0.55rem" }}>New</span>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.25rem" }}>DRU Scale System™</h2>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "0.06em", marginBottom: "1rem" }}>Build · Automate · Scale</p>
          <p style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.75, marginBottom: "1rem" }}>The exact system DeAnna used to build a global AI consulting empire — now available for entrepreneurs and consultants ready to scale with AI. Course + Mastermind + Done-With-You VIP.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {[
              "8 core modules — self-paced with lifetime access",
              "Live group coaching calls with DeAnna",
              "GHL white label affiliate setup included",
              "AI tools stack — Manus, Lovable, Claude",
              "Build your own IP framework",
              "Revenue while you sleep architecture",
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
                <span style={{ color: "#C2185B", fontSize: "0.7rem", marginTop: 2, flexShrink: 0 }}>✦</span>
                <span style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.5 }}>{f}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontWeight: 700, fontSize: "0.82rem", marginTop: "1rem" }}>Starting at $2,997</p>
        </div>

        <div style={{ marginTop: "2rem", textAlign: "center", padding: "1.5rem", background: "rgba(212,175,55,0.04)", border: "1px solid rgba(212,175,55,0.12)", borderRadius: 10 }}>
          <p style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "0.95rem", fontStyle: "italic", lineHeight: 1.8 }}>
            "I walk with purpose, lead with AI authority,<br/>and empower transformation through effective AI."
          </p>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", letterSpacing: "0.08em", marginTop: "0.5rem" }}>— DeAnna R. Upshaw</p>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
