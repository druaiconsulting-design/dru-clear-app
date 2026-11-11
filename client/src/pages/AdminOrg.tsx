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
const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/agents-photos`;
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
  what_they_do: string | null;
  what_they_do_detail: string | null;
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
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
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
        .order("is_leader", { ascending: false })
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

  // Travis's video team — they stay in their own divisions; this row only shows who works with him.
  const VIDEO_TEAM = ["Darius King", "Nia Robinson", "Chloe Dubois", "Zara Ahmed", "Amelia Santos"];
  const videoTeam = VIDEO_TEAM
    .map(n => divisions.flatMap(d => d.agents).find(a => a.name === n))
    .filter((a): a is AgentRow => !!a);

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

  const toggleCard = (id: string) => setOpenCards(prev => ({ ...prev, [id]: !prev[id] }));

  // One agent card, used by the Video Production team row and every division box.
  // Short "what they do" line always shows; clicking the card opens the full detail.
  const agentCard = (agent: AgentRow, opts: { photo: number; flex: string; maxWidth?: number; showDivision?: boolean }) => {
    const isOpen = !!openCards[agent.id];
    const hasMore = !!(agent.what_they_do || agent.what_they_do_detail);
    const detail = agent.what_they_do_detail || agent.what_they_do;
    return (
      <div
        key={agent.id}
        onClick={() => hasMore && toggleCard(agent.id)}
        style={{ background: "#FFFFFF", border: `1px solid ${isOpen ? "rgba(212,175,55,0.6)" : "rgba(10,35,66,0.1)"}`, borderRadius: 7, padding: "5px 9px", flex: isOpen ? "1 1 100%" : opts.flex, maxWidth: isOpen ? "none" : opts.maxWidth, cursor: hasMore ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!photoErrors[agent.id] ? (
            <img src={agent.photo_url} alt={agent.name} onError={() => markPhotoError(agent.id)} style={{ width: opts.photo, height: opts.photo, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", objectFit: "cover" as const, flexShrink: 0 }} />
          ) : (
            <div style={{ width: opts.photo, height: opts.photo, borderRadius: "50%", border: "1px solid rgba(212,175,55,0.35)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0A2342", color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontSize: opts.photo > 48 ? "0.85rem" : "0.75rem", fontWeight: 700 }}>{initials(agent.name)}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#0A2342", fontSize: "0.7rem", fontWeight: 700, margin: 0, lineHeight: 1.2 }}>{agent.name}{agent.is_leader ? " ★" : ""}</p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.6)", fontSize: "0.58rem", margin: 0 }}>{agent.role}</p>
            {opts.showDivision && <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.4)", fontSize: "0.52rem", margin: 0 }}>{agent.division}</p>}
            {agent.what_they_do && <p style={{ fontFamily: "'Inter', sans-serif", color: "#0A2342", fontSize: "0.58rem", fontWeight: 600, margin: "2px 0 0", lineHeight: 1.3 }}>{agent.what_they_do}</p>}
          </div>
          {hasMore && <span style={{ color: "#D4AF37", fontSize: "0.65rem", flexShrink: 0, alignSelf: "flex-start" }}>{isOpen ? "▴" : "▾"}</span>}
        </div>
        {isOpen && detail && (
          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(212,175,55,0.35)", fontFamily: "'Inter', sans-serif", fontSize: "0.62rem", color: "rgba(10,35,66,0.85)", lineHeight: 1.5 }}>
            <ul style={{ margin: 0, paddingLeft: 14, listStyle: "disc" }}>
              {detail.split("\n").map(l => l.trim()).filter(Boolean).map((line, i) => <li key={i} style={{ marginBottom: 2 }}>{line}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: "1rem" }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>DRU AI Consulting — AI Empire Org Chart</h1>
            <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>{agentCount || 55} agents · {divisions.length || 11} divisions · DeAnna → AI Twin → Raymond → {agentCount || 55} Agents · All agents operate in Genius Mode</p>
          </div>
          <div onClick={() => window.location.href = "/admin"} style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 8, padding: "0.6rem 1.25rem", letterSpacing: "0.06em", cursor: "pointer" }}>← Profit Pulse</div>
        </div>

        {/* Hierarchy — keep dark cards intentionally */}
        <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", marginBottom: "1.5rem", gap: 6 }}>

          {/* DeAnna with her AI Twin beside her and Priya directly under her */}
          <div style={{ display: "grid", gridTemplateColumns: "360px 20px 360px", justifyContent: "center" }}>

          <div style={{ gridColumn: 1, gridRow: 1, boxSizing: "border-box" as const, background: "#D4AF37", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12 }}>
            {!deAnnaErr ? <img src="/deanna-avatar.jpg" alt="DeAnna R. Upshaw" onError={() => setDeAnnaErr(true)} style={circleStyle(56)} /> : <div style={fallback("👑", 56, "#0A2342")}>👑</div>}
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>DeAnna R. Upshaw</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>CEO & Founder</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(255,255,255,0.85)", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "1px 0 0" }}>Leadership & AI Authority</p>
              <span style={{ display: "inline-block", marginTop: 5, fontFamily: "'Montserrat', sans-serif", fontSize: "0.52rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, padding: "2px 8px", borderRadius: 20, background: "#0A2342", color: "#D4AF37" }}>Certified AI Agent Builder</span>
            </div>
          </div>

            {/* Gold line: DeAnna to her AI Twin, and down the middle to Raymond */}
            <div style={{ gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column" as const }}>
              <div style={{ flex: 1 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                <div style={{ width: 20, height: 2, background: "rgba(212,175,55,0.5)" }} />
                <div style={{ width: 2, flex: 1, background: "rgba(212,175,55,0.5)" }} />
              </div>
            </div>

          <div style={{ gridColumn: 3, gridRow: 1, alignSelf: "center", boxSizing: "border-box" as const, background: "#C2185B", border: "2px solid #0A2342", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/deanna-professional.png" alt="DeAnna's AI Twin" style={circleStyle(52)} />
            <div>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>✦ DeAnna's AI Twin</p>
              <p style={{ fontFamily: "'Montserrat', sans-serif",color: "rgba(255,255,255,0.85)", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "2px 0 0" }}>DeAnna's Voice · Face of the Company</p>
            </div>
          </div>

            <div style={{ gridColumn: 2, gridRow: 2, display: "flex", justifyContent: "center" }}>
              <div style={{ width: 2, background: "rgba(212,175,55,0.5)" }} />
            </div>

            {/* Priya — DeAnna's super email agent, connected directly under her */}
            <div style={{ gridColumn: 1, gridRow: 2, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
              <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />
            <div style={{ width: "100%", boxSizing: "border-box" as const, background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.4)", borderRadius: 10, padding: "0.65rem 1.5rem", display: "flex", alignItems: "center", gap: 12 }}>
              {!priyaErr ? <img src={PRIYA_PHOTO} alt="Priya Sharma" onError={() => setPriyaErr(true)} style={{ ...circleStyle(44), border: "1px solid rgba(212,175,55,0.35)" }} /> : <div style={fallback("PS", 44)}>PS</div>}
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Executive Assistant · Inbox Command</p>
                <p style={{ fontFamily: "'Playfair Display', serif", color: "#0A2342", fontSize: "0.82rem", fontWeight: 700, margin: 0 }}>Priya Sharma</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(10,35,66,0.6)", fontSize: "0.58rem", margin: "1px 0 0" }}>Gmail super agent · Build in progress</p>
              </div>
            </div>
            </div>

          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          <div style={{ background: "#0A2342", border: "2px solid rgba(212,175,55,0.7)", borderRadius: 12, padding: "0.75rem 2rem", display: "flex", alignItems: "center", gap: 12, minWidth: 300 }}>
            {!raymondErr ? <img src={RAYMOND_PHOTO} alt="Raymond Holloway" onError={() => setRaymondErr(true)} style={{ ...circleStyle(54), border: "2px solid #D4AF37" }} /> : <div style={fallback("RH", 54)}>RH</div>}
            <div>
              <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Chief of Staff</p>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>Raymond Holloway</p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.45)", fontSize: "0.58rem", margin: "1px 0 0" }}>{divisions.length || 11} Divisions · {agentCount || 55} Agents</p>
            </div>
          </div>

          <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />

          {/* Executive team — promoted out of the command layer, July 2026 restructure */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, justifyContent: "center" }}>

            <div style={{ background: "#1B4D8E", border: "1px solid rgba(212,175,55,0.35)", borderRadius: 10, padding: "0.65rem 1.5rem", display: "flex", alignItems: "center", gap: 12, minWidth: 270 }}>
              {!travisErr ? <img src={TRAVIS_PHOTO} alt="Travis Wealthy" onError={() => setTravisErr(true)} style={{ ...circleStyle(48), border: "1px solid rgba(212,175,55,0.5)" }} /> : <div style={fallback("TW", 48)}>TW</div>}
              <div>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 1px" }}>Executive Producer · Video Production</p>
                <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>Travis Wealthy</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.9)", fontSize: "0.58rem", margin: "1px 0 0" }}>Video Pipeline · Script → render → publish</p>
              </div>
            </div>

          </div>

          {/* Video Production Team — reports into Travis, stays in own divisions */}
          {videoTeam.length > 0 && (
            <>
              <div style={{ width: 2, height: 14, background: "rgba(212,175,55,0.5)" }} />
              <div style={{ border: "1px dashed rgba(27,77,142,0.55)", borderRadius: 10, padding: "0.5rem 0.75rem 0.75rem", maxWidth: 900 }}>
                <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#1B4D8E", fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 6px", textAlign: "center" as const }}>Video Production Team</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, justifyContent: "center" }}>
                  {videoTeam.map(agent => agentCard(agent, { photo: 44, flex: "1 1 200px", maxWidth: 260, showDivision: true }))}
                </div>
              </div>
            </>
          )}

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
                  {div.agents.map(agent => agentCard(agent, { photo: 54, flex: div.fullWidth ? "1 1 160px" : "1 1 100%" }))}
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
