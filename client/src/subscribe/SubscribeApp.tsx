import { useState } from "react";

// The subscribe form that opens from links in social posts, at subscribe.druaiconsulting.com
// (Nov 26, 2026). It shows only this form on every path of that address. The platform name in the
// link (?from=instagram, ?from=facebook, ?from=linkedin) goes to the signup and becomes a
// "from-<platform>" tag on the person's GHL record. A person with a member profile is subscribed
// right away; a non-member is asked for a phone number after the first press of Subscribe.

function cleanSource(raw: string | null): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30);
}

const GOLD = "#D4AF37";
const NAVY = "#0A2342";
const MAGENTA = "#C2185B";

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  borderRadius: 6,
  border: "1px solid rgba(10,35,66,0.18)",
  background: "#ffffff",
  color: NAVY,
  outline: "none",
};

export default function SubscribeApp() {
  const source = cleanSource(new URLSearchParams(window.location.search).get("from"));
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [needPhone, setNeedPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/jaylen-nonmember-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          first_name: first.trim(),
          last_name: last.trim(),
          phone: phone.trim(),
          source,
        }),
      });
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      if (data?.needPhone) {
        setNeedPhone(true);
        setMsg(phone.trim() ? "Enter a valid phone number." : "");
        return;
      }
      setDone(true);
    } catch {
      setMsg("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF8", color: NAVY, fontFamily: "'Inter', sans-serif" }}>
      <div
        style={{
          background: "rgba(27,77,142,0.97)",
          borderBottom: "1px solid rgba(212,175,55,0.22)",
          height: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.5rem", fontWeight: 700, color: GOLD, letterSpacing: "0.02em" }}>
          DRU AI Consulting
        </span>
      </div>
      <div style={{ maxWidth: 460, margin: "0 auto", padding: "44px 24px 56px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", color: GOLD, fontSize: "1.9rem", lineHeight: 1.25, fontWeight: 700, margin: "0 0 12px" }}>
          LEAD, CLARITY, WIN! Newsletter
        </h1>
        <div style={{ width: 48, height: 2, background: GOLD, margin: "0 auto 28px" }} />
        {done ? (
          <div style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: GOLD, marginBottom: 8 }}>
              You Are Subscribed!
            </div>
            <div>Thank you, Enjoy!</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <input style={inputStyle} type="text" placeholder="* First Name" autoComplete="given-name" required value={first} onChange={(e) => setFirst(e.target.value)} />
              <input style={inputStyle} type="text" placeholder="* Last Name" autoComplete="family-name" required value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
            <input style={inputStyle} type="email" placeholder="* Email Address" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            {needPhone && (
              <input style={inputStyle} type="tel" placeholder="* Phone Number" autoComplete="tel" required autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} />
            )}
            <button
              type="submit"
              disabled={busy}
              style={{
                marginTop: 4,
                padding: "15px 28px",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: MAGENTA,
                color: "#ffffff",
                border: 0,
                borderRadius: 6,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
            >
              Subscribe Now!
            </button>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.65)", textAlign: "center" }}>* Required</div>
            <div role="status" style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.75rem", color: "rgba(10,35,66,0.65)", textAlign: "center", minHeight: 18 }}>{msg}</div>
          </form>
        )}
      </div>
    </div>
  );
}
