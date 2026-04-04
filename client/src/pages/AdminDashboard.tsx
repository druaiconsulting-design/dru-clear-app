/**
 * DRU CLEAR™ Admin Dashboard
 * Password-protected view of all scorecard submissions stored in localStorage.
 * Design: Executive Prestige — Dark Luxury (matches main app)
 *
 * TO CHANGE THE ADMIN PASSWORD:
 * Update the ADMIN_PASSWORD constant below.
 */

import { useState, useEffect, useCallback } from "react";

// ─── Admin Password ────────────────────────────────────────────────────────────
// Change this to your preferred password before publishing.
const ADMIN_PASSWORD = "DruClear2026!";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PillarScores {
  clarity: number;
  leadership: number;
  execution: number;
  alignment: number;
  results: number;
}

interface Submission {
  event: string;
  fullName: string;
  email: string;
  company: string;
  role: string;
  totalScore?: number;
  pillarScores?: PillarScores;
  tier?: string;
  topGaps?: string[];
  timestamp: string;
  savedAt?: string;
}

interface StorageEntry {
  key: string;
  data: Submission;
  savedAt: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function loadSubmissions(): Submission[] {
  try {
    const raw = localStorage.getItem("dru_clear_submissions");
    if (!raw) return [];
    const entries: StorageEntry[] = JSON.parse(raw);
    // Only show scorecard_complete events; merge with lead_capture if needed
    const complete = entries
      .filter((e) => e.data?.event === "scorecard_complete")
      .map((e) => ({ ...e.data, savedAt: e.savedAt }));
    return complete.sort(
      (a, b) => new Date(b.savedAt || b.timestamp).getTime() - new Date(a.savedAt || a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function tierColor(tier?: string): string {
  switch (tier) {
    case "EMERGING": return "#E53935";
    case "DEVELOPING": return "#D4AF37";
    case "ADVANCING": return "#1E88E5";
    case "LEADING": return "#43A047";
    default: return "#E6E6E6";
  }
}

function exportCSV(submissions: Submission[]) {
  const headers = [
    "Date/Time",
    "Full Name",
    "Email",
    "Company",
    "Role",
    "Total Score",
    "Tier",
    "Top Gap 1",
    "Top Gap 2",
    "C — Clarity",
    "L — Leadership",
    "E — Execution",
    "A — Alignment",
    "R — Results",
  ];

  const rows = submissions.map((s) => [
    formatDate(s.savedAt || s.timestamp),
    s.fullName || "",
    s.email || "",
    s.company || "",
    s.role || "",
    s.totalScore ?? "",
    s.tier || "",
    s.topGaps?.[0] || "",
    s.topGaps?.[1] || "",
    s.pillarScores?.clarity ?? "",
    s.pillarScores?.leadership ?? "",
    s.pillarScores?.execution ?? "",
    s.pillarScores?.alignment ?? "",
    s.pillarScores?.results ?? "",
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dru-clear-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem("dru_admin_auth", "1");
      onLogin();
    } else {
      setError("Incorrect password.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0A2342",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(212,175,55,0.2)",
          borderRadius: 8,
          padding: "2.5rem 2rem",
        }}
      >
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "1.5px solid rgba(212,175,55,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "1rem",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2z"
                stroke="#D4AF37"
                strokeWidth="1.5"
                fill="none"
              />
              <text x="8.5" y="15.5" fontSize="8" fill="#D4AF37" fontFamily="serif" fontWeight="bold">
                DC
              </text>
            </svg>
          </div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "#D4AF37",
              fontSize: "1.4rem",
              fontWeight: 700,
              marginBottom: "0.25rem",
            }}
          >
            Admin Access
          </h1>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.8rem" }}>
            DRU CLEAR™ Scorecard Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "0.75rem",
                color: "rgba(230,230,230,0.6)",
                marginBottom: "0.4rem",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Password
            </label>
            <input
              className="dru-input"
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              style={shake ? { borderColor: "#E53935", animation: "shake 0.4s ease" } : {}}
            />
          </div>

          {error && (
            <p style={{ color: "#E53935", fontSize: "0.8rem", fontFamily: "'Inter', sans-serif" }}>
              {error}
            </p>
          )}

          <button className="btn-gold" type="submit" style={{ marginTop: "0.5rem" }}>
            Enter Dashboard →
          </button>
        </form>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState("");

  const reload = useCallback(() => {
    setSubmissions(loadSubmissions());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filtered = submissions.filter((s) => {
    const q = filter.toLowerCase();
    return (
      !q ||
      s.fullName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.company?.toLowerCase().includes(q) ||
      s.tier?.toLowerCase().includes(q)
    );
  });

  // Summary stats
  const total = submissions.length;
  const avgScore =
    total > 0
      ? Math.round(submissions.reduce((acc, s) => acc + (s.totalScore || 0), 0) / total)
      : 0;
  const tierCounts = submissions.reduce<Record<string, number>>((acc, s) => {
    if (s.tier) acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0A2342",
        color: "#E6E6E6",
        fontFamily: "'Inter', sans-serif",
        overflowX: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(212,175,55,0.15)",
          padding: "1rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              color: "#D4AF37",
              fontSize: "1.3rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            DRU CLEAR™ Admin
          </h1>
          <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.75rem", margin: 0 }}>
            Scorecard Submissions Dashboard
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            onClick={() => exportCSV(filtered)}
            style={{
              background: "rgba(212,175,55,0.12)",
              border: "1px solid rgba(212,175,55,0.3)",
              color: "#D4AF37",
              borderRadius: 4,
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = "rgba(212,175,55,0.22)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = "rgba(212,175,55,0.12)";
            }}
          >
            ↓ Export CSV
          </button>
          <button
            onClick={onLogout}
            style={{
              background: "transparent",
              border: "1px solid rgba(230,230,230,0.15)",
              color: "rgba(230,230,230,0.5)",
              borderRadius: 4,
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Log Out
          </button>
        </div>
      </div>

      <div style={{ padding: "1.5rem" }}>
        {/* Summary Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {[
            { label: "Total Submissions", value: total },
            { label: "Avg Score", value: total > 0 ? `${avgScore}/75` : "—" },
            { label: "Emerging", value: tierCounts["EMERGING"] || 0, color: "#E53935" },
            { label: "Developing", value: tierCounts["DEVELOPING"] || 0, color: "#D4AF37" },
            { label: "Advancing", value: tierCounts["ADVANCING"] || 0, color: "#1E88E5" },
            { label: "Leading", value: tierCounts["LEADING"] || 0, color: "#43A047" },
          ].map((card) => (
            <div
              key={card.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(212,175,55,0.1)",
                borderRadius: 6,
                padding: "1rem",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "1.6rem",
                  fontWeight: 700,
                  color: card.color || "#D4AF37",
                  fontFamily: "'Playfair Display', serif",
                  lineHeight: 1,
                  marginBottom: "0.3rem",
                }}
              >
                {card.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(230,230,230,0.5)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* Search / Filter */}
        <div style={{ marginBottom: "1rem" }}>
          <input
            className="dru-input"
            style={{ maxWidth: 320 }}
            placeholder="Filter by name, email, company, or tier..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "4rem 2rem",
              color: "rgba(230,230,230,0.35)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>📋</div>
            <p style={{ fontSize: "0.9rem" }}>
              {total === 0
                ? "No submissions yet. Submissions will appear here once users complete the scorecard."
                : "No results match your filter."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 6, border: "1px solid rgba(212,175,55,0.12)" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
                minWidth: 900,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(212,175,55,0.08)",
                    borderBottom: "1px solid rgba(212,175,55,0.2)",
                  }}
                >
                  {[
                    "Date/Time",
                    "Full Name",
                    "Email",
                    "Company",
                    "Role",
                    "Score",
                    "Tier",
                    "Top Gaps",
                    "C",
                    "L",
                    "E",
                    "A",
                    "R",
                  ].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: "0.75rem 0.875rem",
                        textAlign: "left",
                        color: "rgba(212,175,55,0.8)",
                        fontWeight: 600,
                        fontSize: "0.72rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        "rgba(212,175,55,0.05)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)";
                    }}
                  >
                    <td style={{ padding: "0.75rem 0.875rem", color: "rgba(230,230,230,0.6)", whiteSpace: "nowrap" }}>
                      {formatDate(s.savedAt || s.timestamp)}
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", color: "#FFFFFF", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {s.fullName}
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", color: "rgba(230,230,230,0.7)" }}>
                      <a
                        href={`mailto:${s.email}`}
                        style={{ color: "rgba(212,175,55,0.8)", textDecoration: "none" }}
                      >
                        {s.email}
                      </a>
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", color: "rgba(230,230,230,0.8)", whiteSpace: "nowrap" }}>
                      {s.company}
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", color: "rgba(230,230,230,0.7)", whiteSpace: "nowrap" }}>
                      {s.role}
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", textAlign: "center" }}>
                      <span
                        style={{
                          color: "#D4AF37",
                          fontWeight: 700,
                          fontSize: "0.9rem",
                          fontFamily: "'Playfair Display', serif",
                        }}
                      >
                        {s.totalScore ?? "—"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", whiteSpace: "nowrap" }}>
                      <span
                        style={{
                          color: tierColor(s.tier),
                          fontWeight: 600,
                          fontSize: "0.72rem",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {s.tier || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "0.75rem 0.875rem", color: "rgba(230,230,230,0.7)" }}>
                      {s.topGaps?.join(", ") || "—"}
                    </td>
                    {/* Pillar scores */}
                    {(["clarity", "leadership", "execution", "alignment", "results"] as const).map(
                      (pillar) => (
                        <td
                          key={pillar}
                          style={{
                            padding: "0.75rem 0.875rem",
                            textAlign: "center",
                            color:
                              (s.pillarScores?.[pillar] ?? 0) <= 6
                                ? "#E53935"
                                : (s.pillarScores?.[pillar] ?? 0) <= 9
                                ? "#D4AF37"
                                : "#43A047",
                            fontWeight: 600,
                          }}
                        >
                          {s.pillarScores?.[pillar] ?? "—"}
                        </td>
                      )
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer note */}
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "0.72rem",
            color: "rgba(230,230,230,0.3)",
            textAlign: "center",
          }}
        >
          Showing {filtered.length} of {total} submission{total !== 1 ? "s" : ""} · Data stored in
          browser localStorage · Export CSV to back up data
        </p>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(() => {
    return sessionStorage.getItem("dru_admin_auth") === "1";
  });

  const handleLogout = () => {
    sessionStorage.removeItem("dru_admin_auth");
    setAuthed(false);
  };

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}
