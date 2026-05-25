import { useState, useEffect, useRef } from "react";
import { COUNTRY_CODES, detectCountryFromTimezone } from "../countryData";
import type { CountryCode } from "../countryData";
import { verifyEmail } from "../emailVerification";
import { normalizePhone, saveToLocalStorage, sendWebhookJson } from "../utils";
import { WEBHOOK_LEAD_URL } from "../config";
import type { LeadData } from "../types";

// ── CountryCodeSelector ───────────────────────────────────────────────────────

function CountryCodeSelector({ value, onChange }: { value: CountryCode; onChange: (c: CountryCode) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = search.trim()
    ? COUNTRY_CODES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search))
    : COUNTRY_CODES;
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);
  useEffect(() => { if (open) setTimeout(() => searchRef.current?.focus(), 50); }, [open]);
  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button type="button" onClick={() => { setOpen((o) => !o); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: "0.35rem", height: "100%", padding: "0 0.65rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 4, color: "#FFFFFF", cursor: "pointer", fontSize: "0.85rem", whiteSpace: "nowrap", transition: "border-color 0.2s", minWidth: 72 }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#D4AF37"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,55,0.3)"; }}>
        <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{value.flag}</span>
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: "0.8rem" }}>{value.code}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.5, marginLeft: 2 }}><path d="M2 3.5L5 6.5L8 3.5" stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 9999, background: "#0d2d52", border: "1px solid rgba(212,175,55,0.3)", borderRadius: 6, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", width: 240, maxHeight: 280, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "0.5rem 0.6rem", borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
            <input ref={searchRef} type="text" placeholder="Search country or code…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 4, padding: "0.35rem 0.6rem", color: "#FFFFFF", fontSize: "0.78rem", fontFamily: "'Inter', sans-serif", outline: "none" }} />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0
              ? <p style={{ padding: "0.75rem", color: "rgba(230,230,230,0.4)", fontSize: "0.75rem", textAlign: "center" }}>No results</p>
              : filtered.map((c) => (
                <button key={c.iso} type="button" onClick={() => { onChange(c); setOpen(false); setSearch(""); }} style={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%", padding: "0.45rem 0.75rem", background: value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent", border: "none", cursor: "pointer", textAlign: "left", transition: "background 0.15s" }} onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,55,0.1)"; }} onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = value.iso === c.iso ? "rgba(212,175,55,0.12)" : "transparent"; }}>
                  <span style={{ fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>{c.flag}</span>
                  <span style={{ color: "#D4AF37", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "0.75rem", flexShrink: 0, minWidth: 36 }}>{c.code}</span>
                  <span style={{ color: "rgba(230,230,230,0.8)", fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LeadCapture ───────────────────────────────────────────────────────────────

export default function LeadCapture({ onContinue }: { onContinue: (data: LeadData) => void }) {
  const [form, setForm] = useState<LeadData>({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
  const [countryCode, setCountryCode] = useState<CountryCode>(detectCountryFromTimezone());
  const [submitted, setSubmitted] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const emailVerifyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmailBlur = async () => {
    if (!form.email) return;
    setEmailVerifying(true); setEmailError(""); setEmailSuggestion(""); setEmailVerified(false);
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (result.valid) { setEmailVerified(true); setEmailError(""); }
    else { setEmailError(result.error); setEmailSuggestion(result.suggestion || ""); setEmailVerified(false); }
  };

  const handleEmailChange = (val: string) => {
    setForm({ ...form, email: val }); setEmailVerified(false); setEmailError(""); setEmailSuggestion("");
    if (emailVerifyTimeout.current) clearTimeout(emailVerifyTimeout.current);
  };

  const getPhoneError = (): string => {
    const digits = form.phone.replace(/\D/g, "");
    if (!digits) return "Required";
    if (digits.length < countryCode.minLen) return `A valid ${countryCode.name} number requires at least ${countryCode.minLen} digits`;
    if (digits.length > countryCode.maxLen) return `A valid ${countryCode.name} number has at most ${countryCode.maxLen} digits`;
    return "";
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const phoneErr = getPhoneError();
    if (!form.firstName.trim() || form.firstName.trim().length < 2 || !form.lastName.trim() || form.lastName.trim().length < 2 || phoneErr || !form.company.trim() || !form.role) {
      setError("Please complete all fields to continue."); return;
    }
    setEmailVerifying(true); setEmailError(""); setEmailSuggestion("");
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (!result.valid) { setEmailError(result.error); setEmailSuggestion(result.suggestion || ""); setEmailVerified(false); setError("Please fix the errors above to continue."); return; }
    setEmailVerified(true); setError(""); setLoading(true);
    const payload = { event_type: "form_submitted", tags: "AI-Assessment-Lead", first_name: form.firstName, last_name: form.lastName, email: form.email, phone: normalizePhone(countryCode.code + (form.phone || "")), company: form.company, role: form.role };
    saveToLocalStorage("form_submitted", payload);
    await sendWebhookJson(payload, WEBHOOK_LEAD_URL);
    setLoading(false);
    onContinue({ ...form, phone: normalizePhone(countryCode.code + (form.phone || "")), country_name: countryCode.name, country_iso: countryCode.iso });
  };

  return (
    <div className="screen-enter flex flex-col" style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>Before we begin —</h2>
        <p className="text-sm leading-relaxed" style={{ color: "#E6E6E6" }}>Enter your details to receive your personalized results and AI readiness insights.</p>
      </div>
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>First Name <span style={{ color: "#E53935" }}>*</span></label>
            <input className="dru-input" placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={submitted && (!form.firstName.trim() || form.firstName.trim().length < 2) ? { borderColor: "#E53935" } : {}} />
            {submitted && !form.firstName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.firstName.trim() && form.firstName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Last Name <span style={{ color: "#E53935" }}>*</span></label>
            <input className="dru-input" placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} style={submitted && (!form.lastName.trim() || form.lastName.trim().length < 2) ? { borderColor: "#E53935" } : {}} />
            {submitted && !form.lastName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.lastName.trim() && form.lastName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Email Address <span style={{ color: "#E53935" }}>*</span></label>
          <div style={{ position: "relative" }}>
            <input className="dru-input" type="email" placeholder="your@email.com" value={form.email} onChange={(e) => handleEmailChange(e.target.value)} onBlur={handleEmailBlur} style={{ ...(emailError ? { borderColor: "#E53935" } : {}), ...(emailVerified ? { borderColor: "#4CAF50" } : {}), paddingRight: (emailVerifying || emailVerified) ? "2.5rem" : undefined }} />
            {emailVerifying && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#D4AF37", fontSize: "0.75rem" }}>Checking…</span>}
            {emailVerified && !emailVerifying && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: "1rem" }}>✓</span>}
          </div>
          {emailError && (
            <div className="text-xs mt-1" style={{ color: "#E53935" }}>
              {emailError}
              {emailSuggestion && (
                <button type="button" onClick={() => { setForm({ ...form, email: emailSuggestion }); setEmailSuggestion(""); setEmailError(""); }} style={{ marginLeft: "0.5rem", color: "#D4AF37", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}>
                  Use {emailSuggestion}
                </button>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Phone Number <span style={{ color: "#E53935" }}>*</span></label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", borderRadius: 4, ...((submitted || phoneTouched) && getPhoneError() ? { outline: "1px solid #E53935" } : {}) }}>
            <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
            <input className="dru-input" type="tel" placeholder="555 000 0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => setPhoneTouched(true)} style={{ flex: 1, minWidth: 0, ...((submitted || phoneTouched) && getPhoneError() ? { borderColor: "#E53935" } : {}) }} />
          </div>
          {(submitted || phoneTouched) && getPhoneError()
            ? <p className="text-xs mt-1" style={{ color: "#E53935", fontFamily: "'Inter', sans-serif" }}>{getPhoneError()}</p>
            : <p className="text-xs mt-1" style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif" }}>{countryCode.hint}</p>}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Company Name <span style={{ color: "#E53935" }}>*</span></label>
          <input className="dru-input" placeholder="Your organization" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={submitted && !form.company.trim() ? { borderColor: "#E53935" } : {}} />
          {submitted && !form.company.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
        </div>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>Your Role / Title <span style={{ color: "#E53935" }}>*</span></label>
          <select className="dru-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ ...(submitted && !form.role ? { borderColor: "#E53935" } : {}), background: "#0A2342", color: form.role ? "#FFFFFF" : "rgba(230,230,230,0.4)", appearance: "auto" as const, cursor: "pointer" }}>
            <option value="" disabled>Select your role...</option>
            <option value="C-Suite Executive">C-Suite Executive</option>
            <option value="VP / Senior Director">VP / Senior Director</option>
            <option value="Director">Director</option>
            <option value="Team Leader">Team Leader</option>
            <option value="Consultant / Advisor">Consultant / Advisor</option>
            <option value="Other">Other</option>
          </select>
          {submitted && !form.role && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
        </div>
      </div>
      {error && <p className="text-sm mb-4" style={{ color: "#E53935" }}>{error}</p>}
      <button className="btn-gold" onClick={handleSubmit} disabled={loading}>{loading ? "Saving..." : "Continue →"}</button>
    </div>
  );
}
