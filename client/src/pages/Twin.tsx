// client/src/pages/Twin.tsx
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const PROMPT_SUGGESTIONS = [
  "Help me understand the DRU CLEAR™ framework",
  "Which framework is right for my organization?",
  "Walk me through the Transformation Pathway™",
  "How does AI Sales Mastery™ work with DISC?",
  "What makes a leader truly transformational?",
  "How do I start my AI readiness journey?",
];

export default function Twin() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || isStreaming) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (
              parsed.type === "content_block_delta" &&
              parsed.delta?.type === "text_delta" &&
              parsed.delta?.text
            ) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.delta.text,
                  };
                }
                return updated;
              });
            }
          } catch {
            // skip
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && last.content === "") {
          updated[updated.length - 1] = {
            ...last,
            content: "I encountered an error. Please try again.",
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0A2342",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: hasMessages ? "flex-start" : "center",
      padding: hasMessages ? "1.5rem 1rem 1.5rem" : "2rem 1rem",
      boxSizing: "border-box",
      fontFamily: "'Inter', sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Montserrat:wght@400;600;700&family=Inter:wght@400;500&display=swap');

        @keyframes twinkle {
          0%, 100% { opacity: 0.25; transform: scale(0.75); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .thinking-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #D4AF37;
          margin: 0 3px;
        }
        .thinking-dot:nth-child(1) { animation: twinkle 1.2s infinite 0s; }
        .thinking-dot:nth-child(2) { animation: twinkle 1.2s infinite 0.2s; }
        .thinking-dot:nth-child(3) { animation: twinkle 1.2s infinite 0.4s; }

        .prompt-btn {
          background: transparent;
          border: 1px solid rgba(212,175,55,0.3);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          color: rgba(255,255,255,0.75);
          font-family: 'Inter', sans-serif;
          font-size: 0.8rem;
          line-height: 1.4;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, color 0.2s;
          width: 100%;
        }
        .prompt-btn:hover {
          border-color: rgba(212,175,55,0.7);
          background: rgba(212,175,55,0.06);
          color: #fff;
        }

        .send-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #D4AF37;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.2s, transform 0.15s;
        }
        .send-btn:hover:not(:disabled) {
          background: #e8c84a;
          transform: scale(1.05);
        }
        .send-btn:disabled {
          background: rgba(212,175,55,0.3);
          cursor: not-allowed;
        }

        .chat-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-family: 'Inter', sans-serif;
          font-size: 0.875rem;
          padding: 0;
        }
        .chat-input::placeholder {
          color: rgba(255,255,255,0.35);
        }

        /* Scrollbar */
        .messages-scroll::-webkit-scrollbar { width: 4px; }
        .messages-scroll::-webkit-scrollbar-track { background: transparent; }
        .messages-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 4px; }
      `}</style>

      {/* ← Command Center */}
      <div style={{ position: "fixed", top: "1rem", right: "1.25rem", zIndex: 100 }}>
        <div
          onClick={() => window.location.href = "/admin"}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#D4AF37",
            border: "1px solid rgba(212,175,55,0.3)",
            borderRadius: 8,
            padding: "0.45rem 0.9rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
            background: "rgba(7,26,48,0.95)",
            backdropFilter: "blur(8px)",
          }}
        >
          ← Command Center
        </div>
      </div>

      {/* Main container */}
      <div style={{ width: "100%", maxWidth: 660 }}>

        {/* ── HEADER CARD ── */}
        <div style={{
          background: "rgba(7,26,48,0.85)",
          border: "1px solid rgba(212,175,55,0.25)",
          borderRadius: 14,
          padding: "1rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
          marginBottom: hasMessages ? "0.75rem" : "2rem",
        }}>
          {/* Photo */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img
              src="/deanna-professional.png"
              alt="DeAnna AI Twin"
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid #D4AF37",
                display: "block",
              }}
            />
            {/* Green online dot */}
            <span style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 11,
              height: 11,
              borderRadius: "50%",
              background: "#22C55E",
              border: "2px solid #071A2E",
            }} />
          </div>

          {/* Name + tagline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              fontFamily: "'Cinzel', serif",
              color: "#FFFFFF",
              fontSize: "1rem",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.02em",
            }}>DeAnna's AI Twin</p>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              color: "#D4AF37",
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "0.12em",
              margin: "3px 0 2px",
              textTransform: "uppercase" as const,
            }}>AI AUTHORITY · DRU AI CONSULTING</p>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.6rem",
              margin: 0,
              letterSpacing: "0.04em",
            }}>AI Mastery · Leadership Clarity · Measurable Results</p>
          </div>

          {/* Powered by */}
          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              color: "rgba(255,255,255,0.35)",
              fontSize: "0.55rem",
              margin: "0 0 2px",
              letterSpacing: "0.04em",
            }}>Powered by</p>
            <p style={{
              fontFamily: "'Cinzel', serif",
              color: "#D4AF37",
              fontSize: "0.72rem",
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.06em",
            }}>DRU CLEAR™</p>
          </div>
        </div>

        {/* ── LANDING STATE ── */}
        {!hasMessages && (
          <div style={{ textAlign: "center" as const, marginBottom: "2rem" }}>
            <h1 style={{
              fontFamily: "'Cinzel', serif",
              color: "#FFFFFF",
              fontSize: "clamp(1.6rem, 5vw, 2rem)",
              fontWeight: 700,
              margin: "0 0 0.75rem",
              letterSpacing: "0.02em",
            }}>
              Hello, DeAnna. 👑
            </h1>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              color: "rgba(255,255,255,0.55)",
              fontSize: "0.9rem",
              lineHeight: 1.7,
              margin: "0 auto 2rem",
              maxWidth: 480,
            }}>
              I am here to stretch you, encourage you, and lead you toward
              clarity. Ask me anything about AI leadership, transformation, or
              where to start your journey.
            </p>

            {/* Prompt buttons — 2 column grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.65rem",
            }}>
              {PROMPT_SUGGESTIONS.map((prompt, i) => (
                <button
                  key={i}
                  className="prompt-btn"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── MESSAGES ── */}
        {hasMessages && (
          <div
            className="messages-scroll"
            style={{
              background: "rgba(7,26,48,0.7)",
              border: "1px solid rgba(212,175,55,0.15)",
              borderRadius: 14,
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
              maxHeight: "55vh",
              overflowY: "auto",
              marginBottom: "0.75rem",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "0.6rem",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                }}
              >
                {/* Avatar */}
                {msg.role === "user" ? (
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#C2185B",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Cinzel', serif",
                    fontWeight: 700,
                    fontSize: "0.75rem",
                    color: "#fff",
                    flexShrink: 0,
                  }}>D</div>
                ) : (
                  <img
                    src="/deanna-professional.png"
                    alt="Twin"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1.5px solid #D4AF37",
                      flexShrink: 0,
                    }}
                  />
                )}

                {/* Bubble */}
                <div style={{
                  maxWidth: "75%",
                  padding: "0.7rem 1rem",
                  borderRadius: msg.role === "user"
                    ? "14px 14px 4px 14px"
                    : "14px 14px 14px 4px",
                  background: msg.role === "user"
                    ? "#C2185B"
                    : "rgba(255,255,255,0.05)",
                  border: msg.role === "assistant"
                    ? "1px solid rgba(212,175,55,0.15)"
                    : "none",
                  color: "#fff",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.85rem",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap" as const,
                }}>
                  {/* Thinking dots for empty assistant message */}
                  {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "0.1rem 0" }}>
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── INPUT BAR ── */}
        <div style={{
          background: "rgba(7,26,48,0.85)",
          border: "1px solid rgba(212,175,55,0.25)",
          borderRadius: 14,
          padding: "0.75rem 0.75rem 0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask DeAnna's Twin anything..."
            disabled={isStreaming}
          />
          <button
            className="send-btn"
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            aria-label="Send"
          >
            {isStreaming ? (
              <span style={{ display: "flex", alignItems: "center" }}>
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
              </span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 5l0 14M12 5l-6 6M12 5l6 6" stroke="#0A2342" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
