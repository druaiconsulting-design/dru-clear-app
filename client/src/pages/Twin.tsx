import { useState, useRef, useEffect } from "react";

interface ContentBlock {
  type: "document" | "image" | "text";
  source?: { type: "base64"; media_type: string; data: string };
  text?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  apiContent?: (ContentBlock | { type: "text"; text: string })[];
  attachmentNames?: string[];
}

interface Attachment {
  name: string;
  displaySize: string;
  fileType: "pdf" | "image" | "text" | "docx";
  contentBlock: ContentBlock;
}

const PROMPT_SUGGESTIONS = [
  "Have Darius write today's LinkedIn post",
  "Ask Theo to design a slide deck concept",
  "Have Nia write a thought leadership article",
  "Ask Kwame to draft a client proposal outline",
  "Have Amelia write a video script for the course",
  "Ask Zara to review our launch readiness",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileTypeLabel(type: Attachment["fileType"]): string {
  const labels = { pdf: "PDF", image: "Image", text: "Text", docx: "Word" };
  return labels[type];
}

export default function Twin() {
  const [messages, setMessages]               = useState<Message[]>([]);
  const [input, setInput]                     = useState("");
  const [isStreaming, setIsStreaming]          = useState(false);
  const [attachments, setAttachments]         = useState<Attachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const processFile = async (file: File): Promise<Attachment | null> => {
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) { alert(`${file.name} is too large. Maximum size is 15MB.`); return null; }
    const displaySize = formatFileSize(file.size);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (ext === "pdf" || file.type === "application/pdf") {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const b64 = (reader.result as string).split(",")[1]; resolve(b64); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return { name: file.name, displaySize, fileType: "pdf", contentBlock: { type: "document", source: { type: "base64", media_type: "application/pdf", data } } };
    }

    if (["png","jpg","jpeg","gif","webp"].includes(ext) || file.type.startsWith("image/")) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { const b64 = (reader.result as string).split(",")[1]; resolve(b64); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const mediaType = file.type || "image/jpeg";
      return { name: file.name, displaySize, fileType: "image", contentBlock: { type: "image", source: { type: "base64", media_type: mediaType, data } } };
    }

    if (ext === "txt" || file.type === "text/plain") {
      const text = await file.text();
      return { name: file.name, displaySize, fileType: "text", contentBlock: { type: "text", text: `[Attached file: ${file.name}]\n\n${text}` } };
    }

    if (ext === "docx" || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => { resolve((reader.result as string).split(",")[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      try {
        const res = await fetch("/api/extract-docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: b64, filename: file.name }) });
        if (!res.ok) throw new Error("Extraction failed");
        const { text } = await res.json();
        return { name: file.name, displaySize, fileType: "docx", contentBlock: { type: "text", text: `[Attached Word document: ${file.name}]\n\n${text}` } };
      } catch {
        alert(`Could not extract text from ${file.name}. Please convert to PDF or TXT and try again.`);
        return null;
      }
    }

    alert(`Unsupported file type: .${ext}. Please use PDF, Word (.docx), image, or text files.`);
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (attachments.length + files.length > 3) { alert("Maximum 3 attachments per message."); return; }
    setIsProcessingFile(true);
    const results = await Promise.all(files.map(processFile));
    const valid = results.filter((r): r is Attachment => r !== null);
    setAttachments(prev => [...prev, ...valid]);
    setIsProcessingFile(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => setAttachments(prev => prev.filter((_, i) => i !== index));

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if ((!userText && attachments.length === 0) || isStreaming) return;

    const displayText = userText || (attachments.length > 0 ? `[${attachments.map(a => a.name).join(", ")}]` : "");
    const hasAttachments = attachments.length > 0;

    let apiContent: (ContentBlock | { type: "text"; text: string })[] | undefined;
    if (hasAttachments) {
      apiContent = [
        ...attachments.map(a => a.contentBlock),
        ...(userText ? [{ type: "text" as const, text: userText }] : []),
      ];
    }

    const userMessage: Message = {
      role: "user",
      content: displayText,
      apiContent,
      attachmentNames: hasAttachments ? attachments.map(a => a.name) : undefined,
    };

    const newMessages: Message[] = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setAttachments([]);
    setIsStreaming(true);
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    const apiMessages = newMessages.map(msg => ({
      role: msg.role,
      content: msg.apiContent ?? msg.content,
    }));

    try {
      const response = await fetch("/api/twin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
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
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta" && parsed.delta?.text) {
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") updated[updated.length - 1] = { ...last, content: last.content + parsed.delta.text };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last.role === "assistant" && last.content === "") updated[updated.length - 1] = { ...last, content: "I encountered an error. Please try again." };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const hasMessages = messages.length > 0;
  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isStreaming && !isProcessingFile;

  return (
    <div style={{ minHeight: "100dvh", background: "#0A2342", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: hasMessages ? "flex-start" : "center", padding: hasMessages ? "1.5rem 1rem 1.5rem" : "2rem 1rem", boxSizing: "border-box", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Montserrat:wght@400;600;700&family=Inter:wght@400;500&display=swap');
        @keyframes twinkle { 0%,100%{opacity:.25;transform:scale(.75)} 50%{opacity:1;transform:scale(1.2)} }
        .thinking-dot { display:inline-block;width:8px;height:8px;border-radius:50%;background:#D4AF37;margin:0 3px; }
        .thinking-dot:nth-child(1){animation:twinkle 1.2s infinite 0s}
        .thinking-dot:nth-child(2){animation:twinkle 1.2s infinite .2s}
        .thinking-dot:nth-child(3){animation:twinkle 1.2s infinite .4s}
        .prompt-btn { background:transparent;border:1px solid rgba(212,175,55,0.3);border-radius:10px;padding:.75rem 1rem;color:rgba(255,255,255,0.75);font-family:'Inter',sans-serif;font-size:.8rem;line-height:1.4;text-align:left;cursor:pointer;transition:border-color .2s,background .2s,color .2s;width:100%; }
        .prompt-btn:hover { border-color:rgba(212,175,55,.7);background:rgba(212,175,55,.06);color:#fff; }
        .send-btn { width:42px;height:42px;border-radius:50%;background:#D4AF37;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s,transform .15s; }
        .send-btn:hover:not(:disabled){background:#e8c84a;transform:scale(1.05)}
        .send-btn:disabled{background:rgba(212,175,55,.3);cursor:not-allowed}
        .attach-btn { width:36px;height:36px;border-radius:8px;background:transparent;border:1px solid rgba(212,175,55,.25);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .2s,background .2s; }
        .attach-btn:hover{border-color:rgba(212,175,55,.6);background:rgba(212,175,55,.07)}
        .attach-btn:disabled{opacity:.4;cursor:not-allowed}
        .chat-input { flex:1;background:transparent;border:none;outline:none;color:#fff;font-family:'Inter',sans-serif;font-size:.875rem;padding:0; }
        .chat-input::placeholder{color:rgba(255,255,255,.35)}
        .messages-scroll::-webkit-scrollbar{width:4px}
        .messages-scroll::-webkit-scrollbar-track{background:transparent}
        .messages-scroll::-webkit-scrollbar-thumb{background:rgba(212,175,55,.2);border-radius:4px}
      `}</style>

      <div style={{ position: "fixed", top: "1rem", right: "1.25rem", zIndex: 100 }}>
        <div onClick={() => window.location.href = "/admin"} style={{ fontFamily: "'Montserrat',sans-serif", fontSize: ".65rem", fontWeight: 700, color: "#D4AF37", border: "1px solid rgba(212,175,55,.3)", borderRadius: 8, padding: ".45rem .9rem", letterSpacing: ".06em", cursor: "pointer", background: "rgba(7,26,48,.95)", backdropFilter: "blur(8px)" }}>
          ← Command Center
        </div>
      </div>

      <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,image/*" style={{ display: "none" }} onChange={handleFileSelect} />

      <div style={{ width: "100%", maxWidth: 660 }}>

        {/* Header card */}
        <div style={{ background: "rgba(7,26,48,.85)", border: "1px solid rgba(212,175,55,.25)", borderRadius: 14, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: ".875rem", marginBottom: hasMessages ? ".75rem" : "2rem" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <img src="/deanna-professional.png" alt="DeAnna AI Twin" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: "2px solid #D4AF37", display: "block" }} />
            <span style={{ position: "absolute", bottom: 2, right: 2, width: 11, height: 11, borderRadius: "50%", background: "#22C55E", border: "2px solid #071A2E" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "'Cinzel',serif", color: "#FFFFFF", fontSize: "1rem", fontWeight: 700, margin: 0, letterSpacing: ".02em" }}>DeAnna's AI Twin</p>
            <p style={{ fontFamily: "'Montserrat',sans-serif", color: "#D4AF37", fontSize: ".6rem", fontWeight: 700, letterSpacing: ".12em", margin: "3px 0 2px", textTransform: "uppercase" as const }}>Command Interface · DRU AI Consulting</p>
            <p style={{ fontFamily: "'Montserrat',sans-serif", color: "rgba(255,255,255,.4)", fontSize: ".6rem", margin: 0, letterSpacing: ".04em" }}>54 agents · 9 divisions · All at your command</p>
          </div>
          <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
            <p style={{ fontFamily: "'Montserrat',sans-serif", color: "rgba(255,255,255,.35)", fontSize: ".55rem", margin: "0 0 2px", letterSpacing: ".04em" }}>Powered by</p>
            <p style={{ fontFamily: "'Cinzel',serif", color: "#D4AF37", fontSize: ".72rem", fontWeight: 700, margin: 0, letterSpacing: ".06em" }}>DRU CLEAR™</p>
          </div>
        </div>

        {/* Landing state */}
        {!hasMessages && (
          <div style={{ textAlign: "center" as const, marginBottom: "2rem" }}>
            <h1 style={{ fontFamily: "'Cinzel',serif", color: "#FFFFFF", fontSize: "clamp(1.6rem,5vw,2rem)", fontWeight: 700, margin: "0 0 .75rem", letterSpacing: ".02em" }}>
              Your empire awaits. 👑
            </h1>
            <p style={{ fontFamily: "'Inter',sans-serif", color: "rgba(255,255,255,.55)", fontSize: ".9rem", lineHeight: 1.7, margin: "0 auto 2rem", maxWidth: 480 }}>
              Command any of your 54 agents, attach your content and let AI infuse it, or ask me anything. This is your personal interface — built for you alone.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem" }}>
              {PROMPT_SUGGESTIONS.map((prompt, i) => (
                <button key={i} className="prompt-btn" onClick={() => sendMessage(prompt)}>{prompt}</button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {hasMessages && (
          <div className="messages-scroll" style={{ background: "rgba(7,26,48,.7)", border: "1px solid rgba(212,175,55,.15)", borderRadius: 14, padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "55vh", overflowY: "auto", marginBottom: ".75rem" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: ".6rem", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
                {msg.role === "user" ? (
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#C2185B", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cinzel',serif", fontWeight: 700, fontSize: ".75rem", color: "#fff", flexShrink: 0 }}>D</div>
                ) : (
                  <img src="/deanna-professional.png" alt="Twin" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1.5px solid #D4AF37", flexShrink: 0 }} />
                )}
                <div style={{ maxWidth: "75%" }}>
                  {/* Attachment chips */}
                  {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 6, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      {msg.attachmentNames.map((name, ni) => (
                        <span key={ni} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(212,175,55,.15)", border: "1px solid rgba(212,175,55,.3)", borderRadius: 6, padding: "2px 8px", fontFamily: "'Montserrat',sans-serif", fontSize: ".6rem", fontWeight: 700, color: "#D4AF37" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          {name.length > 20 ? name.slice(0, 18) + "…" : name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ padding: ".7rem 1rem", borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", background: msg.role === "user" ? "#C2185B" : "rgba(255,255,255,.05)", border: msg.role === "assistant" ? "1px solid rgba(212,175,55,.15)" : "none", color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: ".85rem", lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>
                    {msg.role === "assistant" && msg.content === "" && isStreaming ? (
                      <span style={{ display: "inline-flex", alignItems: "center", padding: ".1rem 0" }}>
                        <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
                      </span>
                    ) : msg.content}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 8, padding: "0 2px" }}>
            {attachments.map((att, i) => (
              <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(7,26,48,.9)", border: "1px solid rgba(212,175,55,.4)", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: ".55rem", fontWeight: 700, color: "#D4AF37", background: "rgba(212,175,55,.15)", borderRadius: 4, padding: "1px 5px", letterSpacing: ".06em" }}>{fileTypeLabel(att.fileType)}</span>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: ".7rem", color: "rgba(255,255,255,.8)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{att.name}</span>
                <span style={{ fontFamily: "'Inter',sans-serif", fontSize: ".6rem", color: "rgba(255,255,255,.35)" }}>{att.displaySize}</span>
                <button onClick={() => removeAttachment(i)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: ".75rem", lineHeight: 1, padding: "0 0 0 2px" }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div style={{ background: "rgba(7,26,48,.85)", border: "1px solid rgba(212,175,55,.25)", borderRadius: 14, padding: ".75rem .75rem .75rem 1.25rem", display: "flex", alignItems: "center", gap: ".6rem" }}>
          <button className="attach-btn" onClick={() => fileInputRef.current?.click()} disabled={isStreaming || isProcessingFile || attachments.length >= 3} title="Attach file (PDF, Word, image, or text)">
            {isProcessingFile ? (
              <span style={{ display: "inline-flex" }}><span className="thinking-dot" style={{ width: 4, height: 4, margin: "0 1px" }} /><span className="thinking-dot" style={{ width: 4, height: 4, margin: "0 1px" }} /><span className="thinking-dot" style={{ width: 4, height: 4, margin: "0 1px" }} /></span>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
          <input type="text" className="chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={attachments.length > 0 ? "Add instructions for your agent..." : "Command your empire..."} disabled={isStreaming} />
          <button className="send-btn" onClick={() => sendMessage()} disabled={!canSend} aria-label="Send">
            {isStreaming ? (
              <span style={{ display: "flex", alignItems: "center" }}>
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
                <span className="thinking-dot" style={{ width: 5, height: 5, margin: "0 1px" }} />
              </span>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5l0 14M12 5l-6 6M12 5l6 6" stroke="#0A2342" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </button>
        </div>

        {/* Attachment hint */}
        <p style={{ fontFamily: "'Montserrat',sans-serif", color: "rgba(255,255,255,.2)", fontSize: ".58rem", textAlign: "center" as const, marginTop: ".5rem", letterSpacing: ".04em" }}>
          Attach PDF · Word · Image · Text — up to 3 files · 15MB each
        </p>

      </div>
    </div>
  );
}
