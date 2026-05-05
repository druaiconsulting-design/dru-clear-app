// client/src/pages/Twin.tsx
// Updated to call Vercel API route instead of Supabase edge function
// Fixes WallClockTime 546 timeout permanently

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

    // Add empty assistant message to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      // Calls Vercel API route — no wall clock limit
      const response = await fetch("/api/twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

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
            // Non-JSON SSE line — skip
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "1rem",
        fontFamily: "Inter, sans-serif",
        backgroundColor: "#0A2342",
      }}
    >
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
        }
        .thinking-dot:nth-child(1) { animation: twinkle 1.2s infinite 0s; }
        .thinking-dot:nth-child(2) { animation: twinkle 1.2s infinite 0.2s; }
        .thinking-dot:nth-child(3) { animation: twinkle 1.2s infinite 0.4s; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "1rem 1.25rem",
          backgroundColor: "#071A2E",
          borderRadius: "12px 12px 0 0",
          border: "1px solid rgba(212,175,55,0.3)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              color: "#D4AF37",
              fontFamily: "Cinzel, serif",
              fontSize: "1.1rem",
              margin: 0,
              fontWeight: 700,
            }}
          >
            ✦ DeAnna's AI Twin
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.72rem",
              margin: "4px 0 0",
              fontFamily: "Montserrat, sans-serif",
              letterSpacing: "0.06em",
            }}
          >
            MASTER ORCHESTRATOR · DRU AI CONSULTING
          </p>
        </div>
        <div
          onClick={() => window.location.href = "/admin"}
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "#D4AF37",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 8,
            padding: "0.6rem 1.25rem",
            letterSpacing: "0.06em",
            cursor: "pointer",
            whiteSpace: "nowrap" as const,
          }}
        >
          ← Command Center
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1.25rem",
          backgroundColor: "#071A2E",
          border: "1px solid rgba(212,175,55,0.3)",
          borderTop: "1px solid rgba(212,175,55,0.15)",
          borderBottom: "none",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "rgba(255,255,255,0.25)",
              marginTop: "3rem",
              fontSize: "0.85rem",
              fontFamily: "Inter, sans-serif",
              lineHeight: 1.8,
            }}
          >
            <p style={{ color: "#D4AF37", fontFamily: "Cinzel, serif", fontSize: "1rem", marginBottom: "0.5rem" }}>
              AI Mastery. Leadership Clarity. Measurable Results.
            </p>
            Ask your Twin anything about AI strategy, leadership, or your business.
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
            }}
          >
            {msg.role === "assistant" && (
              <p style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "0.58rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#D4AF37",
                margin: "0 0 4px 4px",
                textTransform: "uppercase",
              }}>
                ✦ AI Twin
              </p>
            )}
            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                backgroundColor:
                  msg.role === "user"
                    ? "#C2185B"
                    : "rgba(255,255,255,0.05)",
                border: msg.role === "assistant" ? "1px solid rgba(212,175,55,0.2)" : "none",
                color: "#FFFFFF",
                fontFamily: "Inter, sans-serif",
                fontSize: "0.85rem",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {msg.content}
              {msg.role === "assistant" && msg.content === "" && isStreaming && (
                <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 0" }}>
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

      {/* Input */}
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          backgroundColor: "#071A2E",
          border: "1px solid rgba(212,175,55,0.3)",
          borderTop: "1px solid rgba(212,175,55,0.15)",
          borderRadius: "0 0 12px 12px",
        }}
      >
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
            border: "1px solid rgba(212,175,55,0.25)",
            borderRadius: 8,
            padding: "0.65rem 1rem",
            color: "#FFFFFF",
            fontFamily: "Inter, sans-serif",
            fontSize: "0.85rem",
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
            padding: "0.65rem 1.25rem",
            color: "#0A2342",
            fontFamily: "Montserrat, sans-serif",
            fontSize: "0.72rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            cursor: isStreaming ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {isStreaming ? "..." : "SEND"}
        </button>
      </div>
    </div>
  );
}
