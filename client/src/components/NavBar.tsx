import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

const NAV_LINKS = [
  { label: "Portal",              href: "/portal" },
  { label: "Frameworks",          href: "/frameworks" },
  { label: "Resources",           href: "/resources" },
  { label: "Daily",               href: "/daily" },
  { label: "Join the Community",  href: "/community" },
  { label: "Affiliate",           href: "/affiliate" },
];

// ─── Avatar Helper ────────────────────────────────────────────────────────────
function getUserDisplay(user: any): { name: string; firstName: string; avatarUrl: string | null; initials: string } {
  const firstName = user?.firstName || "";
  const fullName = user?.fullName || firstName;
  const email = user?.email || "";
  const avatarUrl = user?.picture || null;
  const displayFirst = firstName || email.split("@")[0] || "User";
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  return { name: fullName || email, firstName: displayFirst, avatarUrl, initials };
}

function Avatar({ user, size = 30 }: { user: any; size?: number }) {
  const { avatarUrl, initials } = getUserDisplay(user);
  const [imgError, setImgError] = useState(false);
  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(212,175,55,0.5)", flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "rgba(212,175,55,0.15)", border: "1.5px solid rgba(212,175,55,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: size * 0.35, fontWeight: 700, color: "#D4AF37", lineHeight: 1 }}>{initials}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function NavBar({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [userTier, setUserTier]   = useState<string | null>(null);
  const { isLoggedIn, isAdmin, user, logout } = useAuth();
  const userDisplay = user ? getUserDisplay(user) : null;

  useEffect(() => {
    if (!isLoggedIn || !(user as any)?.id) { setUserTier(null); return; }
    supabase.from("profiles").select("tier").eq("id", (user as any).id).single()
      .then(({ data }) => setUserTier(data?.tier ?? null));
  }, [isLoggedIn, (user as any)?.id]);

  const handleLogout = async () => { await logout(); };

  const adminLinkStyle = (href: string): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "0.72rem",
    fontWeight: active === href ? 700 : 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: active === href ? "#D4AF37" : "rgba(212,175,55,0.7)",
    textDecoration: "none",
    padding: "0.4rem 0.75rem",
    borderRadius: 4,
    borderBottom: active === href ? "2px solid #D4AF37" : "2px solid transparent",
    transition: "color 0.2s",
  });

  const navLinkStyle = (href: string): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif",
    fontSize: "0.72rem",
    fontWeight: active === href ? 700 : 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: active === href ? "#D4AF37" : "rgba(255,255,255,0.55)",
    textDecoration: "none",
    padding: "0.4rem 0.75rem",
    borderRadius: 4,
    borderBottom: active === href ? "2px solid #D4AF37" : "2px solid transparent",
    transition: "color 0.2s",
  });

  return (
    <nav style={{
      width: "100%",
      background: "#163D6E",
      borderBottom: "1px solid rgba(212,175,55,0.2)",
      padding: "0 1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 120,
      position: "sticky",
      top: 0,
      zIndex: 1000,
      boxSizing: "border-box",
    }}>

      {/* ── Logo ── */}
      <a href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
        <img
          src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663512997684/PPrwKSVlySJjkhTX.png"
          alt="DRU CLEAR™"
          style={{ height: 120, width: "auto" }}
        />
      </a>

      {/* ── Desktop links ── */}
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }} className="desktop-nav">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href} style={navLinkStyle(link.href)}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active === link.href ? "#D4AF37" : "rgba(255,255,255,0.55)"; }}>
            {link.label}
          </a>
        ))}

        {/* Accelerator-only Lab link */}
        {isLoggedIn && userTier === "accelerator" && (
          <a href="/lab" style={navLinkStyle("/lab")}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active === "/lab" ? "#D4AF37" : "rgba(255,255,255,0.55)"; }}>
            🎬 Lab
          </a>
        )}

        {/* Admin-only Twin link */}
        {isLoggedIn && isAdmin && (
          <a href="/twin" style={adminLinkStyle("/twin")}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active === "/twin" ? "#D4AF37" : "rgba(212,175,55,0.7)"; }}>
            ✦ Twin
          </a>
        )}

        {/* Admin-only Intelligence Dashboard link */}
        {isLoggedIn && isAdmin && (
          <a href="/admin-approvals" style={adminLinkStyle("/admin-approvals")}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = active === "/admin-approvals" ? "#D4AF37" : "rgba(212,175,55,0.7)"; }}>
            ✦ Intelligence Dashboard
          </a>
        )}

        {/* Admin-only Courses link */}
        {isLoggedIn && isAdmin && (
          <a href="https://courses.druaiconsulting.com" style={adminLinkStyle("courses")}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#D4AF37"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(212,175,55,0.7)"; }}>
            ✦ Courses
          </a>
        )}

        {/* Not logged in */}
        {!isLoggedIn && (
          <a href="/login" style={{ marginLeft: "0.5rem", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#D4AF37", textDecoration: "none", padding: "0.35rem 0.8rem", borderRadius: 4, border: "1px solid rgba(212,175,55,0.4)", transition: "all 0.2s" }}>
            Sign In
          </a>
        )}

        {/* Admin toggle */}
        {isLoggedIn && isAdmin && active !== "/portal" && (
          <a href="https://members.druaiconsulting.com" target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: "0.5rem", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#D4AF37", textDecoration: "none", padding: "0.35rem 0.8rem", borderRadius: 4, background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.3)", transition: "all 0.2s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(212,175,55,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(212,175,55,0.08)"; }}>
            👤 Client View
          </a>
        )}
        {isLoggedIn && isAdmin && active === "/portal" && (
          <a href="/admin"
            style={{ marginLeft: "0.5rem", fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#C2185B", textDecoration: "none", padding: "0.35rem 0.8rem", borderRadius: 4, background: "rgba(194,24,91,0.08)", border: "1px solid rgba(194,24,91,0.3)", transition: "all 0.2s" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(194,24,91,0.15)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(194,24,91,0.08)"; }}>
            ⚙️ Admin View
          </a>
        )}

        {/* User avatar + logout */}
        {isLoggedIn && user && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "0.5rem" }}>
            <Avatar user={user} size={30} />
            <button onClick={handleLogout}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.5)", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", padding: "0.35rem 0.8rem", borderRadius: 4, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.35)"; (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}>
              Log Out
            </button>
          </div>
        )}
      </div>

      {/* ── Mobile hamburger ── */}
      <button onClick={() => setMenuOpen(!menuOpen)}
        style={{ display: "none", background: "transparent", border: "none", cursor: "pointer", padding: "0.5rem" }}
        className="mobile-menu-btn" aria-label="Menu">
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

      {/* ── Mobile dropdown ── */}
      {menuOpen && (
        <div style={{ position: "absolute", top: 120, left: 0, right: 0, background: "#163D6E", borderBottom: "1px solid rgba(212,175,55,0.2)", padding: "0.75rem 1.25rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.25rem", zIndex: 999 }}>

          {isLoggedIn && user && userDisplay && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 0.5rem 0.875rem", borderBottom: "1px solid rgba(212,175,55,0.15)", marginBottom: "0.25rem" }}>
              <Avatar user={user} size={38} />
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontWeight: 700, fontSize: "0.78rem", margin: "0 0 1px" }}>{userDisplay.firstName}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.65rem", margin: 0 }}>{user.email}</p>
              </div>
            </div>
          )}

          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: active === link.href ? "#D4AF37" : "rgba(255,255,255,0.7)", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              {link.label}
            </a>
          ))}

          {/* Mobile Accelerator Lab link */}
          {isLoggedIn && userTier === "accelerator" && (
            <a href="/lab" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: active === "/lab" ? "#D4AF37" : "rgba(255,255,255,0.7)", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              🎬 Lab
            </a>
          )}

          {isLoggedIn && isAdmin && (
            <a href="/twin" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: active === "/twin" ? "#D4AF37" : "rgba(212,175,55,0.7)", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              ✦ Twin
            </a>
          )}

          {isLoggedIn && isAdmin && (
            <a href="/admin-approvals" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: active === "/admin-approvals" ? "#D4AF37" : "rgba(212,175,55,0.7)", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              ✦ Intelligence Dashboard
            </a>
          )}

          {isLoggedIn && isAdmin && (
            <a href="https://course.druaiconsulting.com" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(212,175,55,0.7)", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              ✦ Courses
            </a>
          )}

          {isLoggedIn && isAdmin && active !== "/portal" && (
            <a href="https://members.druaiconsulting.com" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#D4AF37", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              👤 Client View
            </a>
          )}
          {isLoggedIn && isAdmin && active === "/portal" && (
            <a href="/admin" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#C2185B", textDecoration: "none", padding: "0.6rem 0.5rem", borderBottom: "1px solid rgba(212,175,55,0.08)" }}>
              ⚙️ Admin View
            </a>
          )}

          {isLoggedIn ? (
            <button onClick={() => { setMenuOpen(false); handleLogout(); }}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.5)", background: "none", border: "none", padding: "0.6rem 0.5rem", textAlign: "left" as const, cursor: "pointer" }}>
              Log Out
            </button>
          ) : (
            <a href="/login" onClick={() => setMenuOpen(false)}
              style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#D4AF37", textDecoration: "none", padding: "0.6rem 0.5rem" }}>
              Sign In
            </a>
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
