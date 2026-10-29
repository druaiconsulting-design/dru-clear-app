import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import FIELDS from "../data/edReportFields.json";
import EdReportArt from "../components/EdReportArt";
import { FitField, css, longDate, money, TIER_BANDS, TIER_MESSAGES, TIER_SUB } from "./AdminReport";
import type { Field, ReportData } from "./AdminReport";

// Review page for one client's Executive AI Alignment Report (21 pages).
// Only Imani's spots are editable. Calculator figures, the Gap names, fixed wording and the client's
// own responses are shown locked. Each edit is saved as it is typed, beside Imani's original wording.

export const ED_PAGE_COUNT = 21;
// The third Execution tile reads "Last three attempts stopped at" with the client's stage, as on the Strategic report,
// so its label and answer get room for two lines.
const GEOMETRY: Record<string, Partial<Field>> = {
  pl3_s3a: { x: 77.098, w: 12.1569, y: 27.3, h: 2.8, s: 1.15, ml: true },
  record_188: { y: 16.5 },
  record_189: { y: 16.5 },
  record_190: { y: 16.8 },
  pl3_s3b: { x: 77.098, w: 12.1569, y: 30.3, h: 2.4242, s: 1.3, ml: true },
};
export const ED_FIELDS = (FIELDS as unknown as Field[]).map(f => (GEOMETRY[f.n] ? { ...f, ...GEOMETRY[f.n] } : f));

// Headings over the three boxes at the top of page 5, as on page 4 of the Strategic report.
export const ED_BOX_HEADS: { p: number; x: number; y: number; w: number; text: string; dark?: boolean }[] = [
  { p: 5, x: 11.04, y: 14.45, w: 15, text: "Score 0-100", dark: true },
  { p: 5, x: 26.92, y: 14.45, w: 40, text: "Tier, sub-name and band", dark: true },
  { p: 5, x: 72.4, y: 14.45, w: 20, text: "Lowest pillars", dark: true },
];
const PILLAR_ROWS = ["Clarity", "Leadership", "Execution", "Alignment", "Results"];

// Page 5 rows (score, label) in page order, then one score and label per pillar page, then the gap names on pages 7 and 21
const PAGE5_ROWS: Record<string, [string, string]> = {
  Clarity: ["record_178", "calc_179"], Leadership: ["record_180", "calc_181"], Execution: ["record_182", "calc_183"],
  Alignment: ["record_184", "calc_185"], Results: ["record_186", "calc_187"],
};
const PILLAR_PAGE: Record<string, [string, string]> = {
  Clarity: ["pl1_score", "pl1_status"], Leadership: ["pl2_score", "pl2_status"], Execution: ["pl3_score", "pl3_status"],
  Alignment: ["pl4_score", "pl4_status"], Results: ["pl5_score", "pl5_status"],
};
const GAP_CELLS_P7 = ["agent_194", "agent_197", "agent_200", "agent_203", "agent_206"];
const GAP_CELLS_P21 = ["calc_375", "calc_376", "calc_377", "calc_378", "calc_379"];

// Figures and names that come from the calculator and the client's own answers. Locked on this page.
export function edLockedValues(r: ReportData): Record<string, string> {
  const v: Record<string, string> = {};
  const n = r.numbers ?? {};
  v["record_168"] = [r.first_name, r.last_name].filter(Boolean).join(" ");
  v["calc_169"] = longDate(n.report_date);
  if (n.scaled_percent != null) v["record_188"] = String(n.scaled_percent);

  for (const p of PILLAR_ROWS) {
    const row = n.pillars?.[p];
    if (!row) continue;
    v[PAGE5_ROWS[p][0]] = String(row.score); v[PAGE5_ROWS[p][1]] = String(row.label);
    v[PILLAR_PAGE[p][0]] = String(row.score); v[PILLAR_PAGE[p][1]] = String(row.label);
  }
  (n.ranked_gaps ?? []).forEach((g: any) => {
    const i = Number(g.rank) - 1;
    if (i >= 0 && i < 5) { v[GAP_CELLS_P7[i]] = g.pillar; v[GAP_CELLS_P21[i]] = g.pillar; }
  });

  if (n.clarity) {
    v["pl1_q1v"] = `${money(n.clarity.dollars)} in ${n.clarity.weeks} weeks`;
    v["pl1_q4v"] = `${money(n.clarity.dollars_x4)} in ${n.clarity.weeks_x4} weeks`;
  }
  if (n.leadership) {
    v["pl2_n1"] = String(n.leadership.postponed_decisions);
    v["pl2_n2"] = String(n.leadership.delayed_initiatives);
    v["pl2_n3"] = String(n.leadership.missed_cycles);
    v["pl2_ldr"] = `${n.leadership.leaders_who_can} of ${n.leadership.leaders_total}`;
    v["pl2_c4"] = `x 4 quarters of the year: ${n.leadership.postponed_decisions_x4} · ${n.leadership.delayed_initiatives_x4} · ${n.leadership.missed_cycles_x4}`;
  }
  if (n.execution) {
    v["pl3_cqv"] = money(n.execution.dollars);
    v["pl3_c4v"] = money(n.execution.dollars_x4);
    if (n.execution.regions_reached != null) {
      v["pl3_s1b"] = `${n.execution.regions_reached} ${Number(n.execution.regions_reached) === 1 ? "region" : "regions"}`;
    }
  }
  if (n.results) v["pl5_tot"] = money(n.results.total_value);

  // Tier line, lowest pillars and the next-achievement sentence
  const badge: string = n.badge ?? "";
  if (TIER_BANDS[badge]) v["record_189"] = `${badge.charAt(0) + badge.slice(1).toLowerCase()} · ${TIER_SUB[badge]} · ${TIER_BANDS[badge]}`;
  if (TIER_MESSAGES[badge]) v["record_192"] = TIER_MESSAGES[badge];
  const gaps = (n.ranked_gaps ?? []) as { pillar: string; score?: number }[];
  const lowest = PILLAR_ROWS.filter(p => n.pillars?.[p] && Number(n.pillars[p].score) === Math.min(...PILLAR_ROWS.filter(q => n.pillars?.[q]).map(q => Number(n.pillars[q].score))));
  if (lowest.length) v["record_190"] = gaps.length ? gaps.filter(g => lowest.includes(g.pillar)).map(g => g.pillar).join(" · ") || lowest.join(" · ") : lowest.join(" · ");
  if (badge && badge !== "LEADING" && n.next_badge?.badge) {
    v["calc_193"] = `Your results place your organization at ${badge} with ${n.scaled_percent}%. The next achievement is ${n.next_badge.badge}.`;
  }

  // The client's own typed words
  const pilot = (r.client_texts ?? []).find(t => t.field === "execution_pilot_name")?.value ?? "";
  if (pilot) v["pl3_pil"] = pilot;
  const ans = (fw: string, pillar: string, order: number) =>
    (r.client_answers ?? []).find(a => a.framework === fw && a.pillar === pillar && a.order === order)?.answer ?? "";
  const objective = ans("CLEAR", "Alignment", 1);
  if (objective) v["pl4_obj"] = objective;
  const obstacle = ans("CLEAR", "Execution", 1);
  if (obstacle) v["pl3_s2o"] = obstacle;
  // The third tile shows where the last three attempts stopped (Execution Q3), as the Strategic report does
  const stage = ans("CLEAR", "Execution", 3);
  if (stage) { v["pl3_s3a"] = "Last three attempts stopped at"; v["pl3_s3b"] = stage; }
  return v;
}

// Fields whose place on the page is drawn from the client's numbers by EdReportArt.
export const ED_DRAWN_BY_ART = new Set<string>([
  "record_297", "record_298", "record_299", "record_300", "record_301",
  "pl4_d1", "pl4_h1", "pl4_d2", "pl4_h2", "pl4_d3", "pl4_h3", "pl4_d4", "pl4_h4", "pl4_totl", "pl4_tot",
  "pl5_i1", "pl5_i2", "pl5_i3", "pl5_v1", "pl5_v2", "pl5_v3",
]);

// The wording of a field on the page: Imani's spots, locked figures and fixed wording show their content; every other slot stays empty.
export function edFieldValue(f: Field, isImani: boolean, imaniText: string, locked: Record<string, string>): string | null {
  const isLocked = f.n in locked;
  if (!f.fx && !isImani && !isLocked) return null;
  let value = isImani ? imaniText : isLocked ? locked[f.n] : f.d;
  if (f.n === "pl3_costh" && locked["pl3_pil"]) value = value.replace("[PILOT NAME]", locked["pl3_pil"].toUpperCase());
  return value;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function AdminEdReport() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastSaved = useRef<Record<string, string>>({});
  const inFlight = useRef(0);
  const chains = useRef<Record<string, Promise<unknown>>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&family=Lora:ital,wght@0,700;1,400&family=Montserrat:wght@700&display=swap";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  useEffect(() => {
    (async () => {
      if (!token) { setLoadError("No report was chosen."); setLoading(false); return; }
      const { data, error } = await supabase.rpc("admin_sd_report", { p_token: token });
      if (error) setLoadError(error.message);
      else if (!data) setLoadError("This report was not found.");
      else {
        const rd = data as ReportData;
        setReport(rd);
        lastSaved.current = { ...rd.edits };
      }
      setLoading(false);
    })();
  }, [token]);

  const locked = useMemo(() => (report ? edLockedValues(report) : {}), [report]);
  const editableKeys = useMemo(() => {
    const s = new Set<string>();
    if (!report) return s;
    const leading = report.numbers?.badge === "LEADING";
    report.spots.forEach(sp => { if (sp.writer === "imani" && (!sp.leading_only || leading)) s.add(sp.spot_key); });
    return s;
  }, [report]);
  const canEdit = !!report && report.status === "insight_written" && !busy;
  const isSent = !!report && (report.status === "sent" || !!report.sent_at);
  // Approve is on while the report is waiting for review, or approved but not yet sent (a retry).
  const canApprove = !!report && !isSent && !busy && ["insight_written", "approved", "report_built"].includes(report.status);
  const isRetry = !!report && report.status !== "insight_written";

  const originalFor = (key: string) => report?.insight?.entries?.[key]?.text ?? "";
  const valueFor = (key: string) => (key in drafts ? drafts[key] : (report?.edits?.[key] ?? originalFor(key)));

  const flush = (key: string, value: string) => {
    clearTimeout(timers.current[key]); delete timers.current[key];
    if (value === (lastSaved.current[key] ?? originalFor(key))) {
      if (!inFlight.current && !Object.keys(timers.current).length) setSaveState("saved");
      return;
    }
    inFlight.current++;
    setSaveState("saving");
    const prev = chains.current[key] ?? Promise.resolve();
    chains.current[key] = prev
      .then(() => supabase.rpc("admin_save_report_edit", { p_token: token, p_spot: key, p_text: value }))
      .then(({ error }) => {
        if (error) throw new Error(error.message);
        lastSaved.current[key] = value;
        setSaveError(null);
      })
      .catch((e: Error) => { setSaveState("error"); setSaveError(e.message); })
      .finally(() => {
        inFlight.current--;
        setSaveState(s => (s === "error" ? s : (!inFlight.current && !Object.keys(timers.current).length ? "saved" : s)));
      });
  };

  const onEdit = (key: string, value: string) => {
    setDrafts(d => ({ ...d, [key]: value }));
    setSaveState("saving");
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => flush(key, value), 700);
  };

  // Save anything still waiting if the page is closed.
  useEffect(() => {
    const h = () => { Object.keys(timers.current).forEach(k => flush(k, drafts[k])); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  });

  const clientEmail = report?.send_to ?? report?.email ?? "";

  // Saves any wording still waiting, locks the report, builds the PDF and sends the email (all on the server).
  const sendReport = async () => {
    setConfirming(false);
    setSendError(null);
    setBusy(true);
    try {
      Object.keys(timers.current).forEach(k => flush(k, drafts[k] ?? valueFor(k)));
      await Promise.all(Object.values(chains.current));
      if (saveState === "error") throw new Error("Your last edit did not save. Fix that first, then send.");
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) throw new Error("You are signed out. Sign in again, then send.");
      const resp = await fetch("/api/sd-report-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ token }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body?.error || `The send failed (${resp.status}).`);
    } catch (e) {
      setSendError((e as Error).message);
    }
    // Show the report as the database now holds it: sent, or approved and waiting for a retry.
    const { data } = await supabase.rpc("admin_sd_report", { p_token: token });
    if (data) setReport(data as ReportData);
    setBusy(false);
  };

  const viewPdf = async () => {
    const w = window.open("", "_blank");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const r = await fetch(`/api/sd-report-pdf?token=${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` } });
      const b = await r.json();
      if (!r.ok || !b.url) throw new Error(b.error || "The PDF could not be opened.");
      if (w) w.location.href = b.url; else window.location.href = b.url;
    } catch (e) {
      if (w) w.close();
      setSendError((e as Error).message);
    }
  };

  const byPage = useMemo(() => {
    const m: Record<number, Field[]> = {};
    ED_FIELDS.forEach(f => { (m[f.p] = m[f.p] || []).push(f); });
    return m;
  }, []);

  const clientName = report ? [report.first_name, report.last_name].filter(Boolean).join(" ") : "";
  const editedCount = report ? Object.keys({ ...report.edits, ...drafts }).filter(k => valueFor(k) !== originalFor(k)).length : 0;

  if (loading) return <div style={shell}><p style={{ color: "#FAFAF8", padding: 24 }}>Loading the report…</p></div>;
  if (loadError || !report) return (
    <div style={shell}><div style={{ padding: 24, color: "#FAFAF8" }}>
      <p>{loadError ?? "This report could not be opened."}</p>
      <a href="/admin-approvals" style={{ color: "#D4AF37" }}>Back to approvals</a>
    </div></div>
  );

  const statusText = busy ? "Building the PDF and sending" : isSent ? "Sent" : saveState === "saving" ? "Saving" : saveState === "error" ? "Not saved" : saveState === "saved" ? "Saved" : canEdit ? "Edits save as you type" : report.status === "approved" || report.status === "report_built" ? "Approved, not sent" : "Locked";
  const shownError = sendError ?? (!isSent ? report.send_error ?? null : null);

  return (
    <div style={shell}>
      <style>{css}</style>
      <header className="bar">
        <div className="ttl">
          <b>Executive AI Alignment Report · {clientName || report.email}</b>
          <span>
            {report.status === "sent" || report.sent_at
              ? `Sent to client${report.sent_at ? " on " + new Date(report.sent_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}`
              : canEdit
                ? "Only the pink spots are Imani's wording and can be edited. Figures and the client's responses are locked."
                : "This report is locked."}
            {editedCount > 0 ? ` · ${editedCount} edited` : ""}
          </span>
        </div>
        <span className="status" data-state={saveState}>{statusText}</span>
        {report.has_pdf && <button className="viewpdf" type="button" onClick={viewPdf}>View PDF</button>}
        <button className="approve" type="button" disabled={!canApprove || (!isRetry && (saveState === "saving" || saveState === "error"))}
          onClick={() => setConfirming(true)}
          title={isSent ? "This report has been sent" : canApprove ? "" : "Not available"}>
          {isSent ? "Sent" : busy ? "Sending…" : isRetry ? "Retry send" : "Approve"}
        </button>
        <a className="back" href="/admin-approvals">Back to approvals</a>
        {saveError && <div className="err">Could not save: {saveError}</div>}
        {shownError && <div className="err">Not sent. {shownError} The report is still unsent. Use Retry send to try again.</div>}
        <nav className="nav">
          {Array.from({ length: ED_PAGE_COUNT }, (_, i) => i + 1).map(p => (
            <button key={p} type="button" aria-label={`Go to page ${p}`}
              onClick={() => document.getElementById("rp" + p)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{p}</button>
          ))}
        </nav>
      </header>
      <main>
        {Array.from({ length: ED_PAGE_COUNT }, (_, i) => i + 1).map(p => (
          <section key={p} id={"rp" + p} className="pg" aria-label={"Page " + p}
            style={{ backgroundImage: `url("/ed-report-pages/p-${String(p).padStart(2, "0")}.png")` }}>
            {p > 1 && <div className="hdrname">{clientName}</div>}
            <EdReportArt page={p} report={report} />
            {ED_BOX_HEADS.filter(h => h.p === p).map(h => (
              <div key={h.text} className={"boxhead" + (h.dark ? " dk" : "")} style={{ left: h.x + "%", top: h.y + "%", width: h.w + "%" }}>{h.text}</div>
            ))}
            {(byPage[p] ?? []).map(f => {
              if (ED_DRAWN_BY_ART.has(f.n)) return null;
              const isImani = editableKeys.has(f.n);
              const value = edFieldValue(f, isImani, isImani ? valueFor(f.n) : "", locked);
              if (value === null) return null;
              const isLockedCell = f.n in locked;
              return (
                <FitField key={f.n} f={f} value={value} p={p}
                  editable={isImani && canEdit} imani={isImani} fitText={isImani || isLockedCell}
                  onChange={v => onEdit(f.n, v)} onBlur={() => flush(f.n, valueFor(f.n))} />
              );
            })}
          </section>
        ))}
      </main>
      {confirming && (
        <div className="veil" role="dialog" aria-modal="true" aria-label="Send this report">
          <div className="dlg">
            <p className="dq">Send this report to {clientName || "this client"} at {clientEmail}?</p>
            <p className="dn">Once you confirm, the report locks and cannot be edited.</p>
            <div className="dbtn">
              <button type="button" className="no" onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className="yes" onClick={sendReport}>Send report</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const shell: CSSProperties = { minHeight: "100vh", background: "#E7E4DC", fontFamily: '"Poppins","Segoe UI",system-ui,sans-serif' };

