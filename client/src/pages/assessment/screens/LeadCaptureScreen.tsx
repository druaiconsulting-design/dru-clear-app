/**
 * DRU CLEAR™ AI Readiness Assessment
 * screens/LeadCaptureScreen.tsx
 */

import { useState, useRef } from "react";
import { LeadData, WEBHOOK_LEAD_URL } from "../types";
import { normalizePhone, saveToLocalStorage, sendWebhookJson } from "../utils";
import { verifyEmail } from "../EmailVerification";
import { CountryCode, CountryCodeSelector, detectCountryFromTimezone } from "../CountryCodeSelector";

export function LeadCaptureScreen({ onContinue }: { onContinue: (data: LeadData) => void }) {
  const [form, setForm]                 = useState<LeadData>({ firstName: "", lastName: "", email: "", phone: "", company: "", role: "" });
  const [countryCode, setCountryCode]   = useState<CountryCode>(detectCountryFromTimezone());
  const [submitted, setSubmitted]       = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailError, setEmailError]         = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState("");
  const [emailVerified, setEmailVerified]   = useState(false);
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
    if (
      !form.firstName.trim() || form.firstName.trim().length < 2 ||
      !form.lastName.trim()  || form.lastName.trim().length < 2  ||
      phoneErr || !form.company.trim() || !form.role
    ) {
      setError("Please complete all fields to continue.");
      return;
    }
    setEmailVerifying(true); setEmailError(""); setEmailSuggestion("");
    const result = await verifyEmail(form.email);
    setEmailVerifying(false);
    if (!result.valid) {
      setEmailError(result.error); setEmailSuggestion(result.suggestion || "");
      setEmailVerified(false); setError("Please fix the errors above to continue.");
      return;
    }
    setEmailVerified(true); setError(""); setLoading(true);
    const payload = {
      event_type: "form_submitted", tags: "AI-Assessment-Lead",
      first_name: form.firstName, last_name: form.lastName, email: form.email,
      phone: normalizePhone(countryCode.code + (form.phone || "")),
      company: form.company, role: form.role,
    };
    saveToLocalStorage("form_submitted", payload);
    await sendWebhookJson(payload, WEBHOOK_LEAD_URL);
    setLoading(false);
    onContinue({
      ...form,
      phone:        normalizePhone(countryCode.code + (form.phone || "")),
      country_name: countryCode.name,
      country_iso:  countryCode.iso,
    });
  };

  return (
    <div
      className="screen-enter flex flex-col"
      style={{ minHeight: "100dvh", background: "#0A2342", padding: "2.5rem 1.5rem 2rem", maxWidth: 480, margin: "0 auto", width: "100%" }}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: "#D4AF37" }}>
          Before we begin —
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: "#E6E6E6" }}>
          Enter your details to receive your personalized results and AI readiness insights.
        </p>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {/* Name Row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
              First Name <span style={{ color: "#E53935" }}>*</span>
            </label>
            <input
              className="dru-input" placeholder="First name" value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              style={submitted && (!form.firstName.trim() || form.firstName.trim().length < 2) ? { borderColor: "#E53935" } : {}}
            />
            {submitted && !form.firstName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.firstName.trim() && form.firstName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
              Last Name <span style={{ color: "#E53935" }}>*</span>
            </label>
            <input
              className="dru-input" placeholder="Last name" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              style={submitted && (!form.lastName.trim() || form.lastName.trim().length < 2) ? { borderColor: "#E53935" } : {}}
            />
            {submitted && !form.lastName.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
            {submitted && form.lastName.trim() && form.lastName.trim().length < 2 && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Must be at least 2 characters</p>}
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Email Address <span style={{ color: "#E53935" }}>*</span>
          </label>
          <div style={{ position: "relative" }}>
            <input
              className="dru-input" type="email" placeholder="your@email.com" value={form.email}
              onChange={(e) => handleEmailChange(e.target.value)} onBlur={handleEmailBlur}
              style={{
                ...(emailError   ? { borderColor: "#E53935" } : {}),
                ...(emailVerified ? { borderColor: "#4CAF50" } : {}),
                paddingRight: (emailVerifying || emailVerified) ? "2.5rem" : undefined,
              }}
            />
            {emailVerifying  && !emailVerified && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#D4AF37", fontSize: "0.75rem" }}>Checking…</span>}
            {emailVerified   && !emailVerifying && <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#4CAF50", fontSize: "1rem" }}>✓</span>}
          </div>
          {emailError && (
            <div className="text-xs mt-1" style={{ color: "#E53935" }}>
              {emailError}
              {emailSuggestion && (
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, email: emailSuggestion }); setEmailSuggestion(""); setEmailError(""); }}
                  style={{ marginLeft: "0.5rem", color: "#D4AF37", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                >
                  Use {emailSuggestion}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Phone Number <span style={{ color: "#E53935" }}>*</span>
          </label>
          <div style={{
            display: "flex", gap: "0.5rem", alignItems: "stretch", borderRadius: 4,
            ...((submitted || phoneTouched) && getPhoneError() ? { outline: "1px solid #E53935" } : {}),
          }}>
            <CountryCodeSelector value={countryCode} onChange={setCountryCode} />
            <input
              className="dru-input" type="tel" placeholder="555 000 0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              onBlur={() => setPhoneTouched(true)}
              style={{ flex: 1, minWidth: 0, ...((submitted || phoneTouched) && getPhoneError() ? { borderColor: "#E53935" } : {}) }}
            />
          </div>
          {(submitted || phoneTouched) && getPhoneError()
            ? <p className="text-xs mt-1" style={{ color: "#E53935", fontFamily: "'Inter', sans-serif" }}>{getPhoneError()}</p>
            : <p className="text-xs mt-1" style={{ color: "rgba(230,230,230,0.4)", fontFamily: "'Inter', sans-serif" }}>{countryCode.hint}</p>
          }
        </div>

        {/* Company */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Company Name <span style={{ color: "#E53935" }}>*</span>
          </label>
          <input
            className="dru-input" placeholder="Your organization" value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            style={submitted && !form.company.trim() ? { borderColor: "#E53935" } : {}}
          />
          {submitted && !form.company.trim() && <p className="text-xs mt-1" style={{ color: "#E53935" }}>Required</p>}
        </div>

        {/* Role */}
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: "rgba(230,230,230,0.6)" }}>
            Your Role / Title <span style={{ color: "#E53935" }}>*</span>
          </label>
          <select
            className="dru-input" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={{
              ...(submitted && !form.role ? { borderColor: "#E53935" } : {}),
              background: "#0A2342",
              color: form.role ? "#FFFFFF" : "rgba(230,230,230,0.4)",
              appearance: "auto" as const,
              cursor: "pointer",
            }}
          >
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

      <button className="btn-gold" onClick={handleSubmit} disabled={loading}>
        {loading ? "Saving..." : "Continue →"}
      </button>
    </div>
  );
}
