import { useState } from "react";
import NavBar from "../components/NavBar";

const WEBHOOK_LEAD_URL = "https://services.leadconnectorhq.com/hooks/gl07I4JnbkGgW8zJprSz/webhook-trigger/21253f6d-4eea-4781-8b9b-8ab28cb3b046";

const COMING_SOON = [
  {
    id: "scale",
    badge: "New",
    badgeColor: "#C2185B",
    icon: "🚀",
    title: "DRU Scale System™",
    subtitle: "Build · Automate · Scale",
    description: "The exact system DeAnna used to build a global AI consulting empire — now available for entrepreneurs and consultants ready to scale with AI. Course + Mastermind + Done-With-You VIP.",
    features: [
      "8 core modules — self-paced with lifetime access",
      "Live group coaching calls with DeAnna",
      "GHL white label affiliate setup included",
      "AI tools stack — Manus, Lovable, Claude",
      "Build your own IP framework",
      "Revenue while you sleep architecture",
    ],
    price: "Starting at $2,997",
    cta: "Join the Waitlist",
  },


];

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleWaitlist = async (offerId: string, offerTitle: string) => {
    if (!email || !firstName) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        event_type: "waitlist_signup",
        tags: `Waitlist-${offerTitle}`,
        first_name: firstName,
        email,
        offer_id: offerId,
        offer_title: offerTitle,
        timestamp: new Date().toISOString(),
      });
      await fetch(`${WEBHOOK_LEAD_URL}?${params.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "",
      });
    } catch {}
    setLoading(false);
    setSubmitted(offerId);
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/coming-soon" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#C2185B", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Sprint 4 — Coming Soon</p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.75rem" }}>Something Big Is Coming</h1>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.7, maxWidth: 500, margin: "0 auto" }}>
            The DRU Scale System™ is launching soon — the exact system DeAnna used to build a global AI consulting empire. Join the waitlist to be first in.
          </p>
        </div>

        {/* Waitlist capture */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, padding: "1.5rem", marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Global Waitlist</p>
          <p style={{ color: "rgba(230,230,230,0.65)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", marginBottom: "1rem" }}>Enter your info once — get notified for all upcoming launches.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={{ flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
              <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 2, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 6, padding: "0.65rem 0.875rem", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", outline: "none" }} />
            </div>
          </div>
        </div>

        {/* Coming soon cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {COMING_SOON.map((item) => (
            <div key={item.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${item.badgeColor}30`,
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {/* Card header */}
              <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid rgba(212,175,55,0.1)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
                    <span style={{
                      fontFamily: "'Montserrat', sans-serif",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: item.badgeColor,
                      background: `${item.badgeColor}18`,
                      border: `1px solid ${item.badgeColor}40`,
                      borderRadius: 4,
                      padding: "0.2rem 0.55rem",
                    }}>{item.badge}</span>
                  </div>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.75rem", fontWeight: 700 }}>{item.price}</span>
                </div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", fontSize: "1.35rem", fontWeight: 700, marginBottom: "0.2rem" }}>{item.title}</h2>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.7rem", letterSpacing: "0.06em" }}>{item.subtitle}</p>
              </div>

              {/* Card body */}
              <div style={{ padding: "1.25rem 1.5rem" }}>
                <p style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.82rem", lineHeight: 1.75, marginBottom: "1rem" }}>{item.description}</p>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
                  {item.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
                      <span style={{ color: item.badgeColor, fontSize: "0.7rem", marginTop: 2, flexShrink: 0 }}>✦</span>
                      <span style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.78rem", lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>

                {submitted === item.id ? (
                  <div style={{ background: "rgba(67,160,71,0.08)", border: "1px solid rgba(67,160,71,0.3)", borderRadius: 6, padding: "0.75rem", textAlign: "center" }}>
                    <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#43A047", fontWeight: 700, fontSize: "0.8rem" }}>✓ You're on the waitlist! We'll be in touch.</p>
                  </div>
                ) : (
                  <button
                    onClick={() => handleWaitlist(item.id, item.title)}
                    disabled={loading || !email || !firstName}
                    style={{
                      width: "100%",
                      background: item.badgeColor,
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 6,
                      padding: "0.75rem 1rem",
                      fontFamily: "'Montserrat', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      letterSpacing: "0.08em",
                      cursor: email && firstName ? "pointer" : "not-allowed",
                      opacity: email && firstName ? 1 : 0.5,
                    }}
                  >
                    {loading ? "Joining..." : `${item.cta} →`}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Mantra */}
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
