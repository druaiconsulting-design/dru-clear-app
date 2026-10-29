// Charts and pictures on the Executive AI Alignment Report pages, drawn from the client's own numbers.
// Each page picture (the page background) holds the fixed design. Every part that changes per client is covered
// here and drawn again from the calculator figures. Coordinates are in pixels of the 1275 x 1650 page pictures.

const NAVY = "#0A2342";
const MAGENTA = "#C2185B";
const GOLD = "#D4AF37";
const TRACK = "#E9E4D4";
const PAGE_BG = "#FAFAF8";
const FONT = "Poppins, 'Segoe UI', sans-serif";

export type EdArtReport = { numbers: any; first_name?: string | null };

const pillarColor = (score: number) => (score >= 12 ? NAVY : MAGENTA);
const money = (n: number) => "$" + Number(n).toLocaleString("en-US");

function Person({ cx, top, scale, filled }: { cx: number; top: number; scale: number; filled: boolean }) {
  const s = scale;
  const headR = 5.5 * s;
  const bodyW = 11 * s;
  const bodyTop = top + 14 * s;
  const bodyBottom = top + 22 * s + 4 * s;
  const common = filled ? { fill: NAVY, stroke: NAVY } : { fill: "none", stroke: NAVY };
  return (
    <g strokeWidth={2 * Math.max(s / 1.4, 0.7)}>
      <circle cx={cx} cy={top + 6 * s} r={headR} {...common} />
      <path d={`M ${cx - bodyW} ${bodyBottom} A ${bodyW} ${bodyBottom - bodyTop} 0 0 1 ${cx + bodyW} ${bodyBottom} Z`} {...common} />
    </g>
  );
}

// The score ring in the dark header of a pillar page: the same size and place as the picture it replaces.
const RING_R = 82, RING_W = 22;
function HeaderRing({ cx, cy, score }: { cx: number; cy: number; score: number }) {
  const C = 2 * Math.PI * RING_R;
  const frac = Math.max(0, Math.min(1, score / 15));
  const a = (12 / 15) * 2 * Math.PI; // the gap line at 12
  const x1 = cx + 63 * Math.sin(a), y1 = cy - 63 * Math.cos(a);
  const x2 = cx + 97 * Math.sin(a), y2 = cy - 97 * Math.cos(a);
  return (
    <g>
      <circle cx={cx} cy={cy} r={RING_R - RING_W / 2} fill="#FFFFFF" fillOpacity={0.06} />
      <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke="#FFFFFF" strokeOpacity={0.19} strokeWidth={RING_W} />
      <circle cx={cx} cy={cy} r={RING_R} fill="none" stroke={score >= 12 ? GOLD : MAGENTA} strokeWidth={RING_W}
        strokeDasharray={`${frac * C} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={score >= 12 ? "#FFFFFF" : GOLD} strokeWidth={5} />
    </g>
  );
}

// Rows on the Results page: a tile for every initiative the client listed.
export const RESULT_ROWS = { top: 445, bottom: 605, x: 576, w: 575, pitch: 54, h: 44 };
// Rows on the Alignment page: a line for every department the client listed, then the total.
export const DEPT_ROWS = { top: 438, bottom: 578, nameX: 123, hoursX: 493 };

export default function EdReportArt({ page, report, clean = false }: { page: number; report: EdArtReport; clean?: boolean }) {
  const n = report.numbers ?? {};
  const pillars = n.pillars ?? {};
  const score = (p: string): number => Number(pillars[p]?.score ?? 0);
  const body: JSX.Element[] = [];
  // Review copy keeps the colours that mark each kind of slot; the client copy reads in one ink.
  const inkAnswer = clean ? NAVY : "#7A5C00";
  const inkCalc = clean ? NAVY : "#2E7D46";

  // Cover and page 6: the client's achievement picture. Page 3 carries it again in the summary.
  if ((page === 1 || page === 3 || page === 6) && n.badge) {
    const src = `/report-badges/${String(n.badge).toLowerCase()}.png`;
    if (page === 1) {
      body.push(<image key="b" href={src} x={290} y={661} width={698} height={363} preserveAspectRatio="xMidYMid slice" />);
    } else if (page === 3) {
      body.push(<rect key="bg" x={97} y={235} width={426} height={255} fill={NAVY} />);
      body.push(<image key="b" href={src} x={97} y={235} width={426} height={255} preserveAspectRatio="xMidYMid meet" />);
    } else {
      body.push(<rect key="bg" x={100} y={211} width={1080} height={506} fill={NAVY} />);
      body.push(<image key="b" href={src} x={158} y={211} width={964} height={506} preserveAspectRatio="xMidYMid meet" />);
    }
  }

  // Page 5: the three boxes in the dark band sit lower, so each has a heading above it (as on the Strategic report)
  if (page === 5) {
    body.push(<rect key="bandcover" x={118} y={244} width={1040} height={66} fill={NAVY} />);
    [[126, 166], [328, 544], [908, 241]].forEach(([x, w], i) => (
      body.push(<rect key={"bx" + i} x={x} y={264} width={w} height={50} rx={5} fill="#FAF6EA" />)
    ));
  }

  // Page 5: five pillar bars, scale 3 to 15 with the gap line at 12
  if (page === 5 && Object.keys(pillars).length) {
    body.push(<rect key="cover" x={256} y={380} width={548} height={280} fill={PAGE_BG} />);
    const ys = [402, 450, 498, 546, 594];
    ["Clarity", "Leadership", "Execution", "Alignment", "Results"].forEach((p, i) => {
      const sc = score(p);
      const w = (Math.max(sc - 3, 0) / 12) * 507;
      body.push(<rect key={"t" + i} x={264} y={ys[i]} width={507} height={31} rx={6} fill={TRACK} />);
      if (w > 0) body.push(<rect key={"f" + i} x={264} y={ys[i]} width={Math.max(w, 6)} height={31} rx={6} fill={pillarColor(sc)} />);
    });
    body.push(<text key="a1" x={264} y={656} fontFamily={FONT} fontSize={13} fill="#7A7A7A">3</text>);
    body.push(<text key="a15" x={791} y={656} textAnchor="end" fontFamily={FONT} fontSize={13} fill="#7A7A7A">15</text>);
    body.push(<line key="gl" x1={644.25} y1={382} x2={644.25} y2={634} stroke={GOLD} strokeOpacity={0.65} strokeWidth={2} strokeDasharray="7 5" />);
  }

  // Pillar pages 8 to 12: the score ring in the header
  const ringPages: Record<number, { pillar: string; cx: number }> = {
    8: { pillar: "Clarity", cx: 1019.5 }, 9: { pillar: "Leadership", cx: 254.5 }, 10: { pillar: "Execution", cx: 1019.5 },
    11: { pillar: "Alignment", cx: 254.5 }, 12: { pillar: "Results", cx: 1019.5 },
  };
  if (ringPages[page] && pillars[ringPages[page].pillar]) {
    body.push(<HeaderRing key="ring" cx={ringPages[page].cx} cy={194.5} score={score(ringPages[page].pillar)} />);
  }

  // Page 9: one person icon for every leader on the team, filled for the leaders who can state the strategy
  if (page === 9 && n.leadership) {
    const total = Number(n.leadership.leaders_total) || 0;
    const filled = Number(n.leadership.leaders_who_can) || 0;
    body.push(<rect key="cover" x={788} y={498} width={380} height={58} fill="#FFFFFF" />);
    if (total > 20) {
      // Too many to draw one by one: a bar filled to the share who can state it.
      body.push(<rect key="lt" x={796} y={518} width={360} height={26} rx={6} fill={TRACK} />);
      if (filled > 0) body.push(<rect key="lf" x={796} y={518} width={Math.max(6, 360 * Math.min(filled / total, 1))} height={26} rx={6} fill={NAVY} />);
    } else {
      const pitch = Math.min(52, 350 / Math.max(total, 1));
      const sc = 1.4 * Math.min(1, pitch / 52);
      for (let i = 0; i < total; i++) {
        body.push(<Person key={"p" + i} cx={806.5 + i * pitch} top={509} scale={sc} filled={i < filled} />);
      }
    }
  }

  // Page 11: the departments and their hours, as many rows as the client typed, then the total
  if (page === 11 && n.alignment) {
    // The box holds five lines at a size that reads. When the client listed more than five departments, the first four
    // show and the rest are added together into one line, so the total hours still adds up on the page.
    const all: { department: string; hours: number }[] = n.alignment.departments ?? [];
    const deps = all.length > 5
      ? [...all.slice(0, 4), { department: `${all.length - 4} other departments`, hours: Math.round(all.slice(4).reduce((a, d) => a + Number(d.hours || 0), 0) * 100) / 100 }]
      : all;
    body.push(<rect key="cover" x={110} y={434} width={620} height={146} fill="#FFFFFF" />);
    const pitch = Math.min(28, (DEPT_ROWS.bottom - DEPT_ROWS.top) / (deps.length + 1));
    const fs = Math.min(16.7, pitch * 0.6);
    deps.forEach((d, i) => {
      const y = DEPT_ROWS.top + i * pitch;
      body.push(<text key={"n" + i} x={DEPT_ROWS.nameX} y={y + pitch * 0.72} fontFamily={FONT} fontSize={fs} fill={inkAnswer}>{d.department}</text>);
      body.push(<text key={"h" + i} x={DEPT_ROWS.hoursX} y={y + pitch * 0.72} fontFamily={FONT} fontSize={fs} fill={inkAnswer}>{d.hours}</text>);
    });
    const ty = DEPT_ROWS.top + deps.length * pitch;
    body.push(<text key="tl" x={DEPT_ROWS.nameX} y={ty + pitch * 0.72} fontFamily={FONT} fontWeight={700} fontSize={fs} fill={NAVY}>Total hours</text>);
    body.push(<text key="tv" x={DEPT_ROWS.hoursX} y={ty + pitch * 0.72} fontFamily={FONT} fontWeight={700} fontSize={fs} fill={inkCalc}>{n.alignment.total_hours}</text>);
  }

  // Page 12: each initiative's value on its own tile, as many tiles as the client listed
  if (page === 12 && n.results) {
    // The box holds four tiles at a size that reads. When there are more than four initiatives, the first three show
    // and the rest are added together into one tile, so the total on the page still adds up.
    const allI: { initiative: number; value: number }[] = n.results.initiatives ?? [];
    const inits: { initiative: number | string; value: number }[] = allI.length > 4
      ? [...allI.slice(0, 3), { initiative: `${allI.length - 3} other initiatives`, value: allI.slice(3).reduce((a, d) => a + Number(d.value || 0), 0) }]
      : allI;
    const { top, bottom, x, w } = RESULT_ROWS;
    body.push(<rect key="cover" x={x - 8} y={top - 6} width={w + 16} height={bottom - top + 12} fill="#FFFFFF" />);
    const pitch = Math.min(RESULT_ROWS.pitch, (bottom - top) / Math.max(inits.length, 1));
    const h = Math.max(pitch - 10, 26);
    const fs = Math.min(16.7, h * 0.5);
    inits.forEach((it, i) => {
      const y = top + i * pitch;
      body.push(<rect key={"t" + i} x={x} y={y} width={w} height={h} rx={6} fill="#F6F0E3" stroke="#E8E0CF" />);
      body.push(<text key={"l" + i} x={x + 15} y={y + h / 2 + fs * 0.36} fontFamily={FONT} fontWeight={700} fontSize={fs} fill={NAVY}>{typeof it.initiative === "number" ? `Initiative ${it.initiative}` : it.initiative}</text>);
      body.push(<text key={"v" + i} x={x + 219} y={y + h / 2 + fs * 0.36} fontFamily={FONT} fontSize={fs} fill={inkAnswer}>{money(it.value)}</text>);
    });
  }

  // Page 16: the five circles, navy for a strength and magenta for a gap
  if (page === 16 && Object.keys(pillars).length) {
    const spots: Record<string, [number, number]> = {
      Clarity: [637.5, 357.5], Leadership: [887.5, 539], Execution: [792, 832.5], Alignment: [483, 832.5], Results: [387.5, 539],
    };
    Object.entries(spots).forEach(([p, [cx, cy]]) => {
      const sc = score(p);
      body.push(<circle key={"c" + p} cx={cx} cy={cy} r={66} fill={PAGE_BG} />);
      body.push(<circle key={"d" + p} cx={cx} cy={cy} r={62.5} fill={pillarColor(sc)} stroke={GOLD} strokeWidth={3.5} />);
      body.push(<text key={"s" + p} x={cx} y={cy + 15} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={44} fill="#FFFFFF">{sc}</text>);
    });
  }

  if (!body.length) return null;
  return (
    <svg viewBox="0 0 1275 1650" preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {body}
    </svg>
  );
}
