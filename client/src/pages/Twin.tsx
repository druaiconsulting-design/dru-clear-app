import { useState, useEffect, useRef } from "react";
import NavBar from "../components/NavBar";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "Help me understand the DRU CLEAR™ framework",
  "Which framework is right for my organization?",
  "Walk me through the Transformation Pathway™",
  "How does AI Sales Mastery™ work with DISC?",
  "What makes a leader truly transformational?",
  "How do I start my AI readiness journey?",
];

export default function Twin() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggested, setShowSuggested] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 140) + "px";
    }
  }, [input]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);
    setShowSuggested(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("twin-chat", {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (fnError) throw fnError;
      const reply = data?.reply || "I'm here — try sending your message again.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date() }]);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error("Twin error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
    || user?.email?.split("@")[0]
    || "Friend";

  const AvatarImg = ({ size = 56, fallbackSize = "1.4rem" }: { size?: number; fallbackSize?: string }) =>
    !avatarError ? (
      <img
        src="/deanna-avatar.jpg"
        alt="DeAnna R. Upshaw"
        onError={() => setAvatarError(true)}
        style={{ width: size, height: size, borderRadius: "50%", border: `${size > 40 ? 2 : 1}px solid #D4AF37`, objectFit: "cover" as const, flexShrink: 0 }}
      />
    ) : (
      <div style={{ width: size, height: size, borderRadius: "50%", border: `${size > 40 ? 2 : 1}px solid #D4AF37`, background: "linear-gradient(135deg,#0A2342,#1a3a5c)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: fallbackSize }}>
        👑
      </div>
    );

  const canSend = input.trim() && !loading;

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column" }}>
      <NavBar active="/twin" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 800, margin: "0 auto", width: "100%", padding: "1.5rem 1rem 0" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", padding: "1rem 1.25rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 14 }}>
          <AvatarImg size={56} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#43A047", boxShadow: "0 0 6px #43A047", display: "inline-block" }} />
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, margin: 0 }}>
                DeAnna's AI Twin
              </p>
            </div>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "#D4AF37", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, margin: "0 0 2px" }}>
              AI Authority · DRU AI Consulting
            </p>
            <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.4)", fontSize: "0.62rem", margin: 0 }}>
              AI Mastery · Leadership Clarity · Measurable Results
            </p>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(230,230,230,0.3)", fontSize: "0.58rem", margin: "0 0 2px" }}>Powered by</p>
            <p style={{ fontFamily: "'Montserrat', sans-serif", color: "rgba(212,175,55,0.6)", fontSize: "0.62rem", fontWeight: 700, margin: 0 }}>DRU CLEAR™</p>
          </div>
        </div>

        {/* Messages area */}
        <div style={{ flex: 1, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: "1rem", paddingBottom: "1rem", minHeight: 0 }}>

          {/* Welcome */}
          {messages.length === 0 && (
            <div style={{ textAlign: "center" as const, padding: "1.5rem 1rem 0.5rem" }}>
              <p style={{ fontFamily: "'Playfair Display', serif", color: "#FFFFFF", fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                Hello, {firstName}. 👑
              </p>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.55)", fontSize: "0.82rem", lineHeight: 1.65, maxWidth: 480, margin: "0 auto 1.5rem" }}>
                I am here to stretch you, encourage you, and lead you toward clarity. Ask me anything about AI leadership, transformation, or where to start your journey.
              </p>
            </div>
          )}

          {/* Suggested prompts */}
          {showSuggested && messages.length === 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.5rem" }}>
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  style={{ background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 10, padding: "0.75rem 0.875rem", textAlign: "left" as const, cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.12)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.06)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.2)"; }}
                >
                  <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(230,230,230,0.8)", fontSize: "0.72rem", lineHeight: 1.4, margin: 0 }}>{prompt}</p>
                </button>
              ))}
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: "0.5rem", alignItems: "flex-end" }}>

              {msg.role === "assistant" && <AvatarImg size={30} fallbackSize="0.8rem" />}

              <div style={{ maxWidth: "72%", padding: "0.75rem 1rem", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "linear-gradient(135deg,#C2185B,#a01549)" : "rgba(255,255,255,0.06)", border: msg.role === "user" ? "none" : "1px solid rgba(212,175,55,0.15)" }}>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "#FFFFFF", fontSize: "0.84rem", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" as const }}>{msg.content}</p>
                <p style={{ fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.58rem", margin: "0.375rem 0 0", textAlign: "right" as const }}>
                  {msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>

              {msg.role === "user" && (
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(194,24,91,0.3)", border: "1px solid rgba(194,24,91,0.5)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: "0.72rem", color: "#FFFFFF" }}>
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          ))}

          {/* Loading dots */}
          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
              <AvatarImg size={30} fallbackSize="0.8rem" />
              <div style={{ padding: "0.875rem 1rem", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(212,175,55,0.15)", borderRadius: "14px 14px 14px 4px", display: "flex", gap: 5, alignItems: "center" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#D4AF37", animation: "twinPulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(194,24,91,0.1)", border: "1px solid rgba(194,24,91,0.3)", borderRadius: 8, padding: "0.75rem 1rem" }}>
              <p style={{ fontFamily: "'Inter', sans-serif", color: "#C2185B", fontSize: "0.78rem", margin: 0 }}>{error}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", padding: "0.875rem 1rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 14, margin: "0.75rem 0 1rem" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask DeAnna's Twin anything..."
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#FFFFFF", fontFamily: "'Inter', sans-serif", fontSize: "0.88rem", lineHeight: 1.5, resize: "none" as const, minHeight: 24, maxHeight: 140 }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!canSend}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: canSend ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, fontSize: "1.1rem", background: canSend ? "#D4AF37" : "rgba(212,175,55,0.15)", color: canSend ? "#0A2342" : "rgba(212,175,55,0.3)", transition: "all 0.2s" }}
          >
            ↑
          </button>
        </div>

      </main>

      <style>{`@keyframes twinPulse{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-5px);opacity:1}}`}</style>

      <footer style={{ textAlign: "center" as const, padding: "0.75rem", color: "rgba(255,255,255,0.15)", fontFamily: "'Montserrat', sans-serif", fontSize: "0.6rem", letterSpacing: "0.04em" }}>
        © 2026 DRU CLEAR™ · All Rights Reserved · DRU AI Consulting
      </footer>
    </div>
  );
}
