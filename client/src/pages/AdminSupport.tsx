import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";
import { SUPPORT_COUNT_REFRESH_MS } from "../lib/useSupportCount";

// Support Tickets: every email sent to support@ or info@ lives here. Isaiah Carter's reply to each one
// waits here for DeAnna. Approving sends it through GHL into the same conversation (api/ghl-support-reply-dispatch.ts).

interface SupportCard {
  id: string; created_at: string; status: string; agent_name: string;
  title: string | null; original_content: string | null;
  output: string; edited_output: string | null; context: string | null;
}

interface Ticket {
  id: string; created_at: string; status: string;
  member_name: string | null; member_email: string | null;
  question: string | null; source_address: string | null;
}

const NAVY = "#0A2342";
const GOLD = "#D4AF37";
const BLUE = "#2D5A8E";
const PINK = "#C2185B";

function timeAgo(timestamp: string): string {
  const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function ticketIdOf(card: SupportCard): string {
  try { return String(JSON.parse(card.context ?? "{}").support_request_id ?? ""); } catch { return ""; }
}

function splitQuestion(question: string | null): { subject: string; message: string } {
  const q = question ?? "";
  const m = q.match(/^Subject:\s*(.*)\n/);
  return { subject: (m?.[1] ?? "").trim() || "(no subject)", message: m ? q.slice(m[0].length).trim() : q.trim() };
}

const panelLabel: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" };
const bodyText: React.CSSProperties = { fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.65, color: "rgba(10,35,66,0.8)", whiteSpace: "pre-wrap", wordBreak: "break-word" };
const buttonBase: React.CSSProperties = { fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", borderRadius: 8, padding: "0.6rem 1.25rem", cursor: "pointer" };

export default function AdminSupport() {
  const [cards, setCards] = useState<SupportCard[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"waiting" | "replied">("waiting");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [openReplied, setOpenReplied] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [c, t] = await Promise.all([
      supabase.from("approvals").select("id,created_at,status,agent_name,title,original_content,output,edited_output,context").eq("category", "support_reply").order("created_at", { ascending: false }).limit(300),
      supabase.from("support_requests").select("id,created_at,status,member_name,member_email,question,source_address").eq("category", "email").order("created_at", { ascending: false }).limit(300),
    ]);
    if (c.error) console.error("Failed to load support cards:", c.error);
    else setCards((c.data as SupportCard[]) ?? []);
    if (t.error) console.error("Failed to load tickets:", t.error);
    else setTickets((t.data as Ticket[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, SUPPORT_COUNT_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const changed = async () => {
    await load();
    window.dispatchEvent(new Event("support-tickets-changed"));
  };

  const setError = (id: string, message: string) => setErrorById(prev => ({ ...prev, [id]: message }));
  const clearError = (id: string) => setErrorById(prev => { const next = { ...prev }; delete next[id]; return next; });

  // Approving marks the card approved, then asks the server to send. A reply that does not send
  // goes back to Waiting on you so it can be sent again.
  const sendReply = async (card: SupportCard, editedText?: string) => {
    setBusyId(card.id);
    clearError(card.id);
    const update: Record<string, unknown> = { status: "approved" };
    if (editedText !== undefined) update.edited_output = editedText;
    const { error } = await supabase.from("approvals").update(update).eq("id", card.id);
    if (error) { setError(card.id, "The reply could not be saved. Nothing was sent."); setBusyId(null); return; }

    let ok = false;
    try {
      const res = await fetch("/api/ghl-support-reply-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: card.id }),
      });
      ok = res.ok;
    } catch { ok = false; }

    if (!ok) {
      await supabase.from("approvals").update({ status: "pending" }).eq("id", card.id);
      setError(card.id, "The reply did not send. It is back in Waiting on you so you can send it again.");
    } else {
      setEditingId(null);
      setNote("");
    }
    setBusyId(null);
    await changed();
  };

  const saveEditAndSend = async (card: SupportCard) => {
    const why = note.trim();
    if (!why || !editText.trim()) return;
    await supabase.from("agent_corrections").insert({ agent_name: card.agent_name, correction_note: why, approval_id: card.id, source: "edit" });
    await sendReply(card, editText);
  };

  // Rejecting teaches Isaiah (the reason is saved as a correction) and puts the ticket back as
  // "no reply drafted" so it stays visible until it is closed.
  const rejectCard = async (card: SupportCard) => {
    const why = note.trim();
    if (!why) return;
    setBusyId(card.id);
    await supabase.from("agent_corrections").insert({ agent_name: card.agent_name, correction_note: why, approval_id: card.id, source: "reject" });
    await supabase.from("approvals").update({ status: "rejected", archived: true }).eq("id", card.id);
    const tid = ticketIdOf(card);
    if (tid) await supabase.from("support_requests").update({ status: "open" }).eq("id", tid);
    setRejectingId(null);
    setNote("");
    setBusyId(null);
    await changed();
  };

  const closeTicket = async (ticket: Ticket) => {
    setBusyId(ticket.id);
    await supabase.from("support_requests").update({ status: "closed" }).eq("id", ticket.id);
    setBusyId(null);
    await changed();
  };

  const waitingCards = cards.filter(c => c.status === "pending");
  const noDraftTickets = tickets.filter(t => t.status === "open");
  const waitingCount = waitingCards.length + noDraftTickets.length;
  const cardByTicket = new Map<string, SupportCard>();
  cards.forEach(c => { const tid = ticketIdOf(c); if (tid && !cardByTicket.has(tid)) cardByTicket.set(tid, c); });
  const repliedTickets = tickets.filter(t => t.status === "replied" || t.status === "replying");

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "'Montserrat', sans-serif", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
    padding: "0.55rem 1.1rem", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${active ? BLUE : "rgba(10,35,66,0.2)"}`,
    background: active ? BLUE : "transparent", color: active ? "#FFFFFF" : "rgba(10,35,66,0.6)",
  });

  const cardShell: React.CSSProperties = { background: "#FFFFFF", border: "1px solid rgba(10,35,66,0.12)", borderLeft: `4px solid ${BLUE}`, borderRadius: 12, padding: "1.25rem", marginBottom: "1.25rem" };

  return (
    <AdminLayout currentPath={window.location.pathname}>
      <main style={{ flex: 1, padding: "2rem 1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", color: NAVY, fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.2, marginBottom: "0.2rem" }}>Support Tickets</h1>
          <p style={{ color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
            Every email sent to support@ and info@. Isaiah Carter's reply waits here for you.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button onClick={() => setTab("waiting")} style={tabStyle(tab === "waiting")}>Waiting on you ({waitingCount})</button>
          <button onClick={() => setTab("replied")} style={tabStyle(tab === "replied")}>Replied ({repliedTickets.length})</button>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(10,35,66,0.4)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem" }}>LOADING TICKETS...</div>
        )}

        {!loading && tab === "waiting" && waitingCount === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>Nothing is waiting on you.</div>
        )}

        {!loading && tab === "waiting" && waitingCards.map(card => {
          const text = card.edited_output || card.output;
          const editing = editingId === card.id;
          const rejecting = rejectingId === card.id;
          const busy = busyId === card.id;
          return (
            <div key={card.id} style={cardShell}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.95rem", fontWeight: 700, color: NAVY }}>{card.title || "(no subject)"}</div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: BLUE, color: "#FFFFFF" }}>Support Reply</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(card.created_at)}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "rgba(10,35,66,0.04)", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Customer's Email</div>
                  <div style={bodyText}>{card.original_content}</div>
                </div>
                <div style={{ background: "rgba(45,90,142,0.06)", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ ...panelLabel, color: BLUE }}>{card.agent_name}'s Reply Draft</div>
                  {editing ? (
                    <>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={10}
                        style={{ width: "100%", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.6, padding: "0.75rem", borderRadius: 8, border: "1px solid rgba(10,35,66,0.25)", color: NAVY, resize: "vertical" }} />
                      <input value={note} onChange={e => setNote(e.target.value)} placeholder={`What should ${card.agent_name} do differently next time?`}
                        style={{ width: "100%", marginTop: "0.6rem", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid rgba(10,35,66,0.25)", color: NAVY }} />
                    </>
                  ) : (
                    <div style={bodyText}>{text}</div>
                  )}
                </div>
              </div>

              {rejecting && (
                <input value={note} onChange={e => setNote(e.target.value)} placeholder={`Why is this reply being rejected? ${card.agent_name} learns from your answer.`}
                  style={{ width: "100%", marginTop: "1rem", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid rgba(194,24,91,0.5)", color: NAVY }} />
              )}

              {errorById[card.id] && (
                <div style={{ marginTop: "0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: PINK }}>⚠ {errorById[card.id]}</div>
              )}

              <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
                {!editing && !rejecting && (
                  <>
                    <button disabled={busy} onClick={() => sendReply(card)} style={{ ...buttonBase, background: GOLD, color: NAVY, border: "none", opacity: busy ? 0.6 : 1 }}>{busy ? "Sending..." : "Send Reply ✓"}</button>
                    <button disabled={busy} onClick={() => { setEditingId(card.id); setRejectingId(null); setEditText(text); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Edit</button>
                    <button disabled={busy} onClick={() => { setRejectingId(card.id); setEditingId(null); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: PINK, border: `1px solid ${PINK}` }}>Reject</button>
                  </>
                )}
                {editing && (
                  <>
                    <button disabled={busy || !note.trim() || !editText.trim()} onClick={() => saveEditAndSend(card)} style={{ ...buttonBase, background: GOLD, color: NAVY, border: "none", opacity: busy || !note.trim() || !editText.trim() ? 0.5 : 1 }}>{busy ? "Sending..." : "Save + Send Reply ✓"}</button>
                    <button disabled={busy} onClick={() => { setEditingId(null); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Cancel</button>
                  </>
                )}
                {rejecting && (
                  <>
                    <button disabled={busy || !note.trim()} onClick={() => rejectCard(card)} style={{ ...buttonBase, background: PINK, color: "#FFFFFF", border: "none", opacity: busy || !note.trim() ? 0.5 : 1 }}>{busy ? "..." : "Confirm Reject"}</button>
                    <button disabled={busy} onClick={() => { setRejectingId(null); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {!loading && tab === "waiting" && noDraftTickets.map(ticket => {
          const { subject, message } = splitQuestion(ticket.question);
          const sender = ticket.member_name ? `${ticket.member_name} <${ticket.member_email}>` : (ticket.member_email ?? "");
          return (
            <div key={ticket.id} style={{ ...cardShell, borderLeftColor: GOLD }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.95rem", fontWeight: 700, color: NAVY }}>{subject}</div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: GOLD, color: NAVY }}>No reply drafted</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
              <div style={{ background: "rgba(10,35,66,0.04)", borderRadius: 10, padding: "1rem" }}>
                <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Customer's Email</div>
                <div style={bodyText}>{`From: ${sender}\nWritten to: ${ticket.source_address ?? ""}\nSubject: ${subject}\n\n${message}`}</div>
              </div>
              <div style={{ marginTop: "0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.55)" }}>
                Isaiah has no reply drafted for this email. Close the ticket once you have handled it.
              </div>
              <div style={{ marginTop: "1rem" }}>
                <button disabled={busyId === ticket.id} onClick={() => closeTicket(ticket)} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)", opacity: busyId === ticket.id ? 0.6 : 1 }}>{busyId === ticket.id ? "..." : "Close ticket"}</button>
              </div>
            </div>
          );
        })}

        {!loading && tab === "replied" && repliedTickets.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: "rgba(10,35,66,0.45)", fontFamily: "'Inter', sans-serif", fontSize: "0.85rem" }}>No replies sent yet.</div>
        )}

        {!loading && tab === "replied" && repliedTickets.map(ticket => {
          const card = cardByTicket.get(ticket.id);
          const { subject, message } = splitQuestion(ticket.question);
          const sender = ticket.member_name ? `${ticket.member_name} <${ticket.member_email}>` : (ticket.member_email ?? "");
          const open = openReplied.has(ticket.id);
          return (
            <div key={ticket.id} style={{ ...cardShell, borderLeftColor: "rgba(10,35,66,0.25)", padding: "1rem 1.25rem" }}>
              <div onClick={() => setOpenReplied(prev => { const next = new Set(prev); if (next.has(ticket.id)) next.delete(ticket.id); else next.add(ticket.id); return next; })}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", cursor: "pointer" }}>
                <div>
                  <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.9rem", fontWeight: 700, color: NAVY }}>{subject}</div>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.5)" }}>{sender}</div>
                </div>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: ticket.status === "replied" ? "#2E7D32" : GOLD, color: ticket.status === "replied" ? "#FFFFFF" : NAVY }}>{ticket.status === "replied" ? "✓ Reply Sent" : "Sending reply..."}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
              {open && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", marginTop: "1rem" }}>
                  <div style={{ background: "rgba(10,35,66,0.04)", borderRadius: 10, padding: "1rem" }}>
                    <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Customer's Email</div>
                    <div style={bodyText}>{message}</div>
                  </div>
                  <div style={{ background: "rgba(45,90,142,0.06)", borderRadius: 10, padding: "1rem" }}>
                    <div style={{ ...panelLabel, color: BLUE }}>Reply Sent</div>
                    <div style={bodyText}>{card ? (card.edited_output || card.output) : "The reply text is not available."}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </AdminLayout>
  );
}
