// client/src/pages/Twin.tsx
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Twin() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const userText = input.trim();
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

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#0A2342",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem 1.5rem",
      boxSizing: "border-box",
    }}>
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .thinking-dot {
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: #D4AF37;
          margin: 0 2px;
          vertical-align: middle;
        }
        .thinking-dot:nth-child(1) { animation: twinkle 1.2s infinite 0s; }
        .thinking-dot:nth-child(2) { animation: twinkle 1.2s infinite 0.2s; }
        .thinking-dot:nth-child(3) { animation: twinkle 1.2s infinite 0.4s; }
      `}</style>

      {/* ← Command Center — fixed top right */}
      <div style={{ position: "fixed", top: "1rem", right: "1.25rem", zIndex: 100 }}>
        <div
          onClick={() => window.location.href = "/admin"}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.68rem",
            fontWeight: 700,
            color: "#D4AF37",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 8,
            padding: "0.5rem 1rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
            background: "rgba(7,26,48,0.95)",
            backdropFilter: "blur(8px)",
          }}
        >
          ← Command Center
        </div>
      </div>

      {/* Chat box — grows with content */}
      <div style={{ width: "100%", maxWidth: 660 }}>

        {/* Header */}
        <div style={{
          background: "#071A2E",
          border: "1px solid rgba(212,175,55,0.3)",
          borderBottom: "1px solid rgba(212,175,55,0.1)",
          borderRadius: "14px 14px 0 0",
          padding: "0.875rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <img
            src="/deanna-professional.png"
            alt="AI Twin"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "2px solid #D4AF37",
              objectFit: "cover",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <p style={{
              fontFamily: "'Cinzel', serif",
              color: "#D4AF37",
              fontSize: "0.88rem",
              fontWeight: 700,
              margin: 0,
            }}>✦ DeAnna's AI Twin</p>
            <p style={{
              fontFamily: "'Montserrat', sans-serif",
              color: "rgba(255,255,255,0.35)",
              fontSize: "0.55rem",
              letterSpacing: "0.08em",
              margin: "2px 0 0",
            }}>MASTER ORCHESTRATOR · DRU AI CONSULTING</p>
          </div>
          {isStreaming && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                fontFamily: "'Montserrat', sans-serif",
                fontSize: "0.55rem",
                color: "rgba(212,175,55,0.6)",
                letterSpacing: "0.06em",
                marginRight: 2,
              }}>THINKING</span>
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          )}
        </div>

        {/* Messages — only shows when there are messages */}
        {messages.length > 0 && (
          <div style={{
            background: "#071A2E",
            border: "1px solid rgba(212,175,55,0.2)",
            borderTop: "none",
            borderBottom: "none",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxHeight: "52vh",
            overflowY: "auto",
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "83%",
              }}>
                {msg.role === "assistant" && (
                  <p style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: "#D4AF37",
                    margin: "0 0 4px 4px",
                    textTransform: "uppercase" as const,
                  }}>✦ AI Twin</p>
                )}
                <div style={{
                  padding: "0.65rem 0.95rem",
                  borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  background: msg.role === "user" ? "#C2185B" : "rgba(255,255,255,0.05)",
                  border: msg.role === "assistant" ? "1px solid rgba(212,175,55,0.15)" : "none",
                  color: "#FFFFFF",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "0.82rem",
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap" as const,
                }}>
                  {msg.content}
                  {msg.role === "assistant" && msg.content === "" && isStreaming && (
                    <span style={{ display: "inline-flex", alignItems: "center" }}>
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        <div style={{
          background: "#071A2E",
          border: "1px solid rgba(212,175,55,0.3)",
          borderTop: messages.length > 0 ? "1px solid rgba(212,175,55,0.1)" : "none",
          borderRadius: "0 0 14px 14px",
          padding: "0.875rem 1rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your Twin..."
            disabled={isStreaming}
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(212,175,55,0.2)",
              borderRadius: 8,
              padding: "0.6rem 0.875rem",
              color: "#FFFFFF",
              fontFamily: "'Inter', sans-serif",
              fontSize: "0.82rem",
              outline: "none",
            }}
          />
          <button
            onClick={sendMessage}
            disabled={isStreaming || !input.trim()}
            style={{
              background: isStreaming ? "rgba(212,175,55,0.3)" : "#D4AF37",
              border: "none",
              borderRadius: 8,
              padding: "0.6rem 1.1rem",
              color: "#0A2342",
              fontFamily: "'Montserrat', sans-serif",
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              cursor: isStreaming ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            {isStreaming ? "..." : "SEND"}
          </button>
        </div>

        {/* Twin photo — circular, outside below chat box */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "1.25rem",
          gap: "0.4rem",
        }}>
          <img
            src="/deanna-professional.png"
            alt="DeAnna R. Upshaw"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              border: "2px solid #D4AF37",
              objectFit: "cover",
            }}
          />
          <p style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.52rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(212,175,55,0.45)",
            margin: 0,
            textTransform: "uppercase" as const,
            textAlign: "center" as const,
          }}>
            AI Mastery. Leadership Clarity. Measurable Results.
          </p>
        </div>

      </div>
    </div>
  );
}
