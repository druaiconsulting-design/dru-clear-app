// Pictures on the five pillar pages (SD pages 7 to 11): the navy bar with its score ring and chart, the edge strip,
// the section headings, the cards, the lightbulb, the arrow, the Day 30/60/90 line and the question rows.
// Places come from data/sdPillarLayout.ts. The words themselves are wording boxes laid over this drawing.

import {
  CREAM, GOLD, MAGENTA, NAVY, PILLAR_PAGES, S, W, Y, COL, align10, exec9, execFlags, lay, leaders8, results11,
} from "../data/sdPillarLayout";

const FONT = "Poppins, 'Segoe UI', sans-serif";
const SERIF = "Lora, Georgia, serif";
const TRACK = "#26405F";
const m = (v: number) => v * S;
const BORDER = "#E8E0CF";
const RULE = "#E3DAC3";

// Width of each section heading at 13.3px bold with its letter spacing, measured once so the rule starts where the words end.
const HEAD_W: Record<string, number> = {
  "AHA MOMENTS": 110.2, "COMPOUNDED COST": 150.5, "CONNECTION": 99.2, "FIRST STEP": 79.4,
  "WHAT STRENGTH LOOKS LIKE": 212.7, "SIGNAL TO MONITOR": 151.4, "THREE QUESTIONS FOR YOUR SESSION": 276.6,
};

type Rep = { numbers: any; client_answers?: { framework: string; pillar: string; order: number; answer: string }[]; client_texts?: { field: string; value: string }[] };

function Heading({ k, text, x, y, w, color }: { k: string; text: string; x: number; y: number; w: number; color: string }) {
  const tw = HEAD_W[text] ?? text.length * 10;
  return (
    <g key={k}>
      <text x={x} y={y + 14.6} fontFamily={FONT} fontWeight={700} fontSize={m(8.5)} letterSpacing={m(0.6)} fill={color}>{text}</text>
      <line x1={x + tw + m(8)} y1={y + 10} x2={x + w} y2={y + 10} stroke={RULE} strokeWidth={1.5} />
    </g>
  );
}

function Person({ x, y, s, filled }: { x: number; y: number; s: number; filled: boolean }) {
  const common = filled ? { fill: GOLD, stroke: GOLD } : { fill: "none", stroke: GOLD };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} strokeWidth={1.4}>
      <circle cx={9} cy={6} r={5} {...common} />
      <path d="M0 26 Q0 13 9 13 Q18 13 18 26 Z" {...common} />
    </g>
  );
}

export default function pillarArt(page: number, report: Rep): JSX.Element[] {
  const P = PILLAR_PAGES[page];
  const L = lay(page);
  const n = report.numbers ?? {};
  const score = Number(n.pillars?.[P.pillar]?.score ?? 0);
  const out: JSX.Element[] = [];
  const barTop = L.top, barBottom = L.bottom, barH = barBottom - barTop;

  out.push(
    <defs key="defs">
      <filter id="pshadow" x="-5%" y="-5%" width="110%" height="118%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0A2342" floodOpacity="0.07" />
      </filter>
      <clipPath id={"pbar" + page}><rect x={L.barX} y={barTop} width={L.barW} height={barH} /></clipPath>
    </defs>
  );

  // ---- the bar and the strip on the other side
  out.push(<rect key="bar" x={L.barX} y={barTop} width={L.barW} height={barH} fill={NAVY} />);
  out.push(<rect key="barg" x={L.right ? L.barX : L.barX + L.barW - m(4)} y={barTop} width={m(4)} height={barH} fill={GOLD} />);
  const stripX = L.right ? 0 : W - m(16);
  out.push(<rect key="strip" x={stripX} y={barTop} width={m(16)} height={barH} fill={NAVY} />);
  out.push(<rect key="stripg" x={L.right ? m(12) : W - m(16)} y={barTop} width={m(4)} height={barH} fill={GOLD} />);

  // the large numeral behind the bar's lower part
  out.push(
    <text key="ghost" x={L.bx0 - 6} y={barBottom + 14} clipPath={`url(#pbar${page})`} fontFamily={SERIF} fontWeight={700} fontSize={m(380)} fill={GOLD} fillOpacity={0.1}>{P.num}</text>
  );

  // ---- the score ring: magenta for a gap, white for a strength, the gold line at 12
  const R = m(56), SW = m(12);
  const C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, score / 15));
  const a = (12 / 15) * 2 * Math.PI;
  const lineFrom = m(46), lineTo = m(63);
  const ringColor = score >= 12 ? "#FFFFFF" : MAGENTA;
  out.push(<circle key="rt" cx={L.cx} cy={L.cy} r={R} fill="none" stroke={TRACK} strokeWidth={SW} />);
  out.push(
    <circle key="ra" cx={L.cx} cy={L.cy} r={R} fill="none" stroke={ringColor} strokeWidth={SW} strokeLinecap="round"
      strokeDasharray={`${frac * C} ${C}`} transform={`rotate(-90 ${L.cx} ${L.cy})`} />
  );
  out.push(
    <line key="rg" x1={L.cx + lineFrom * Math.sin(a)} y1={L.cy - lineFrom * Math.cos(a)} x2={L.cx + lineTo * Math.sin(a)} y2={L.cy - lineTo * Math.cos(a)} stroke={GOLD} strokeWidth={m(4)} />
  );
  out.push(<text key="rs" x={L.cx} y={L.cy + m(10)} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={m(34)} fill="#FFFFFF">{score}</text>);
  // the pill under the ring
  out.push(<rect key="pill" x={L.bx0} y={Y.pill} width={m(90)} height={m(20)} rx={m(11)} fill="none" stroke={GOLD} strokeWidth={m(1.5)} />);
  out.push(<line key="r1" x1={L.bx0} y1={Y.rule1} x2={L.bx0 + L.tw - m(6)} y2={Y.rule1} stroke={GOLD} strokeOpacity={0.55} strokeWidth={1.6} />);

  // ---- each pillar's own chart in the bar
  const bx = L.bx0, tw = L.tw;
  const rule = (k: string, y: number) => <line key={k} x1={bx} y1={y} x2={bx + tw - m(6)} y2={y} stroke={GOLD} strokeOpacity={0.55} strokeWidth={1.6} />;
  const tileBox = (k: string, x: number, y: number, w: number, h: number, r = 9) =>
    <rect key={k} x={x} y={y} width={w} height={h} rx={r} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={1.6} />;

  if (page === 8 && n.leadership) {
    const tileW = (tw - 2 * m(6)) / 3;
    for (let i = 0; i < 3; i++) out.push(tileBox("t" + i, bx + i * (tileW + m(6)), 719, tileW, 86));
    out.push(rule("r2", 934));
    const total = Number(n.leadership.leaders_total) || 0;
    const filled = Number(n.leadership.leaders_who_can) || 0;
    const g = leaders8(total);
    for (let i = 0; i < total; i++) {
      out.push(<Person key={"p" + i} x={bx + m(4) + (i % g.cols) * g.pitch} y={g.top + Math.floor(i / g.cols) * g.rowPitch} s={g.scale} filled={i < filled} />);
    }
  }

  if (page === 9) {
    const fl = execFlags(report);
    const e = exec9(fl.hasRegions, fl.hasObstacle, fl.hasStage);
    out.push(rule("r2", e.pilot - 14));
    if (e.r1 != null) out.push(tileBox("a1", bx, e.r1, tw - m(6), e.h1));
    if (e.r2 != null) out.push(tileBox("a2", bx, e.r2, tw - m(6), e.h2));
    if (e.r3 != null) out.push(tileBox("a3", bx, e.r3, tw - m(6), e.h3));
    out.push(rule("r3", e.rule3));
  }

  if (page === 10 && n.alignment) {
    const deps: { department: string; hours: number }[] = n.alignment.departments ?? [];
    const g = align10(deps.length);
    deps.forEach((d, i) => {
      const y = g.top + i * g.pitch;
      const name = String(d.department);
      out.push(
        <text key={"dn" + i} x={bx} y={y + 22} fontFamily={FONT} fontSize={m(9)} fill="#FFFFFF"
          {...(name.length > 24 ? { textLength: tw - 100, lengthAdjust: "spacingAndGlyphs" as const } : {})}>{name}</text>
      );
      out.push(<text key={"dh" + i} x={bx + tw - m(6)} y={y + 24} textAnchor="end" fontFamily={SERIF} fontWeight={700} fontSize={m(15)} fill={GOLD}>{String(d.hours)}</text>);
      out.push(<line key={"dl" + i} x1={bx} y1={y + g.pitch - 14} x2={bx + tw - m(6)} y2={y + g.pitch - 14} stroke={GOLD} strokeOpacity={0.28} strokeWidth={1.4} />);
    });
    out.push(<text key="dt" x={bx} y={g.totalY + 26} fontFamily={SERIF} fontWeight={700} fontSize={m(15)} fill={GOLD}>{`${n.alignment.total_hours} hours in total`}</text>);
    out.push(rule("r2", g.objRule));
  }

  if (page === 11 && n.results) {
    const inits: { initiative: number; value: number }[] = n.results.initiatives ?? [];
    const total = Number(n.results.total_value) || 1;
    const g = results11(inits.length);
    const bw = tw - m(6);
    inits.forEach((it, i) => {
      const y = g.top + i * g.pitch;
      const w = Math.max((it.value / total) * bw, 8);
      out.push(<text key={"il" + i} x={bx} y={y + 16} fontFamily={FONT} fontWeight={700} fontSize={m(9)} fill="#FFFFFF">{`Initiative ${it.initiative}`}</text>);
      out.push(<text key={"iv" + i} x={bx + bw} y={y + 17} textAnchor="end" fontFamily={SERIF} fontWeight={700} fontSize={m(11.5)} fill={GOLD}>{"$" + Number(it.value).toLocaleString("en-US")}</text>);
      out.push(<rect key={"it" + i} x={bx} y={y + 30} width={bw} height={22} rx={7} fill={TRACK} />);
      out.push(<rect key={"ib" + i} x={bx} y={y + 30} width={w} height={22} rx={7} fill={MAGENTA} />);
    });
    out.push(rule("r2", g.totalY - 6));
    out.push(<text key="it" x={bx} y={g.totalY + 34} fontFamily={SERIF} fontWeight={700} fontSize={m(15)} fill={GOLD}>{"$" + Number(n.results.total_value).toLocaleString("en-US") + " in total"}</text>);
  }

  // ---- the writing column
  const cx = L.colX, cw = L.colW;
  const head = (k: string, text: string, y: number, w: number, color: string, x = cx) => out.push(<Heading key={k} k={k} text={text} x={x} y={y} w={w} color={color} />);
  const card = (k: string, x: number, y: number, w: number, h: number, extra: JSX.Element[] = []) => {
    out.push(<rect key={k} x={x} y={y} width={w} height={h} rx={m(6)} fill="#FFFFFF" stroke={BORDER} strokeWidth={1.6} filter="url(#pshadow)" />);
    extra.forEach(e => out.push(e));
  };

  // Aha moments with the lightbulb
  head("h-aha", "AHA MOMENTS", Y.ahaLab, cw, MAGENTA);
  card("c-aha", cx, Y.ahaTop, cw, Y.ahaH);
  out.push(<path key="aha-acc" d={`M${cx + m(6)} ${Y.ahaTop} H${cx + m(4)} Q${cx} ${Y.ahaTop} ${cx} ${Y.ahaTop + m(6)} V${Y.ahaTop + Y.ahaH - m(6)} Q${cx} ${Y.ahaTop + Y.ahaH} ${cx + m(4)} ${Y.ahaTop + Y.ahaH} H${cx + m(6)} Z`} fill={MAGENTA} />);
  out.push(
    <g key="bulb" transform={`translate(${cx + cw - m(18) - m(44)} ${Y.ahaTop + m(14)}) scale(${S})`}>
      <path d="M22 3 C11 3 4 11 4 21 C4 28 8 32 11 37 C13 40 13 42 13 45 L31 45 C31 42 31 40 33 37 C36 32 40 28 40 21 C40 11 33 3 22 3 Z" fill="#F1E3B0" stroke="#E2CD86" strokeWidth={1.5} />
      <rect x={13} y={47} width={18} height={4} rx={2} fill="#E2CD86" />
      <rect x={16} y={53} width={12} height={3.5} rx={1.75} fill="#E2CD86" />
      <path d="M17 21 Q22 15 27 21" fill="none" stroke="#fff" strokeWidth={2} opacity={0.8} strokeLinecap="round" />
    </g>
  );

  // Compounded cost and Connection, side by side with a line between them
  head("h-cc", "COMPOUNDED COST", Y.ccLab, COL.half, NAVY);
  head("h-conn", "CONNECTION", Y.ccLab, COL.halfRW, NAVY, cx + COL.halfR);
  out.push(<line key="ccv" x1={cx + COL.half + m(11)} y1={Y.ccLab + 6} x2={cx + COL.half + m(11)} y2={Y.ccLab + 6 + 190} stroke={RULE} strokeWidth={1.6} />);

  // First step: a cream panel with a gold edge and an arrow that points toward the bar
  {
    const x = cx, y = Y.firstTop, w = cw, h = Y.firstH, gw = m(6);
    out.push(<rect key="fs" x={x} y={y} width={w} height={h} rx={m(6)} fill={CREAM} filter="url(#pshadow)" />);
    const gx = L.right ? x : x + w - gw;
    out.push(<path key="fsg" d={L.right
      ? `M${x + gw} ${y} H${x + m(6)} Q${x} ${y} ${x} ${y + m(6)} V${y + h - m(6)} Q${x} ${y + h} ${x + m(6)} ${y + h} H${x + gw} Z`
      : `M${gx} ${y} H${x + w - m(6)} Q${x + w} ${y} ${x + w} ${y + m(6)} V${y + h - m(6)} Q${x + w} ${y + h} ${x + w - m(6)} ${y + h} H${gx} Z`} fill={GOLD} />);
    const tx = L.right ? x + gw + m(20) : x + m(70);
    const tw2 = w - gw - m(20) - m(70);
    out.push(<text key="fsl" x={tx} y={y + m(16) + 14.6} fontFamily={FONT} fontWeight={700} fontSize={m(8.5)} letterSpacing={m(0.6)} fill={MAGENTA}>FIRST STEP</text>);
    out.push(<line key="fsr" x1={tx + HEAD_W["FIRST STEP"] + m(8)} y1={y + m(16) + 10} x2={tx + tw2} y2={y + m(16) + 10} stroke={RULE} strokeWidth={1.5} />);
    const ay = y + (h - m(46)) / 2;
    out.push(
      <g key="arrow" transform={`translate(${L.right ? x + w - gw - m(18) - m(34) : x + m(18)} ${ay}) scale(${S})`}>
        <path d={L.right ? "M6 4 L28 23 L6 42" : "M28 4 L6 23 L28 42"} fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    );
  }

  // What strength looks like, and the signal to monitor with its Day 30 / 60 / 90 line
  head("h-str", "WHAT STRENGTH LOOKS LIKE", Y.sigLab, COL.half, "#7A5C00");
  head("h-sig", "SIGNAL TO MONITOR", Y.sigLab, COL.halfRW, MAGENTA, cx + COL.halfR);
  const topBar = (k: string, x: number, color: string) =>
    out.push(<path key={k} d={`M${x + 2} ${Y.sigTop + 4.7} Q${x + 2} ${Y.sigTop} ${x + m(6)} ${Y.sigTop} H${x + COL.half - m(6)} Q${x + COL.half - 2} ${Y.sigTop} ${x + COL.half - 2} ${Y.sigTop + 4.7} Z`} fill={color} />);
  card("c-str", cx, Y.sigTop, COL.half, Y.sigH);
  topBar("tb-str", cx, GOLD);
  card("c-sig", cx + COL.halfR, Y.sigTop, COL.half, Y.sigH);
  topBar("tb-sig", cx + COL.halfR, MAGENTA);
  {
    const px = cx + COL.halfR, left = px + 1.6 + m(16);
    const svgTop = Y.sigTop + Y.sigH - 1.6 - m(10) - m(30);
    const pt = [m(24), m(95), m(166)];
    out.push(<line key="tl" x1={left + pt[0]} y1={svgTop + m(9)} x2={left + pt[2]} y2={svgTop + m(9)} stroke="#E7A6BF" strokeWidth={m(2)} />);
    out.push(<circle key="t30" cx={left + pt[0]} cy={svgTop + m(9)} r={m(6)} fill={MAGENTA} />);
    out.push(<circle key="t60" cx={left + pt[1]} cy={svgTop + m(9)} r={m(5)} fill="#fff" stroke={MAGENTA} strokeWidth={m(2)} />);
    out.push(<circle key="t90" cx={left + pt[2]} cy={svgTop + m(9)} r={m(5)} fill="#fff" stroke={MAGENTA} strokeWidth={m(2)} />);
    ["Day 30", "Day 60", "Day 90"].forEach((t, i) =>
      out.push(<text key={"td" + i} x={left + pt[i]} y={svgTop + m(27)} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={m(8)} fill={MAGENTA}>{t}</text>));
  }

  // Three questions as rounded rows with a navy numeral ringed in gold
  head("h-q", "THREE QUESTIONS FOR YOUR SESSION", Y.qLab, cw, NAVY);
  Y.q.forEach((y, i) => {
    out.push(<rect key={"q" + i} x={cx} y={y} width={cw} height={Y.qH} rx={Y.qH / 2} fill="#FFFFFF" stroke={BORDER} strokeWidth={1.6} filter="url(#pshadow)" />);
    const ccx = cx + m(8) + m(18), ccy = y + Y.qH / 2;
    out.push(<circle key={"qc" + i} cx={ccx} cy={ccy} r={m(17)} fill={NAVY} stroke={GOLD} strokeWidth={m(2)} />);
    out.push(<text key={"qn" + i} x={ccx} y={ccy + m(5.6)} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={m(16)} fill={GOLD}>{String(i + 1)}</text>);
  });

  return out;
}
