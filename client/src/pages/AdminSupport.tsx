import { useState, useEffect, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import { supabase } from "../lib/supabase";
import { SUPPORT_COUNT_REFRESH_MS } from "../lib/useSupportCount";

// Support Tickets: every email sent to support@ or info@ lives here. Isaiah Carter's reply to each one
// waits here for DeAnna. Approving sends it through GHL into the same conversation (api/ghl-support-reply-dispatch.ts).

interface SupportCard {
  id: string; created_at: string; status: string; agent_name: string; source: string | null;
  title: string | null; original_content: string | null;
  output: string; edited_output: string | null; context: string | null;
}

interface Ticket {
  id: string; created_at: string; status: string;
  member_name: string | null; member_email: string | null;
  question: string | null; source_address: string | null;
  ghl_contact_id: string | null; ghl_message_id: string | null;
  category: string; file_url: string | null;
}

// Every message after a ticket's first one: the client's follow-ups, Isaiah's replies, DeAnna's replies.
interface TicketMessage { id: string; ticket_id: string; direction: "client" | "isaiah" | "deanna"; body: string; created_at: string }

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

function correctionNoteOf(card: SupportCard): string {
  try { return String(JSON.parse(card.context ?? "{}").correction_note ?? ""); } catch { return ""; }
}

function isRestored(card: SupportCard): boolean {
  try { return Boolean(JSON.parse(card.context ?? "{}").restored_from); } catch { return false; }
}

// Support Hub requests carry the member's category (Account & Billing, Course Access, ...). Emails carry "email".
function hubCategoryOf(ticket: Ticket | undefined): string {
  return ticket && ticket.category && ticket.category !== "email" ? ticket.category : "";
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
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"waiting" | "replied">("waiting");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [openReplied, setOpenReplied] = useState<Set<string>>(new Set());
  const [ownReplyId, setOwnReplyId] = useState<string | null>(null);
  const [ownText, setOwnText] = useState("");

  const load = useCallback(async () => {
    const [c, t, m] = await Promise.all([
      supabase.from("approvals").select("id,created_at,status,agent_name,source,title,original_content,output,edited_output,context").eq("category", "support_reply").order("created_at", { ascending: false }).limit(300),
      supabase.from("support_requests").select("id,created_at,status,member_name,member_email,question,source_address,ghl_contact_id,ghl_message_id,category,file_url").order("created_at", { ascending: false }).limit(300),
      supabase.from("ticket_messages").select("id,ticket_id,direction,body,created_at").order("created_at", { ascending: true }).limit(3000),
    ]);
    if (c.error) console.error("Failed to load support cards:", c.error);
    else setCards((c.data as SupportCard[]) ?? []);
    if (t.error) console.error("Failed to load tickets:", t.error);
    else setTickets((t.data as Ticket[]) ?? []);
    if (m.error) console.error("Failed to load ticket messages:", m.error);
    else setMessages((m.data as TicketMessage[]) ?? []);
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
  const sendReply = async (card: SupportCard, editedText?: string): Promise<boolean> => {
    setBusyId(card.id);
    clearError(card.id);
    const update: Record<string, unknown> = { status: "approved" };
    if (editedText !== undefined) update.edited_output = editedText;
    const { error } = await supabase.from("approvals").update(update).eq("id", card.id);
    if (error) { setError(card.id, "The reply could not be saved. Nothing was sent."); setBusyId(null); return false; }

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
    return ok;
  };

  // An edit is writing to the client. Once it sends, Isaiah's original draft and the reply DeAnna
  // sent are saved together as one entry in his corrections, so he learns her writing from it.
  // An edit that changes nothing saves nothing.
  const saveEditAndSend = async (card: SupportCard) => {
    const finalText = editText.trim();
    if (!finalText) return;
    const original = (card.edited_output || card.output || "").trim();
    const sent = await sendReply(card, editText);
    if (sent && finalText !== original) {
      await supabase.from("agent_corrections").insert({
        agent_name: card.agent_name,
        correction_note: `${card.agent_name}'s original draft:\n${original}\n\nDeAnna's edited reply:\n${finalText}`,
        approval_id: card.id,
        source: "edit",
      });
    }
  };

  // Corrective feedback: the draft leaves the page, the reason is saved for Isaiah, and Isaiah writes a
  // corrected draft right away. The new draft shows in Waiting on you marked as his correction.
  const rejectCard = async (card: SupportCard) => {
    const why = note.trim();
    if (!why) return;
    setBusyId(card.id);
    await supabase.from("agent_corrections").insert({ agent_name: card.agent_name, correction_note: why, approval_id: card.id, source: "reject" });
    await supabase.from("approvals").update({ status: "rejected", archived: true }).eq("id", card.id);
    const tid = ticketIdOf(card);
    if (tid) {
      await supabase.from("support_requests").update({ status: "open" }).eq("id", tid);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? "";
        const res = await fetch("/api/support-draft-reply", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ticket_id: tid, correction_note: why, previous_draft: card.edited_output || card.output || "" }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(tid, `Your feedback is saved. ${String(body?.error ?? "Isaiah could not write the corrected draft yet.")} Press Have Isaiah write it to try again.`);
        }
      } catch {
        setError(tid, "Your feedback is saved. Isaiah could not write the corrected draft yet. Press Have Isaiah write it to try again.");
      }
    }
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

  // Closing a ticket sends it to the Archived page (Support Tickets section). A Support Reply card
  // that was still waiting is marked closed so it leaves Waiting on you.
  const closeCard = async (card: SupportCard) => {
    setBusyId(card.id);
    await supabase.from("approvals").update({ status: "closed" }).eq("id", card.id);
    const tid = ticketIdOf(card);
    if (tid) await supabase.from("support_requests").update({ status: "closed" }).eq("id", tid);
    setBusyId(null);
    await changed();
  };

  // "Have Isaiah write it": the server has Isaiah write the reply, then it shows up in Waiting on you.
  const haveIsaiahWrite = async (ticket: Ticket) => {
    setBusyId(ticket.id);
    clearError(ticket.id);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? "";
      const res = await fetch("/api/support-draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ticket_id: ticket.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(ticket.id, String(body?.error ?? "Isaiah could not write the reply. Try again."));
      }
    } catch {
      setError(ticket.id, "Isaiah could not write the reply. Try again.");
    }
    setBusyId(null);
    await changed();
  };

  // "Write my own reply": DeAnna's words are saved as an approved Support Reply card and sent through
  // the same send step as Isaiah's replies, from the address the person wrote to.
  const sendOwnReply = async (ticket: Ticket) => {
    const text = ownText.trim();
    if (!text) return;
    setBusyId(ticket.id);
    clearError(ticket.id);
    const { subject, message } = splitQuestion(ticket.question);
    const sender = ticket.member_name ? `${ticket.member_name} <${ticket.member_email}>` : (ticket.member_email ?? "");
    const { data: row, error } = await supabase.from("approvals").insert({
      source: "support_email_manual",
      trigger_type: "support_email_manual_reply",
      agent_name: "DeAnna R. Upshaw",
      agent_role: "CEO",
      division: "Customer Support",
      task_brief: `Support Reply — ${ticket.member_name || ticket.member_email} | ${subject}`,
      original_content: `From: ${sender}\nWritten to: ${ticket.source_address ?? ""}\nSubject: ${subject}\n\n${message}`,
      output: text,
      status: "approved",
      notify_deanna: false,
      priority: "high",
      category: "support_reply",
      title: subject,
      ghl_contact_id: ticket.ghl_contact_id,
      context: JSON.stringify({
        support_request_id: ticket.id,
        from_email: ticket.member_email,
        to_address: ticket.source_address,
        subject,
        ghl_contact_id: ticket.ghl_contact_id,
        ghl_message_id: ticket.ghl_message_id,
      }),
    }).select("id").single();
    if (error || !row) { setError(ticket.id, "Your reply could not be saved. Nothing was sent."); setBusyId(null); return; }

    let ok = false;
    try {
      const res = await fetch("/api/ghl-support-reply-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_id: row.id }),
      });
      ok = res.ok;
    } catch { ok = false; }

    if (!ok) {
      await supabase.from("approvals").update({ status: "rejected", archived: true }).eq("id", row.id);
      await supabase.from("support_requests").update({ status: "open" }).eq("id", ticket.id);
      setError(ticket.id, "Your reply did not send. The ticket is still in Waiting on you.");
    } else {
      setOwnReplyId(null);
      setOwnText("");
    }
    setBusyId(null);
    await changed();
  };

  const waitingCards = cards.filter(c => c.status === "pending");
  const noDraftTickets = tickets.filter(t => t.status === "open");
  const waitingCount = waitingCards.length + noDraftTickets.length;
  const cardByTicket = new Map<string, SupportCard>();
  cards.forEach(c => { const tid = ticketIdOf(c); if (tid && !cardByTicket.has(tid)) cardByTicket.set(tid, c); });
  const repliedTickets = tickets.filter(t => t.status === "replied" || t.status === "replying");
  const ticketById = new Map<string, Ticket>();
  tickets.forEach(t => ticketById.set(t.id, t));
  const messagesByTicket = new Map<string, TicketMessage[]>();
  messages.forEach(m => { const list = messagesByTicket.get(m.ticket_id) ?? []; list.push(m); messagesByTicket.set(m.ticket_id, list); });
  // A reopened ticket shows when it last had activity, not when it first arrived.
  const lastActivity = (ticket: Ticket): string => {
    const list = messagesByTicket.get(ticket.id);
    return list && list.length > 0 ? list[list.length - 1].created_at : ticket.created_at;
  };

  // The whole conversation top to bottom: the client's first email, then every message after it,
  // each labeled Client, Isaiah Carter or You.
  const speaker = {
    client: { name: "Client", bg: "rgba(10,35,66,0.06)", color: NAVY },
    isaiah: { name: "Isaiah Carter", bg: "rgba(45,90,142,0.12)", color: BLUE },
    deanna: { name: "You", bg: "rgba(212,175,55,0.22)", color: NAVY },
  } as const;
  const conversation = (ticket: Ticket) => {
    const { message } = splitQuestion(ticket.question);
    const sender = ticket.member_name ? `${ticket.member_name} <${ticket.member_email}>` : (ticket.member_email ?? "");
    const items: { id: string; direction: keyof typeof speaker; body: string; created_at: string }[] = [
      { id: `first-${ticket.id}`, direction: "client", body: message, created_at: ticket.created_at },
      ...(messagesByTicket.get(ticket.id) ?? []),
    ];
    return (
      <div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.5)", marginBottom: "0.6rem" }}>
          {sender}{ticket.source_address ? ` · wrote to ${ticket.source_address}` : ""}
        </div>
        {items.map(item => {
          const who = speaker[item.direction] ?? speaker.client;
          return (
            <div key={item.id} style={{ background: who.bg, borderRadius: 10, padding: "0.75rem 0.9rem", marginBottom: "0.6rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.3rem" }}>
                <span style={{ ...panelLabel, color: who.color, marginBottom: 0 }}>{who.name}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.65rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(item.created_at)}</span>
              </div>
              <div style={bodyText}>{item.body}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // A small label that shows a Support Hub request's category next to the ticket. Emails carry no label.
  const hubPill = (category: string) => category ? (
    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(10,35,66,0.08)", color: NAVY }}>Support Hub · {category}</span>
  ) : null;
  // The file a member attached is private. A short-lived link is made when DeAnna presses the button.
  const openAttachedFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("support-files").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { window.alert("The attached file could not be opened."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const fileLink = (ticket: Ticket | undefined) => ticket?.file_url ? (
    <div style={{ marginTop: "0.5rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem" }}>
      <button onClick={() => openAttachedFile(ticket.file_url as string)} style={{ background: "none", border: "none", padding: 0, color: BLUE, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>Open attached file</button>
    </div>
  ) : null;

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
            Every email sent to support@ and info@, and every Support Hub request. Isaiah Carter's reply waits here for you.
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
                  {correctionNoteOf(card) && (
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: GOLD, color: NAVY }}>Isaiah's correction</span>
                  )}
                  {isRestored(card) && (
                    <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: "rgba(10,35,66,0.1)", color: NAVY }}>Restored: this reply was already sent</span>
                  )}
                  {hubPill(hubCategoryOf(ticketById.get(ticketIdOf(card))))}
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: BLUE, color: "#FFFFFF" }}>Support Reply</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(card.created_at)}</span>
                </div>
              </div>

              {correctionNoteOf(card) && (
                <div style={{ background: "rgba(212,175,55,0.14)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
                  <div style={{ ...panelLabel, color: NAVY, marginBottom: "0.25rem" }}>Your corrective feedback</div>
                  <div style={bodyText}>{correctionNoteOf(card)}</div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" }}>
                <div style={{ background: "rgba(10,35,66,0.04)", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Conversation</div>
                  {ticketById.get(ticketIdOf(card)) ? conversation(ticketById.get(ticketIdOf(card)) as Ticket) : <div style={bodyText}>{card.original_content}</div>}
                  {fileLink(ticketById.get(ticketIdOf(card)))}
                </div>
                <div style={{ background: "rgba(45,90,142,0.06)", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ ...panelLabel, color: BLUE }}>{card.agent_name}'s Reply Draft</div>
                  {editing ? (
                    <>
                      <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={10}
                        style={{ width: "100%", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.6, padding: "0.75rem", borderRadius: 8, border: "1px solid rgba(10,35,66,0.25)", color: NAVY, resize: "vertical" }} />
                    </>
                  ) : (
                    <div style={bodyText}>{text}</div>
                  )}
                </div>
              </div>

              {rejecting && (
                <input value={note} onChange={e => setNote(e.target.value)} placeholder={`What should ${card.agent_name} fix? He rewrites the reply from your answer and learns from it.`}
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
                    <button disabled={busy} onClick={() => { setRejectingId(card.id); setEditingId(null); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: PINK, border: `1px solid ${PINK}` }}>Corrective feedback</button>
                    <button disabled={busy} onClick={() => closeCard(card)} style={{ ...buttonBase, background: "transparent", color: "rgba(10,35,66,0.55)", border: "1px solid rgba(10,35,66,0.2)" }}>Close ticket</button>
                  </>
                )}
                {editing && (
                  <>
                    <button disabled={busy || !editText.trim()} onClick={() => saveEditAndSend(card)} style={{ ...buttonBase, background: GOLD, color: NAVY, border: "none", opacity: busy || !editText.trim() ? 0.5 : 1 }}>{busy ? "Sending..." : "Save + Send Reply ✓"}</button>
                    <button disabled={busy} onClick={() => { setEditingId(null); setNote(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Cancel</button>
                  </>
                )}
                {rejecting && (
                  <>
                    <button disabled={busy || !note.trim()} onClick={() => rejectCard(card)} style={{ ...buttonBase, background: PINK, color: "#FFFFFF", border: "none", opacity: busy || !note.trim() ? 0.5 : 1 }}>{busy ? "Isaiah is rewriting..." : "Send corrective feedback"}</button>
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
                  {hubPill(hubCategoryOf(ticket))}
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: GOLD, color: NAVY }}>No reply drafted</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(lastActivity(ticket))}</span>
                </div>
              </div>
              <div style={{ background: "rgba(10,35,66,0.04)", borderRadius: 10, padding: "1rem" }}>
                <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Conversation</div>
                {conversation(ticket)}
                {fileLink(ticket)}
              </div>
              <div style={{ marginTop: "0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.55)" }}>
                Isaiah has no reply drafted for this email.
              </div>
              {ownReplyId === ticket.id && (
                <textarea value={ownText} onChange={e => setOwnText(e.target.value)} rows={8} placeholder="Type your reply. It goes to the person from the address they wrote to."
                  style={{ width: "100%", marginTop: "1rem", fontFamily: "'Inter', sans-serif", fontSize: "0.8rem", lineHeight: 1.6, padding: "0.75rem", borderRadius: 8, border: "1px solid rgba(10,35,66,0.25)", color: NAVY, resize: "vertical" }} />
              )}
              {errorById[ticket.id] && (
                <div style={{ marginTop: "0.75rem", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: PINK }}>⚠ {errorById[ticket.id]}</div>
              )}
              <div style={{ display: "flex", gap: "0.6rem", marginTop: "1rem", flexWrap: "wrap" }}>
                {ownReplyId !== ticket.id ? (
                  <>
                    <button disabled={busyId === ticket.id} onClick={() => haveIsaiahWrite(ticket)} style={{ ...buttonBase, background: GOLD, color: NAVY, border: "none", opacity: busyId === ticket.id ? 0.6 : 1 }}>{busyId === ticket.id ? "Isaiah is writing..." : "Have Isaiah write it"}</button>
                    <button disabled={busyId === ticket.id} onClick={() => { setOwnReplyId(ticket.id); setOwnText(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Write my own reply</button>
                  </>
                ) : (
                  <>
                    <button disabled={busyId === ticket.id || !ownText.trim()} onClick={() => sendOwnReply(ticket)} style={{ ...buttonBase, background: GOLD, color: NAVY, border: "none", opacity: busyId === ticket.id || !ownText.trim() ? 0.5 : 1 }}>{busyId === ticket.id ? "Sending..." : "Send Reply ✓"}</button>
                    <button disabled={busyId === ticket.id} onClick={() => { setOwnReplyId(null); setOwnText(""); }} style={{ ...buttonBase, background: "transparent", color: NAVY, border: "1px solid rgba(10,35,66,0.3)" }}>Cancel</button>
                  </>
                )}
                <button disabled={busyId === ticket.id} onClick={() => closeTicket(ticket)} style={{ ...buttonBase, background: "transparent", color: "rgba(10,35,66,0.55)", border: "1px solid rgba(10,35,66,0.2)" }}>Close ticket</button>
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
                  {hubPill(hubCategoryOf(ticket))}
                  <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: ticket.status === "replied" ? "#2E7D32" : GOLD, color: ticket.status === "replied" ? "#FFFFFF" : NAVY }}>{ticket.status === "replied" ? (card?.source === "support_email_auto" ? "✓ Auto-reply sent" : "✓ Reply Sent") : "Sending reply..."}</span>
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.7rem", color: "rgba(10,35,66,0.45)" }}>{timeAgo(lastActivity(ticket))}</span>
                  <button disabled={busyId === ticket.id} onClick={(e) => { e.stopPropagation(); closeTicket(ticket); }} style={{ ...buttonBase, fontSize: "0.62rem", padding: "0.4rem 0.9rem", background: "transparent", color: "rgba(10,35,66,0.55)", border: "1px solid rgba(10,35,66,0.2)" }}>{busyId === ticket.id ? "..." : "Close ticket"}</button>
                </div>
              </div>
              {open && (
                <div style={{ marginTop: "1rem" }}>
                  <div style={{ ...panelLabel, color: "rgba(10,35,66,0.5)" }}>Conversation</div>
                  {conversation(ticket)}
                  {(messagesByTicket.get(ticket.id) ?? []).every(m => m.direction === "client") && card && (
                    <div style={{ background: "rgba(45,90,142,0.12)", borderRadius: 10, padding: "0.75rem 0.9rem" }}>
                      <div style={{ ...panelLabel, color: BLUE, marginBottom: "0.3rem" }}>Isaiah Carter</div>
                      <div style={bodyText}>{card.edited_output || card.output}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </AdminLayout>
  );
}
