import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "../lib/supabase";
import FIELDS from "../data/sdReportFields.json";
import SdReportArt, { ROW6_H, ROW6_TOP } from "../components/SdReportArt";

// Review page for one client's Strategic AI Insight Report.
// Only Imani's spots are editable. Calculator figures, the Gap names, fixed wording and the client's
// own responses are shown locked. Each edit is saved as it is typed, beside Imani's original wording.

export type Field = {
  n: string; p: number; x: number; y: number; w: number; h: number; s: number; ctr?: boolean;
  c: string; f: string; wt: number; it: boolean; ml: boolean; d: string;
};
type Spot = { spot_key: string; page: number; label: string; writer: string; leading_only: boolean };
export type ReportData = {
  access_token: string; status: string; email: string; tier: string; sent_at: string | null;
  approved_at?: string | null; send_error?: string | null; send_attempts?: number; has_pdf?: boolean;
  numbers: any; insight: any; first_name: string | null; last_name: string | null; company: string | null;
  edits: Record<string, string>; spots: Spot[];
  client_texts: { field: string; item: number; value: string }[];
  client_answers: { framework: string; pillar: string; order: number; answer: string }[];
};

export const PAGE_COUNT = 16;
export const ALL_FIELDS = FIELDS as unknown as Field[];
const PILLAR_ROWS = ["Clarity", "Leadership", "Execution", "Alignment", "Results"];
// page 4 rows (score, label) in page order, then one score/label pair per pillar page
const PAGE4_ROWS: Record<string, [string, string]> = {
  Clarity: ["record_003", "calc_004"], Leadership: ["record_005", "calc_006"], Execution: ["record_007", "calc_008"],
  Alignment: ["record_009", "calc_010"], Results: ["record_011", "calc_012"],
};
const PILLAR_PAGE: Record<string, [string, string]> = {
  Clarity: ["record_036", "calc_037"], Leadership: ["record_051", "calc_052"], Execution: ["record_069", "calc_070"],
  Alignment: ["record_088", "calc_089"], Results: ["record_108", "calc_109"],
};
const GAP_CELLS = ["agent_019", "agent_022", "agent_025", "agent_028", "agent_031"];
const GAP_CELLS_P16 = ["calc_163", "calc_164", "calc_165", "calc_166", "calc_167"];

// Score bands are the free assessment's own (scaled percent): up to 40, 41 to 60, 61 to 80, 81 to 100.
const TIER_BANDS: Record<string, string> = {
  EMERGING: "0 to 40", DEVELOPING: "41 to 60", ADVANCING: "61 to 80", LEADING: "81 to 100",
};
// The fixed achievement message for each tier: the wording the free assessment already carries for that tier.
const TIER_MESSAGES: Record<string, string> = {
  EMERGING: "Your organization is in the early stages of AI readiness. Without a structured approach, you risk wasting resources on disconnected initiatives. The DRU CLEAR\u2122 Alignment Diagnostic will pinpoint exactly where to start for maximum impact.",
  DEVELOPING: "You've begun the AI conversation, but critical gaps in Clarity and Alignment are slowing your momentum. A full diagnostic will reveal the specific friction points and give you a clear path forward.",
  ADVANCING: "Your organization is making meaningful progress. However, one or two CLEAR pillars are underperforming and limiting your full potential. A diagnostic will identify exactly what's holding you back.",
  LEADING: "You're operating ahead of most organizations in AI readiness. The question now is sustainability and scale. An AI Leadership Advisory engagement will help you maintain your competitive edge and dominate your industry.",
};
const money = (n: number) => "$" + Number(n).toLocaleString("en-US");

function longDate(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

// Figures and names that come from the calculator and the client's own answers. Locked on this page.
export function lockedValues(r: ReportData): Record<string, string> {
  const v: Record<string, string> = {};
  const n = r.numbers ?? {};
  v["record_001"] = [r.first_name, r.last_name].filter(Boolean).join(" ");
  v["calc_002"] = longDate(n.report_date);
  if (n.scaled_percent != null) v["record_013"] = String(n.scaled_percent);

  for (const p of PILLAR_ROWS) {
    const row = n.pillars?.[p];
    if (!row) continue;
    v[PAGE4_ROWS[p][0]] = `Score ${row.score}`; v[PAGE4_ROWS[p][1]] = String(row.label);
    v[PILLAR_PAGE[p][0]] = String(row.score); v[PILLAR_PAGE[p][1]] = String(row.label);
  }
  (n.ranked_gaps ?? []).forEach((g: any) => {
    const i = Number(g.rank) - 1;
    if (i >= 0 && i < 5) { v[GAP_CELLS[i]] = g.pillar; v[GAP_CELLS_P16[i]] = g.pillar; }
  });

  if (n.clarity) {
    v["answer_042"] = `${money(n.clarity.dollars)} and ${n.clarity.weeks} weeks`;
    v["calc_043"] = `${money(n.clarity.dollars_x4)} and ${n.clarity.weeks_x4} weeks`;
  }
  if (n.leadership) {
    v["answer_057"] = String(n.leadership.postponed_decisions);
    v["answer_058"] = String(n.leadership.delayed_initiatives);
    v["answer_059"] = String(n.leadership.missed_cycles);
    v["answer_060"] = `${n.leadership.leaders_who_can} of ${n.leadership.leaders_total}`;
  }
  if (n.execution) {
    v["answer_078"] = money(n.execution.dollars);
    v["calc_079"] = money(n.execution.dollars_x4);
  }
  if (n.alignment) {
    (n.alignment.departments ?? []).slice(0, 4).forEach((d: any, i: number) => {
      v[`align_dept${i + 1}_name`] = String(d.department);
      v[`align_dept${i + 1}_hours`] = String(d.hours);
    });
    v["align_dept_total"] = String(n.alignment.total_hours);
  }
  if (n.results) {
    const cells = ["answer_115", "answer_117", "answer_119"];
    (n.results.initiatives ?? []).slice(0, 3).forEach((it: any, i: number) => { v[cells[i]] = money(it.value); });
    v["calc_120"] = money(n.results.total_value);
  }
  // Tier line, lowest pillars and the next-achievement sentence
  const badge: string = n.badge ?? "";
  if (TIER_BANDS[badge]) v["record_014"] = `${badge.charAt(0) + badge.slice(1).toLowerCase()} · ${TIER_SUB[badge]} · ${TIER_BANDS[badge]}`;
  if (TIER_MESSAGES[badge]) v["record_017"] = TIER_MESSAGES[badge];
  const gaps = (n.ranked_gaps ?? []) as { pillar: string; score?: number }[];
  const lowest = PILLAR_ROWS.filter(p => n.pillars?.[p] && Number(n.pillars[p].score) === Math.min(...PILLAR_ROWS.filter(q => n.pillars?.[q]).map(q => Number(n.pillars[q].score))));
  if (lowest.length) v["record_015"] = gaps.length ? gaps.filter(g => lowest.includes(g.pillar)).map(g => g.pillar).join(" · ") || lowest.join(" · ") : lowest.join(" · ");
  if (badge && badge !== "LEADING" && n.next_badge?.badge) {
    v["calc_018"] = `Your results place your organization at ${badge} with ${n.scaled_percent}%. The next achievement is ${n.next_badge.badge}.`;
  }
  if (n.leadership) {
    v["calc_061"] = `x 4 quarters of the year: ${n.leadership.postponed_decisions_x4} · ${n.leadership.delayed_initiatives_x4} · ${n.leadership.missed_cycles_x4}`;
  }
  // Execution tiles: the number of regions reached and the stage where the last three attempts stopped
  if (n.execution?.regions_reached != null) {
    v["sd_0093_L1"] = String(n.execution.regions_reached);
    v["sd_0093_L2"] = Number(n.execution.regions_reached) === 1 ? "region" : "regions";
  }
  // The client's own typed words
  const pilot = (r.client_texts ?? []).find(t => t.field === "execution_pilot_name")?.value ?? "";
  if (pilot) v["answer_080"] = pilot;
  const ans = (fw: string, pillar: string, order: number) =>
    (r.client_answers ?? []).find(a => a.framework === fw && a.pillar === pillar && a.order === order)?.answer ?? "";
  const objective = ans("CLEAR", "Alignment", 1);
  if (objective) v["answer_099"] = objective;
  const obstacle = ans("CLEAR", "Execution", 1);
  if (obstacle) v["answer_075"] = obstacle;
  const stage = ans("CLEAR", "Execution", 3);
  if (stage) { v["sd_0095_L1"] = "Last three attempts stopped at"; v["answer_076"] = stage; }
  return v;
}


// The word printed under each badge picture
// Tile words that show only when the pre-session feeds them
export const TILE_WORDS = new Set<string>(["sd_0093_L1", "sd_0093_L2", "sd_0095_L1"]);

const TIER_SUB: Record<string, string> = { EMERGING: "Explorer", DEVELOPING: "Adapter", ADVANCING: "Implementer", LEADING: "Builder" };

// Heading words for boxes that have no heading above them, taken from the slot map
export const BOX_HEADS: { p: number; x: number; y: number; w: number; text: string; dark?: boolean; right?: boolean }[] = [
  { p: 1, x: 26.4, y: 62.95, w: 47, text: "Client name" },
  { p: 1, x: 10, y: 69.15, w: 25, text: "Report date", right: true },
  { p: 4, x: 11.04, y: 14.45, w: 15, text: "Score 0-100", dark: true },
  { p: 4, x: 26.92, y: 14.45, w: 40, text: "Tier, sub-name and band", dark: true },
  { p: 4, x: 72.4, y: 14.45, w: 20, text: "Lowest pillars", dark: true },
];

// Fields whose place on the page is now drawn from the client's numbers by SdReportArt.
export const DRAWN_BY_ART = new Set<string>([
  "record_036", "record_051", "record_069", "record_088", "record_108",
  "record_141", "record_142", "record_143", "record_144", "record_145",
  "align_dept1_name", "align_dept1_hours", "align_dept2_name", "align_dept2_hours", "align_dept3_name", "align_dept3_hours",
  "align_dept4_name", "align_dept4_hours", "align_dept_total",
  "sd_0096_L1", "sd_0097_L1", "answer_115", "answer_117", "answer_119", "calc_120", "sd_res_label1", "sd_res_label2", "sd_res_label3",
]);

// Page 6 rows grow with Imani's wording, so the cells are laid out again here.
const PAGE6_ROWS: Record<string, { col: number; row: number }> = {};
["agent_019", "agent_022", "agent_025", "agent_028", "agent_031"].forEach((k, i) => { PAGE6_ROWS[k] = { col: 0, row: i }; });
["answer_020", "answer_023", "answer_026", "answer_029", "answer_032"].forEach((k, i) => { PAGE6_ROWS[k] = { col: 1, row: i }; });
["agent_021", "agent_024", "agent_027", "agent_030", "agent_033"].forEach((k, i) => { PAGE6_ROWS[k] = { col: 2, row: i }; });
const PAGE6_COLS = [{ x: 157, w: 190 }, { x: 390, w: 325 }, { x: 757, w: 405 }];

// Captions and the regions line may run to two lines, so they get the room for it.
const CAPTION2 = new Set<string>(["answer_035", "answer_050", "answer_068", "answer_087", "answer_107"]);

// Page 12 law statements and the page 15 stage checkpoints are sentences, so they get two or three lines.
const LAW12 = new Set<string>(["agent_126", "agent_129", "agent_132", "agent_135", "agent_138"]);
const ACTIONS15 = new Set<string>(["agent_153", "agent_155", "agent_157", "agent_159", "agent_161"]);
const CHECK15 = new Set<string>(["agent_154", "agent_156", "agent_158", "agent_160", "agent_162"]);

export function geometryFor(f: Field): Field {
  const r = PAGE6_ROWS[f.n];
  if (r) {
    const c = PAGE6_COLS[r.col];
    const top = ROW6_TOP + r.row * ROW6_H + 18;
    return { ...f, x: (c.x / 1275) * 100, w: (c.w / 1275) * 100, y: (top / 1650) * 100, h: ((ROW6_H - 36) / 1650) * 100, ml: true };
  }
  if (f.n === "record_013" || f.n === "record_014" || f.n === "record_015") return { ...f, y: 16.5, h: 2.3, s: 1.5 };
  if (f.n === "sd_0078_L1") return { ...f, x: 52.6, w: 12.6, ml: false };
  // Page 9: everything below the tile section moves down 124 to give the tiles room
  if (f.p === 9 && f.y >= 33.8) return { ...f, y: f.y + 7.515 };
  const T9: Record<string, Partial<Field>> = {
    sd_0092_L1: { x: 9.88, w: 10.2, y: 25.55, h: 2.3, s: 1.6, ctr: true },
    sd_0093_L1: { x: 9.88, w: 10.2, y: 28.0, h: 3.1, s: 2.6, wt: 700, ctr: true, ml: false },
    sd_0093_L2: { x: 9.88, w: 10.2, y: 30.7, h: 1.6, s: 1.2, ctr: true, ml: false },
    sd_0094_L1: { x: 21.0, w: 14.1, y: 25.55, h: 2.3, s: 1.6, ctr: true },
    answer_075: { x: 21.8, w: 12.6, y: 27.95, h: 3.9, s: 1.2, ml: true },
    sd_0095_L1: { x: 36.08, w: 14.1, y: 25.2, h: 3.4, s: 1.35, ctr: true, ml: true },
    answer_076: { x: 36.9, w: 12.6, y: 28.4, h: 3.5, s: 1.3, ml: true },
    answer_077: { x: 10.3, w: 44.4, y: 34.2, h: 6.2, s: 1.5, ml: true },
    answer_099: { y: 25.2, h: 3.4, s: 1.4, ml: true },
    agent_100: { y: 30.6, h: 3.7, s: 1.3, ml: true },
  };
  if (T9[f.n]) return { ...f, ...T9[f.n] };
  if (f.n === "sd_0048") return { ...f, x: f.x + 1.41 };
  if (f.n === "sd_0003_L1") return { ...f, x: 27, w: 46, ml: false };
  if (LAW12.has(f.n)) return { ...f, x: 61, w: 30, y: f.y - 0.6, h: 2.9, ml: true };
  if (CHECK15.has(f.n)) return { ...f, y: 49.2, h: 9.1 };
  if (ACTIONS15.has(f.n)) return { ...f, h: 22.2 };
  if (CAPTION2.has(f.n)) return { ...f, y: 14.65, h: 2.1, ml: true };
  if (f.n === "sd_0054") return { ...f, y: (212 / 1650) * 100, h: (58 / 1650) * 100, ml: true };
  return f;
}

// One text box. Wording longer than its space shrinks to fit (down to 55%) and is flagged when it still does not fit.
export function FitField({ f, value, p, editable, imani, fitText, color, onChange, onBlur }: {
  f: Field; value: string; p: number; editable: boolean; imani: boolean; fitText: boolean; color?: string; onChange: (v: string) => void; onBlur: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const fit_ = fitText;
  const fit = () => {
    const el = ref.current;
    if (!el || !fit_) return;
    let lo = 0.55, hi = 1, best = lo, fits = false;
    const overflows = () => (f.ml ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1);
    el.style.setProperty("--k", "1");
    if (!overflows()) { setOver(false); return; }
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      el.style.setProperty("--k", String(mid));
      if (overflows()) hi = mid; else { best = mid; lo = mid; fits = true; }
    }
    el.style.setProperty("--k", String(fits ? best : 0.55));
    setOver(!fits);
  };
  useLayoutEffect(() => { fit(); });
  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  const style: CSSProperties = {
    ["--x" as any]: f.x, ["--y" as any]: f.y, ["--w" as any]: f.w, ["--h" as any]: f.h, ["--s" as any]: f.s,
    ["--c" as any]: color ?? f.c, ["--ff" as any]: `"${f.f}"`, ["--fw" as any]: f.wt, ["--fs" as any]: f.it ? "italic" : "normal",
  };
  const common = {
    ref, style, spellCheck: false, autoComplete: "off" as const, "aria-label": `Page ${p} ${f.n}`,
    className: "f" + (imani ? " edit" : "") + (over ? " over" : "") + (f.ctr ? " ctr" : ""),
    title: over ? "This wording is longer than the space on the page. Shorten it to fit." : undefined,
  };
  return f.ml
    ? <textarea {...common} value={value} readOnly={!editable} onChange={e => onChange(e.target.value)} onBlur={onBlur} />
    : <input type="text" {...common} value={value} readOnly={!editable} onChange={e => onChange(e.target.value)} onBlur={onBlur} />;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function AdminReport() {
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

  const locked = useMemo(() => (report ? lockedValues(report) : {}), [report]);
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

  const clientEmail = report?.email ?? "";

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
    ALL_FIELDS.forEach(f => { (m[f.p] = m[f.p] || []).push(f); });
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
          <b>Strategic AI Insight Report · {clientName || report.email}</b>
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
          {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map(p => (
            <button key={p} type="button" aria-label={`Go to page ${p}`}
              onClick={() => document.getElementById("rp" + p)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{p}</button>
          ))}
        </nav>
      </header>
      <main>
        {Array.from({ length: PAGE_COUNT }, (_, i) => i + 1).map(p => (
          <section key={p} id={"rp" + p} className="pg" aria-label={"Page " + p}
            style={{ backgroundImage: `url("/report-pages/p-${String(p).padStart(2, "0")}.png")` }}>
            {p > 1 && <div className="hdrname">{clientName}</div>}
            <SdReportArt page={p} report={report} />
            {BOX_HEADS.filter(h => h.p === p).map(h => (
              <div key={h.text} className={"boxhead" + (h.dark ? " dk" : "")} style={{ left: h.x + "%", top: h.y + "%", width: h.w + "%", textAlign: h.right ? "right" : "left" }}>{h.text}</div>
            ))}
            {(byPage[p] ?? []).map(f0 => {
              if (DRAWN_BY_ART.has(f0.n)) return null;
              const f = geometryFor(f0);
              const isImani = editableKeys.has(f.n);
              const isLockedCell = f.n in locked;
              const isFixed = f.n.startsWith("sd_");
              // Imani's spots, locked figures and fixed wording show their content; every other template slot stays empty.
              if (!isFixed && !isImani && !isLockedCell) return null;
              if (TILE_WORDS.has(f.n) && !isLockedCell) return null;
              let value = isImani ? valueFor(f.n) : isLockedCell ? locked[f.n] : f.d;
              if (f.n === "sd_0012") value = value.replace("scores from 3 to 15", "scores from 1 to 15");
              if (f.n === "sd_0098" && locked["answer_080"]) value = value.replace("[PILOT NAME]", locked["answer_080"].toUpperCase());
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

export const css = `
.bar{position:sticky;top:0;z-index:20;background:#0A2342;padding:10px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;border-bottom:2px solid #D4AF37;color:#FAFAF8}
.ttl{min-width:0;flex:1 1 260px}
.ttl b{display:block;font:700 13px/1.2 Poppins,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.ttl span{display:block;font:400 11.5px/1.4 Poppins,sans-serif;color:#B9C2D0}
.status{font:700 11.5px/1 Poppins,sans-serif;letter-spacing:.04em;padding:6px 10px;border-radius:99px;background:#16335A;color:#8FD3A5;white-space:nowrap}
.status[data-state="saving"],.status[data-state="idle"]{color:#F2C46B}
.status[data-state="error"]{color:#FF8A8A}
.approve{font:700 12px/1 Poppins,sans-serif;padding:8px 16px;border-radius:6px;border:0;background:#D4AF37;color:#0A2342;cursor:pointer}
.viewpdf{font:700 12px/1 Poppins,sans-serif;padding:8px 14px;border-radius:6px;border:1px solid #D4AF37;background:transparent;color:#D4AF37;cursor:pointer}
.approve:disabled{cursor:not-allowed;opacity:.4}
.veil{position:fixed;inset:0;z-index:50;background:rgba(10,35,66,.62);display:flex;align-items:center;justify-content:center;padding:16px}
.dlg{background:#FAFAF8;border-top:4px solid #D4AF37;border-radius:8px;padding:22px 24px;max-width:460px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,.35);font-family:Poppins,sans-serif;color:#0A2342}
.dq{font:700 16px/1.4 Poppins,sans-serif;margin:0 0 6px}
.dn{font:400 12.5px/1.5 Poppins,sans-serif;margin:0 0 18px;color:#51607A}
.dbtn{display:flex;gap:10px;justify-content:flex-end}
.dbtn button{font:700 12px/1 Poppins,sans-serif;padding:10px 18px;border-radius:6px;border:0;cursor:pointer}
.dbtn .no{background:#E7E4DC;color:#0A2342}.dbtn .yes{background:#0A2342;color:#D4AF37}
.back{font:700 11px/1 Poppins,sans-serif;color:#B9C2D0;text-decoration:underline}
.err{flex:1 1 100%;font:400 12px Poppins,sans-serif;color:#FF8A8A}
.nav{display:flex;flex-wrap:wrap;gap:4px;flex:1 1 100%}
.nav button{font:700 11px/1 Poppins,sans-serif;min-width:30px;height:28px;padding:0 8px;border:0;border-radius:6px;background:#16335A;color:#FAFAF8;cursor:pointer}
.nav button:hover{background:#234577}
main{padding:20px 16px 56px;display:flex;flex-direction:column;align-items:center;gap:22px}
.pg{position:relative;width:min(100%,860px);aspect-ratio:612/792;container-type:inline-size;background-color:#FAFAF8;background-size:100% 100%;background-repeat:no-repeat;box-shadow:0 1px 2px rgba(0,0,0,.25),0 10px 30px rgba(0,0,0,.18);scroll-margin-top:150px}
.boxhead{position:absolute;height:1.7%;font:700 1.5cqw/1.2 Poppins,sans-serif;color:#51607A;white-space:nowrap;overflow:hidden;letter-spacing:.01em}.boxhead.dk{color:#D4AF37}
.hdrname{position:absolute;left:78%;width:14.7%;top:.55%;height:2.1%;background:#0A2342;color:#D4AF37;font:700 .92cqw/1.3 Poppins,sans-serif;text-align:right;white-space:nowrap;overflow:hidden;text-transform:uppercase;letter-spacing:.02em;display:flex;align-items:center;justify-content:flex-end}
.f{position:absolute;box-sizing:border-box;margin:0;padding:0 .08cqw 0 .25cqw;border:0;border-radius:2px;background:transparent;font-size:calc(var(--s)*var(--k,1)*1cqw);line-height:1.3;color:var(--c);font-family:var(--ff),"DejaVu Sans",sans-serif;font-weight:var(--fw);font-style:var(--fs);resize:none;overflow:hidden;text-overflow:clip;white-space:nowrap;left:calc(var(--x)*1%);top:calc(var(--y)*1%);width:calc(var(--w)*1%);height:calc(var(--h)*1%);outline:0;caret-color:#C2185B}
textarea.f{padding-top:.3cqw;white-space:pre-wrap;overflow-wrap:anywhere}
.f.ctr{text-align:center}.f[readonly]{cursor:default}
.f.over{box-shadow:inset 0 0 0 2px #E53935 !important}
.f.edit:not([readonly]):hover{box-shadow:inset 0 0 0 1px rgba(194,24,91,.55)}
.f.edit:not([readonly]):focus{box-shadow:inset 0 0 0 2px #C2185B;background:rgba(255,255,255,.88)}
`;
