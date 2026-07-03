import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import AdminLayout from "../components/AdminLayout";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Photo sources ────────────────────────────────────────────────────────────
// All agent + exec photos live in the Supabase public bucket `agent-photos`.
// Files that don't exist yet fall back to initials automatically and appear
// as soon as they are uploaded — no code change, no deployment.
const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/agent-photos`;
const RAYMOND_PHOTO = `${BUCKET}/exec-raymond-holloway.png`;
const TRAVIS_PHOTO  = `${BUCKET}/exec-travis-wealthy.png`;
const PRIYA_PHOTO   = `${BUCKET}/exec-priya-sharma.png`;

interface AgentRow {
  id: string;
  name: string;
  role: string;
  division: string;
  division_tag: string;
  division_border: string;
  division_header_bg: string;
  division_full_width: boolean;
  division_sort: number;
  sort_order: number;
  is_leader: boolean;
  photo_url: string;
}

interface DivisionGroup {
  name: string;
  tag: string;
  border: string;
  headerBg: string;
  fullWidth: boolean;
  sort: number;
  agents: AgentRow[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export default function AdminOrg() {
  const [divisions, setDivisions] = useState<DivisionGroup[]>([]);
  const [agentCount, setAgentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({});
  const [deAnnaErr,  setDeAnnaErr]  = useState(false);
  const [raymondErr, setRaymondErr] = useState(false);
  const [travisErr,  setTravisErr]  = useState(false);
  const [priyaErr,   setPriyaErr]   = useState(false);

  useEffect(() => {
    const loadAgents = async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("division_sort", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error || !data) { console.error("[AdminOrg] agents fetch failed:", error); setLoading(false); return; }

      const rows = data as AgentRow[];
      setAgentCount(rows.length);

      const grouped: DivisionGroup[] = [];
      for (const row of rows) {
        let group = grouped.find(g => g.sort === row.division_sort);
        if (!group) {
          group = {
            name: row.division, tag: row.division_tag,
            border: row.division_border, headerBg: row.division_header_bg,
            fullWidth: row.division_full_width, sort: row.division_sort,
            agents: [],
          };
          grouped.push(group);
        }
        group.agents.push(row);
      }
      grouped.sort((a, b) => a.sort - b.sort);
      setDivisions(grouped);
      setLoading(false);
    };
    loadAgents();
  }, []);

  const markPhotoError = (id: string) => setPhotoErrors(prev => ({ ...prev, [id]: true }));

  const circleStyle = (size: number, border = "#D4AF37"): React.CSSProperties => ({
    width: size, height: size, borderRadius: "50%",
    border: `2px solid ${border}`, objectFit: "cover" as const,
    flexShrink: 0, background: "rgba(10,35,66,0.3)",
  });

  const fallback = (label: string, size: number, bg = "#0A2342"): React.CSSProperties => ({
    ...circleStyle(size), display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.35, background: bg,
  });

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>DRU AI Consulting — AI Empire Org Chart</h1>
            <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>{agentCount || 54} agents · {divisions.length || 11} divisions · DeAnna → AI Twin → Raymond → Travis → Priya → {agentCount || 54} Agents · All agents operate in Genius Mode</p>
          </div>
          <div onClick={() => window.location.href = "/admin"} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>← Profit Pulse</div>
        </div>

        {/* Hierarchy — keep dark cards intentionally */}
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: "1.5rem", gap: 6 }}>

          <div style={{ background: "#C2185B", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
            {!deAnnaErr ? <img src="/deanna-avatar.jpg" alt="DeAnna R. Upshaw" onError={() => setDeAnnaErr(true)} style={circleStyle(56)} /> : <div style={fallback("👑", 56, "#0A2342")}>👑</div>}
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>DeAnna R. Upshaw</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>CEO & Founder · AI Authority</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          <div style={{ background: "#D4AF37", border: "2px solid #0A2342", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 300 }}>
            <img src="/deanna-professional.png" alt="DeAnna's AI Twin" style={circleStyle(52)} />
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>✦ DeAnna's AI Twin</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif",color: "rgba(10,35,66,0.7)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>Master Orchestrator · DeAnna's Voice</p>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
                {["DeAnna's Voice", "Persistent Memory", "Routes All Agents"].map(b => (
                  <span key={b} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.52rem", fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "rgba(10,35,66,0.1)", border: "1px solid rgba(10,35,66,0.3)", color: "#0A2342" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          <div style={{ background: "#1B4D8E", border: "2px solid rgba(212,175,55,0.7)", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 300 }}>
            {!raymondErr ? <img src={RAYMOND_PHOTO} alt="Raymond Holloway" onError={() => setRaymondErr(true)} style={{ ...circleStyle(54), border: "2px solid #D4AF37" }} /> : <div style={fallback("RH", 54)}>RH</div>}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Executive Vice President</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Raymond Holloway</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>{divisions.length || 11} Divisions · {agentCount || 54} Agents</p>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
                {["Strategic Oversight", "Final Authority", "Operations Command"].map(b => (
                  <span key={b} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.5rem", fontWeight: 700, padding: "1px 6px", borderRadius: 20, background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)", color: "#D4AF37" }}>{b}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          <div style={{ background: "#0A2342", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 10, padding: "0.65rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
            {!travisErr ? <img src={TRAVIS_PHOTO} alt="Travis Wealthy" onError={() => setTravisErr(true)} style={{ ...circleStyle(48), border: "1px solid rgba(212,175,55,0.5)" }} /> : <div style={fallback("TW", 48)}>TW</div>}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Assistant Vice President</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Travis Wealthy</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>Supports Raymond · Organizes & packages for the Twin</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          <div style={{ background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 10, padding: "0.65rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
            {!priyaErr ? <img src={PRIYA_PHOTO} alt="Priya Sharma" onError={() => setPriyaErr(true)} style={{ ...circleStyle(44), border: "1px solid rgba(212,175,55,0.35)" }} /> : <div style={fallback("PS", 44)}>PS</div>}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Executive Assistant</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "0.82rem", fontWeight: 700, margin: 0 }}>Priya Sharma</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.6)", fontSize: "0.58rem", margin: "1px 0 0" }}>Supports Raymond & Travis · Executive context & time-sensitive flags</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />
        </div>

        {/* Division grid — driven by the agents table */}
        {loading ? (
          <div style={{ textAlign: "center" as const, padding: "3rem", fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.8rem" }}>Loading org chart…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.875rem" }}>
            {divisions.map(div => (
              <div key={div.sort} style={{ gridColumn: div.fullWidth ? "1 / -1" : "auto", borderRadius: 10, overflow: "hidden", border: `1px solid ${div.border}`, background: "rgba(10,35,66,0.02)" }}>
                <div style={{ background: div.headerBg, padding: "7px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", color: "#FFFFFF", fontSize: "0.75rem", fontWeight: 700 }}>{div.name}</span>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.56rem", fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: "rgba(255,255,255,0.15)", color: "#FFFFFF" }}>{div.tag}</span>
                </div>
                <div style={{ padding: "8px 10px", display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
                  {div.agents.map(agent => (
                    <div key={agent.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.1)", borderRadius: 7, padding: "5px 9px", flex: div.fullWidth ? "1 1 160px" : "1 1 100%" }}>
                      {!photoErrors[agent.id] ? (
                        <img src={agent.photo_url} alt={agent.name} onError={() => markPhotoError(agent.id)} style={{ width: 54, height: 54, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", objectFit: "cover" as const, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 54, height: 54, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0A2342", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontSize: "0.85rem", fontWeight: 700 }}>{initials(agent.name)}</div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.7rem", fontWeight: 700, margin: 0, lineHeight: 1.2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}{agent.is_leader ? " ★" : ""}</p>
                        <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.5)", fontSize: "0.58rem", margin: 0, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>{agent.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "1rem", textAlign: "center" as const, padding: "0.75rem", background: "rgba(212,175,55,0.05)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 8 }}>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", color: "rgba(212,175,55,0.8)", margin: 0 }}>
            ★ Division Leaders · Isabella Moreno auto-blocks all outputs violating Trademark Classes 35 · 41 · 42 · All agents operate in Genius Mode · DRU AI Consulting © 2026
          </p>
        </div>

        <footer style={{ textAlign: "center" as const, padding: "1rem 0 0.5rem", color: "rgba(10,35,66,0.3)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem" }}>
          © 2026 DRU AI Consulting · All Rights Reserved
        </footer>
      </main>
    </AdminLayout>
  );
}
