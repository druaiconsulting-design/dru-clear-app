import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import EdReportArt from "../components/EdReportArt";
import { FitField, css } from "./AdminReport";
import type { Field, ReportData } from "./AdminReport";
import { ED_BOX_HEADS, ED_DRAWN_BY_ART, ED_FIELDS, ED_PAGE_COUNT, edFieldValue, edLockedValues } from "./AdminEdReport";

// The client's copy of the Executive AI Alignment Report: 21 pages, final wording only.
// No marker boxes, no slot labels, no edit bar. The PDF builder opens this page, hands it the report's data
// in window.__ED_REPORT__, waits for window.__ED_READY__, then prints it to PDF.

const PAGE_CSS = `
@page{size:8.5in 11in;margin:0}
html,body,#root{height:auto !important;overflow:visible !important}
html,body{margin:0;padding:0;background:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
main{padding:0 !important;display:block !important;gap:0 !important}
.pg{width:8.5in !important;height:11in !important;aspect-ratio:auto !important;box-shadow:none !important;margin:0 !important;overflow:hidden;break-after:page;page-break-after:always}
.pg:last-child{break-after:auto;page-break-after:auto}
.f{caret-color:transparent}
textarea.f,input.f{-webkit-appearance:none;appearance:none}
`;

export default function EdReportPrint() {
  const report = (typeof window !== "undefined" ? (window as any).__ED_REPORT__ : undefined) as ReportData | undefined;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;1,400&family=Cinzel:wght@400;700&family=Lora:ital,wght@0,700;1,400&family=Montserrat:wght@700&display=swap";
    document.head.appendChild(link);
    const w = window as any;
    w.__ED_READY__ = false;
    let dead = false;
    const settle = async () => {
      try { await (document as any).fonts.ready; } catch { /* keep going */ }
      // Poppins and the others load on first use; ask for each weight so the page has them before it is measured.
      try {
        await Promise.all([
          "400 16px Poppins", "700 16px Poppins", "italic 400 16px Poppins", "400 16px Cinzel", "700 16px Cinzel",
          "italic 400 16px Lora", "700 16px Lora", "700 16px Montserrat",
        ].map(f => (document as any).fonts.load(f, "Aa 0123")));
      } catch { /* keep going */ }
      if (dead) return;
      setTick(t => t + 1);
      await new Promise(r => setTimeout(r, 400));
      setTick(t => t + 1);
      await new Promise(r => setTimeout(r, 400));
      w.__ED_READY__ = true;
    };
    link.onload = () => { settle(); };
    link.onerror = () => { settle(); };
    const guard = setTimeout(() => { settle(); }, 6000);
    return () => { dead = true; clearTimeout(guard); };
  }, []);

  const locked = useMemo(() => (report ? edLockedValues(report) : {}), [report]);
  const imaniKeys = useMemo(() => {
    const s = new Set<string>();
    if (!report) return s;
    const leading = report.numbers?.badge === "LEADING";
    report.spots.forEach(sp => { if (sp.writer === "imani" && (!sp.leading_only || leading)) s.add(sp.spot_key); });
    return s;
  }, [report]);
  const byPage = useMemo(() => {
    const m: Record<number, Field[]> = {};
    ED_FIELDS.forEach(f => { (m[f.p] = m[f.p] || []).push(f); });
    return m;
  }, []);

  useLayoutEffect(() => { /* re-measure after each tick */ }, [tick]);

  if (!report) return <div id="ed-empty" />;
  const clientName = [report.first_name, report.last_name].filter(Boolean).join(" ");
  const textFor = (key: string) => report.edits?.[key] ?? report.insight?.entries?.[key]?.text ?? "";

  return (
    <div style={{ background: "#fff", fontFamily: '"Poppins","Segoe UI",system-ui,sans-serif' }} data-tick={tick}>
      <style>{css}{PAGE_CSS}</style>
      <main>
        {Array.from({ length: ED_PAGE_COUNT }, (_, i) => i + 1).map(p => (
          <section key={p} id={"rp" + p} className="pg" aria-label={"Page " + p}
            style={{ backgroundImage: `url("/ed-report-pages-clean/p-${String(p).padStart(2, "0")}.png")` }}>
            {p > 1 && <div className="hdrname">{clientName}</div>}
            <EdReportArt page={p} report={report} clean />
            {ED_BOX_HEADS.filter(h => h.p === p).map(h => (
              <div key={h.text} className={"boxhead" + (h.dark ? " dk" : "")} style={{ left: h.x + "%", top: h.y + "%", width: h.w + "%" }}>{h.text}</div>
            ))}
            {(byPage[p] ?? []).map(f => {
              if (ED_DRAWN_BY_ART.has(f.n)) return null;
              const isImani = imaniKeys.has(f.n);
              const value = edFieldValue(f, isImani, isImani ? textFor(f.n) : "", locked);
              if (!value) return null;
              // The review copy colours slots by type (pink, gold, green). The client copy reads in one ink: navy, with GAP in magenta like its bar.
              const ink = f.fx || /^pl\d_score$/.test(f.n) ? undefined : /^gap$/i.test(value.trim()) ? "#C2185B" : "#0A2342";
              return <FitField key={f.n} f={f} value={value} p={p} editable={false} imani={false} fitText color={ink} onChange={() => {}} onBlur={() => {}} />;
            })}
          </section>
        ))}
      </main>
    </div>
  );
}
