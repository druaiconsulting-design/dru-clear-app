import { useState, useRef } from "react";
import { DruLogo } from "./Utility";
import { BADGE_URLS } from "../constants";
import { getTier, sendWebhook, UTM_PARAMS } from "../utils";
import type { LeadData, Scores } from "../types";

export default function Share({ lead, scores, onRevisit }: {
  lead: LeadData; scores: Scores; onRevisit: () => void;
}) {
  const total       = Object.values(scores).reduce((a, b) => a + b, 0);
  const tier        = getTier(total);
  const scaledScore = Math.round((total / 75) * 100);
  const refParam    = lead.email ? `?ref=${encodeURIComponent(lead.email)}` : "";
  const assessmentUrl  = `https://assessment.druaiconsulting.com${refParam}`;
  const shareText      = `I just completed my AI Readiness Assessment by DRU AI Consulting and scored ${scaledScore}/100. See how ready YOUR business is for AI — take the free assessment here: ${assessmentUrl}`;
  const linkedInUrl    = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(assessmentUrl)}&summary=${encodeURIComponent(shareText)}`;
  const whatsAppUrl    = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const linkedInCaption = `Just completed the DRU CLEAR™ AI Readiness Assessment by DRU AI Consulting and scored ${scaledScore}/100 — ${tier.label} tier.\n\nIf you're a leader wondering whether your organization is truly AI-ready, this 3-minute assessment is worth your time.\n\nTake it here: ${assessmentUrl}\n\n#AIReadiness #DRUClear #AILeadership #DigitalTransformation`;
  const whatsAppCaption = `Hey! I just took the DRU CLEAR™ AI Readiness Assessment and scored ${scaledScore}/100 (${tier.label} tier). It's a free 3-min assessment that shows how AI-ready your business really is. Worth a look: ${assessmentUrl}`;

  const [copied, setCopied]                     = useState(false);
  const [feedback, setFeedback]                 = useState<"up" | "down" | null>(null);
  const [colleagueEmail, setColleagueEmail]     = useState("");
  const [colleagueSent, setColleagueSent]       = useState(false);
  const [colleagueError, setColleagueError]     = useState("");
  const [shareConfirmChannel, setShareConfirmChannel] = useState<string | null>(null);
  const [expandedCaption, setExpandedCaption]   = useState<string | null>(null);
  const shareConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const badgeUrl = BADGE_URLS[tier.label];

  const showShareConfirm = (channel: string) => {
    if (shareConfirmTimer.current) clearTimeout(shareConfirmTimer.current);
    setShareConfirmChannel(channel);
    shareConfirmTimer.current = setTimeout(() => setShareConfirmChannel(null), 3500);
  };

  const fireShareWebhook = (channel: string) => {
    showShareConfirm(channel);
    sendWebhook({ event_type: "share_click", channel, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(shareText); } catch { const el = document.createElement("textarea"); el.value = shareText; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
    sendWebhook({ event_type: "link_copied", channel: "clipboard", first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
    fireShareWebhook("clipboard");
  };

  const handleCopyCaption = async (text: string, channel: string) => {
    try { await navigator.clipboard.writeText(text); } catch { const el = document.createElement("textarea"); el.value = text; document.body.appendChild(el); el.select(); document.execCommand("copy"); document.body.removeChild(el); }
    sendWebhook({ event_type: "caption_copied", channel, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const handleColleagueSend = () => {
    if (!colleagueEmail.trim()) { setColleagueError("Please enter an email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(colleagueEmail.trim())) { setColleagueError("Please enter a valid email address."); return; }
    setColleagueError("");
    sendWebhook({ event_type: "referral_email_sent", referrer_email: lead.email, referrer_name: `${lead.firstName} ${lead.lastName}`, referred_email: colleagueEmail.trim(), referral_link: assessmentUrl, score: scaledScore, result: tier.label, ...UTM_PARAMS, timestamp: new Date().toISOString() });
    setColleagueSent(true);
  };

  const handleFeedback = (rating: "up" | "down") => {
    if (feedback) return;
    setFeedback(rating);
    sendWebhook({ event_type: "feedback", rating, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, score: scaledScore, result: tier.label, ai_country_name: lead.country_name || "", ai_country_iso: lead.country_iso || "", ...UTM_PARAMS, timestamp: new Date().toISOString() });
  };

  const shareBtnStyle = (color: string): React.CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", width: "100%", padding: "0.75rem 1rem", background: `${color}14`, color: color, border: `1.5px solid ${color}50`, borderRadius: 6, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.05em", cursor: "pointer", transition: "background 0.2s, border-color 0.2s", textDecoration: "none" });

  return (
    <div className="screen-enter flex flex-col items-center" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2rem 1.5rem 3rem", textAlign: "center" }}>
      <div className="flex justify-between items-center w-full mb-4" style={{ maxWidth: 360 }}>
        <DruLogo height={80} />
        <span className="text-xs" style={{ color: "rgba(230,230,230,0.35)", fontFamily: "'Inter', sans-serif" }}>Page 9 of 9</span>
      </div>
      <div style={{ width: 72, height: 72, minWidth: 72, minHeight: 72, borderRadius: "50%", border: "2px solid #D4AF37", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.25rem", background: "rgba(212,175,55,0.08)", flexShrink: 0 }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 16L13 23L26 9" stroke="#D4AF37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37", lineHeight: 1.2, maxWidth: 340 }}>Lead the AI Conversation</h2>
      <p className="text-base mb-2 max-w-xs" style={{ color: "#E6E6E6", lineHeight: 1.6 }}>Position yourself as an AI-forward leader. Share your results, invite others to assess their readiness, and expand the conversation.</p>
      <p className="text-xs mb-6 max-w-xs" style={{ color: "rgba(212,175,55,0.7)", fontStyle: "italic", lineHeight: 1.6 }}>Leaders across industries are using this assessment to benchmark their AI readiness.</p>
      {badgeUrl && (
        <div className="flex flex-col items-center" style={{ gap: "0.4rem", marginBottom: "1.5rem", width: "100%", maxWidth: 340, position: "relative", zIndex: 1 }}>
          <button onClick={async () => { try { const res = await fetch(badgeUrl); const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `DRU-CLEAR-Badge-${tier.label}.png`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); } catch { window.open(badgeUrl, "_blank"); } }} title="Tap to save & share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
            <img src={badgeUrl} alt={`${tier.label} tier badge`} loading="eager" style={{ width: "100%", maxWidth: 340, height: "auto", display: "block", borderRadius: 8, border: `1px solid ${tier.color}40`, boxShadow: `0 4px 24px ${tier.color}20` }} />
          </button>
          <p style={{ color: "rgba(212,175,55,0.55)", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase", margin: 0 }}>Save your badge and share your AI readiness score</p>
        </div>
      )}
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>SPREAD THE WORD</p>
        <p style={{ color: "#E6E6E6", fontSize: "0.8rem", lineHeight: 1.6, marginBottom: "0.5rem" }}>Know a leader who should take this? Share your link or send it directly.</p>
        <p style={{ color: "rgba(212,175,55,0.65)", fontSize: "0.72rem", fontStyle: "italic", lineHeight: 1.5, marginBottom: "1rem" }}>Your unique referral link is automatically included in every share.</p>
        <div className="flex flex-col gap-2 mb-3">
          <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={shareBtnStyle("#0A66C2")} onClick={() => fireShareWebhook("linkedin")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            Share on LinkedIn
          </a>
          <a href={whatsAppUrl} target="_blank" rel="noopener noreferrer" style={shareBtnStyle("#25D366")} onClick={() => fireShareWebhook("whatsapp")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Share on WhatsApp
          </a>
          <button onClick={handleCopyLink} style={shareBtnStyle("#FFFFFF")}>
            {copied ? (<><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7L5.5 10.5L12 3.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>Link Copied!</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>Copy My Referral Link</>)}
          </button>
        </div>
        {shareConfirmChannel && (
          <div style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 6, padding: "0.5rem 0.75rem", marginBottom: "0.75rem", textAlign: "center" }}>
            <p style={{ color: "#D4AF37", fontSize: "0.75rem", margin: 0 }}>✓ Shared via {shareConfirmChannel}! Your referral link is included.</p>
          </div>
        )}
        <div style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: 6, padding: "0.65rem 0.75rem", marginBottom: "0.5rem" }}>
          <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.72rem", lineHeight: 1.6, margin: 0 }}>When someone completes the assessment using your link, it's tracked to you.</p>
          <p style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.68rem", fontStyle: "italic", lineHeight: 1.5, marginTop: "0.35rem", marginBottom: 0 }}>Top referrers may receive exclusive access, private sessions, or strategic bonuses.</p>
        </div>
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>READY-MADE COPY <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.63rem", color: "rgba(230,230,230,0.45)" }}>(Tap to expand)</span></p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.72rem", marginBottom: "0.75rem" }}>Use the captions below to quickly share your results across platforms.</p>
        {[{ id: "linkedin", label: "LinkedIn", color: "#0A66C2", caption: linkedInCaption }, { id: "whatsapp", label: "WhatsApp", color: "#25D366", caption: whatsAppCaption }].map((ch) => (
          <div key={ch.id} style={{ marginBottom: "0.65rem" }}>
            <button onClick={() => setExpandedCaption(expandedCaption === ch.id ? null : ch.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "0.55rem 0.75rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: expandedCaption === ch.id ? "6px 6px 0 0" : 6, color: "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
              <span style={{ color: ch.color }}>{ch.label}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: expandedCaption === ch.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><path d="M2 4L6 8L10 4" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {expandedCaption === ch.id && (
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)", borderTop: "none", borderRadius: "0 0 6px 6px", padding: "0.65rem 0.75rem" }}>
                <p style={{ color: "rgba(230,230,230,0.75)", fontSize: "0.7rem", lineHeight: 1.6, marginBottom: "0.5rem", whiteSpace: "pre-line" }}>{ch.caption}</p>
                <button onClick={() => handleCopyCaption(ch.caption, ch.id)} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.4rem 0.75rem", background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 4, color: "#D4AF37", fontSize: "0.7rem", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}>Copy Caption</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "left" }}>
        <p style={{ color: "#D4AF37", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.35rem" }}>Send This to a Colleague</p>
        <p style={{ color: "rgba(230,230,230,0.6)", fontSize: "0.75rem", lineHeight: 1.6, marginBottom: "0.75rem" }}>Enter their email and we'll send them your personalized assessment link.</p>
        {!colleagueSent ? (
          <>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input className="dru-input" type="email" placeholder="colleague@company.com" value={colleagueEmail} onChange={(e) => { setColleagueEmail(e.target.value); setColleagueError(""); }} style={{ flex: 1 }} />
              <button onClick={handleColleagueSend} style={{ padding: "0 1rem", background: "#D4AF37", color: "#0A2342", border: "none", borderRadius: 4, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap" }}>Send →</button>
            </div>
            {colleagueError && <p style={{ color: "#E53935", fontSize: "0.7rem", marginTop: "0.35rem" }}>{colleagueError}</p>}
          </>
        ) : (
          <div style={{ background: "rgba(67,160,71,0.1)", border: "1px solid rgba(67,160,71,0.3)", borderRadius: 6, padding: "0.65rem 0.75rem" }}>
            <p style={{ color: "#43A047", fontSize: "0.78rem", margin: 0 }}>✓ Invite sent! Your referral link was included.</p>
          </div>
        )}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.5rem", textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.7)", fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.75rem" }}>Was this assessment helpful?</p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button onClick={() => handleFeedback("up")} disabled={!!feedback} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.25rem", background: feedback === "up" ? "rgba(67,160,71,0.15)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${feedback === "up" ? "#43A047" : "rgba(255,255,255,0.15)"}`, borderRadius: 6, color: feedback === "up" ? "#43A047" : "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: feedback ? "default" : "pointer", transition: "all 0.2s" }}>👍 Yes</button>
          <button onClick={() => handleFeedback("down")} disabled={!!feedback} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.55rem 1.25rem", background: feedback === "down" ? "rgba(229,57,53,0.1)" : "rgba(255,255,255,0.05)", border: `1.5px solid ${feedback === "down" ? "#E53935" : "rgba(255,255,255,0.15)"}`, borderRadius: 6, color: feedback === "down" ? "#E53935" : "#E6E6E6", fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: feedback ? "default" : "pointer", transition: "all 0.2s" }}>👎 Not Really</button>
        </div>
        {feedback && <p style={{ color: "rgba(212,175,55,0.7)", fontSize: "0.72rem", marginTop: "0.5rem", fontStyle: "italic" }}>{feedback === "up" ? "Thank you! We're glad it was helpful." : "Thank you for your feedback — we'll keep improving."}</p>}
      </div>
      <div className="gold-divider mb-5" style={{ width: "100%", maxWidth: 340 }} />
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1.75rem", textAlign: "center" }}>
        <button onClick={onRevisit} style={{ background: "none", border: "none", color: "#D4AF37", fontWeight: 700, fontSize: "0.82rem", textDecoration: "underline", textUnderlineOffset: 3, cursor: "pointer", fontFamily: "'Montserrat', sans-serif" }}>→ Revisit Your Diagnostic Options</button>
      </div>
      <div style={{ width: "100%", maxWidth: 340, marginBottom: "1rem", textAlign: "center" }}>
        <p style={{ color: "rgba(230,230,230,0.5)", fontSize: "0.72rem", marginBottom: "0.25rem" }}>Created by DeAnna R. Upshaw — AI Authority</p>
        <a href="https://druaiconsulting.com" target="_blank" rel="noopener noreferrer" style={{ color: "#D4AF37", fontSize: "0.72rem", textDecoration: "underline", textUnderlineOffset: 3 }}>druaiconsulting.com</a>
      </div>
    </div>
  );
}
