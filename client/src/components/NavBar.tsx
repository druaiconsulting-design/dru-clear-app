import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const NAV_LINKS = [
  { label: "Portal",      href: "/portal" },
  { label: "Frameworks",  href: "/frameworks" },
  { label: "Resources",   href: "/resources" },
  { label: "Daily",       href: "/daily" },
  { label: "ROI",         href: "/roi" },
  { label: "Affiliate",   href: "/affiliate" },

  ];
export default function NavBar({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoggedIn, isAdmin, user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav style={{
      width: "100%",
      background: "#071a30",
      borderBottom: "1px solid rgba(212,175,55,0.2)",
      padding: "0 1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 56,
      position: "sticky",
      top: 0,
      zIndex: 1000,
      boxSizing: "border-box",
    }}>
      {/* Logo */}
      <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
        <img src="https://assets.cdn.filesafe.space/gl07I4JnbkGgW8zJprSz/media/69d1a1c384c045c2744d50f6.png" alt="DRU CLEAR™" style={{ height: 34, width: "auto" }} />
      </a>

      {/* Desktop links */}
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }} className="desktop-nav">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "0.72rem",
              fontWeight: active === link.href ? 700 : 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: active === link.href ? "#D4AF37" : "rgba(255,255,255,0.55)",
              textDecoration: "none",
              padding: "0.4rem 0.75rem",
              borderRadius: 4,
              borderBottom: active === link.href ? "2px solid #D4AF37" : "2px solid transparent",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active === link.href ? "#D4AF37" : "rgba(255,255,255,0.55)"; }}
          >
            {link.label}
          </a>
        ))}

        {/* Right side — role aware */}
        {!isLoggedIn && (
          <a href="/login" style={{
            marginLeft: "0.5rem",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#D4AF37",
            textDecoration: "none",
            padding: "0.35rem 0.8rem",
            borderRadius: 4,
            border: "1px solid rgba(212,175,55,0.4)",
            transition: "all 0.2s",
          }}>
            Sign In
          </a>
        )}

        {isLoggedIn && isAdmin && active !== "/portal" && (
          <a href="/portal" style={{
            marginLeft: "0.5rem",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#D4AF37",
            textDecoration: "none",
            padding: "0.35rem 0.8rem",
            borderRadius: 4,
            background: "rgba(212,175,55,0.08)",
            border: "1px solid rgba(212,175,55,0.3)",
            transition: "all 0.2s",
          }}>
            Client View
          </a>
        )}
        {isLoggedIn && isAdmin && active === "/portal" && (
          <a href="/admin" style={{
            marginLeft: "0.5rem",
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.68rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#C2185B",
            textDecoration: "none",
            padding: "0.35rem 0.8rem",
            borderRadius: 4,
            background: "rgba(194,24,91,0.08)",
            border: "1px solid rgba(194,24,91,0.3)",
            transition: "all 0.2s",
          }}>
            Admin View
          </a>
        )}

        {isLoggedIn && (
          <button
            onClick={handleLogout}
            style={{
              marginLeft: "0.5rem",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.5)",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "0.35rem 0.8rem",
              borderRadius: 4,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          >
            Log Out
          </button>
        )}
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        style={{ display: "none", background: "transparent", border: "none", cursor: "pointer", padding: "0.5rem" }}
        className="mobile-menu-btn"
        aria-label="Menu"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          {menuOpen ? (
            <path d="M4 4L18 18M18 4L4 18" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
          ) : (
            <>
              <line x1="3" y1="6" x2="19" y2="6" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="3" y1="11" x2="19" y2="11" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="3" y1="16" x2="19" y2="16" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: "absolute",
          top: 56,
          left: 0,
          right: 0,
          background: "#071a30",
          borderBottom: "1px solid rgba(212,175,55,0.2)",
          padding: "0.75rem 1.25rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          zIndex: 999,
        }}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "0.8rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active === link.href ? "#D4AF37" : "rgba(255,255,255,0.7)",
                textDecoration: "none",
                padding: "0.6rem 0.5rem",
                borderBottom: "1px solid rgba(212,175,55,0.08)",
              }}
            >
              {link.label}
            </a>
          ))}
          {isLoggedIn && isAdmin && (
            <a href="/admin" onClick={() => setMenuOpen(false)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C2185B", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>Admin</a>
          )}
          {isLoggedIn ? (
            <button onClick={() => { setMenuOpen(false); handleLogout(); }} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", background: "none", border: "none", padding: "0.6rem 0.5rem", textAlign: "left", cursor: "pointer" }}>Log Out</button>
          ) : (
            <a href="/login" onClick={() => setMenuOpen(false)} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#D4AF37", textDecoration: "none", padding: "0.6rem 0.5rem" }}>Sign In</a>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
