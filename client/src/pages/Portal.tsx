import { useState } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";

function getUserDisplay(user: any): { firstName: string; avatarUrl: string | null; initials: string } {
  const firstName = user?.firstName || "";
  const fullName = user?.fullName || firstName;
  const email = user?.email || "";
  const avatarUrl = user?.picture || null;
  const displayFirst = firstName || email.split("@")[0] || "";
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return { firstName: displayFirst, avatarUrl, initials };
}

function PortalAvatar({ user }: { user: any }) {
  const { avatarUrl, initials } = getUserDisplay(user);
  const [imgError, setImgError] = useState(false);
  if (avatarUrl && !imgError) {
    return (
      <img src={avatarUrl} alt="Profile" onError={() => setImgError(true)}
        style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(212,175,55,0.5)", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(212,175,55,0.12)", border: "2px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>{initials}</span>
    </div>
  );
}

export default function Portal() {
  const { user } = useAuth();
  const userDisplay = user ? getUserDisplay(user) : { firstName: "", avatarUrl: null, initials: "" };

  const QUICK_ACTIONS = [
    {
      icon: "📋",
      label: "My Assessment",
      sub: "View your scorecard results",
      href: "/",
      external: false,
    },
    {
      icon: "⚡",
      label: "Daily Connection",
      sub: "Today's leadership insight",
      href: "/daily",
      external: false,
      notification: true,
    },
    {
      icon: "✉️",
      label: "Need Support",
      sub: "Send DeAnna a message",
      href: "mailto:support@druaiconsulting.com",
      external: true,
    },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/portal" />

      <main style={{ flex: 1, padding: "2.5rem 1.5rem", maxWidth: 680, margin: "0 auto", width: "100%" }}>

        {/* Personalized welcome header */}
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Your AI Transformation Hub</p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.875rem" }}>
            {user && <PortalAvatar user={user} />}
            <div>
              <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "2rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>
                {userDisplay.firstName
                  ? <>Welcome Back, <span style={{ color: "#D4AF37" }}>{userDisplay.firstName}</span></>
                  : <>Welcome Back</>
                }
              </h1>
              {user?.email && (
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.35)", fontSize: "0.72rem", margin: 0 }}>
                  {user.email}
                </p>
              )}
            </div>
          </div>
          <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Inter', sans-serif", fontSize: "0.9rem", lineHeight: 1.7 }}>
            Everything you need to accelerate your AI leadership journey — in one place.
          </p>
        </div>

        {/* 3 Quick action cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
          {QUICK_ACTIONS.map((item) => (
            <a key={item.label} href={item.href} style={{ textDecoration: "none" }}>
              <div
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 10, padding: "1.25rem 1rem", cursor: "pointer", transition: "border-color 0.2s, background 0.2s", height: "100%", boxSizing: "border-box" as const, position: "relative" as const }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.5)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(212,175,55,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(212,175,55,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                {/* Notification dot — Sprint 3 will make this dynamic */}
                {item.notification && (
                  <div style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#C2185B", border: "1.5px solid #0A2342" }} />
                )}
                <div style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{item.icon}</div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>{item.label}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", lineHeight: 1.5 }}>{item.sub}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Transformation Pathway */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 10, padding: "1.5rem", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>Your Transformation Pathway</p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", overflowX: "auto", paddingBottom: "0.5rem" }}>
            {["Discover", "Diagnose", "Design", "Deploy", "Dominate"].map((stage, i) => (
              <div key={stage} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                <div style={{
                  background: i === 0 ? "#C2185B" : i === 1 ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${i === 0 ? "#C2185B" : i === 1 ? "rgba(212,175,55,0.4)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 6, padding: "0.4rem 0.75rem", textAlign: "center" as const,
                }}>
                  <p style={{ fontFamily: "'Montserrat', sans-serif", color: i === 0 ? "#FFFFFF" : i === 1 ? "#D4AF37" : "rgba(255,255,255,0.35)", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.06em" }}>{stage}</p>
                </div>
                {i < 4 && <span style={{ color: "rgba(212,175,55,0.4)", fontSize: "0.8rem" }}>→</span>}
              </div>
            ))}
          </div>
          <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.7rem", marginTop: "0.75rem", fontStyle: "italic" }}>
            You are in the Discover stage. Your diagnostic unlocks the next step.
          </p>
        </div>

      </main>

      <footer style={{ textAlign: "center", padding: "1rem", color: "rgba(255,255,255,0.2)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.65rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
