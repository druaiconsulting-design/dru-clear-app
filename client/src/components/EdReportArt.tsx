// Charts and pictures on the Executive AI Alignment Report pages, drawn from the client's own numbers.
// Each page picture (the page background) holds the fixed design. Every part that changes per client is covered
// here and drawn again from the calculator figures. Coordinates are in pixels of the 1275 x 1650 page pictures.

import { fiveDPillShapes } from "./fiveDPills";
import { ROW6_H, ROW6_TOP } from "./SdReportArt";

const NAVY = "#0A2342";
const MAGENTA = "#C2185B";
const GOLD = "#D4AF37";
const TRACK = "#E9E4D4";
const PAGE_BG = "#FAFAF8";
const CREAM = "#F5EFE0";
const FONT = "Poppins, 'Segoe UI', sans-serif";

// Page 19 layout: the top of each decision block, in percent of the page height. The decision text starts 1.7 below it.
export const P19_BLOCK_TOP = [18.3, 39.6, 60.9];
const P19_CIRCLE_CY = P19_BLOCK_TOP.map(b => ((b + 1.7) / 100) * 1650 + 18);

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

  // Pillar pages 8 to 12: the Signal to Monitor card and its neighbour grow downward, and each circle on the track is labelled with its day
  if (page >= 8 && page <= 12) {
    const E = 18, NB = 1335 + E, FILL = "#F6F0E3", EDGE = "#E8E0CF";
    [[92, 653, GOLD, 93], [679, 1182, MAGENTA, 680]].forEach(([x0, x1, bar, bx], i) => {
      const r = 10;
      const d = `M${x0 + 1},1333 V${NB - r} Q${x0 + 1},${NB} ${x0 + 1 + r},${NB} H${x1 - 1 - r} Q${x1 - 1},${NB} ${x1 - 1},${NB - r} V1333`;
      body.push(<path key={"sg" + i} d={d + " Z"} fill={FILL} stroke="none" />);
      body.push(<rect key={"sc" + i} x={x0 + 1} y={1318} width={12} height={20} fill={FILL} />);
      body.push(<rect key={"sd" + i} x={x1 - 13} y={1318} width={12} height={20} fill={FILL} />);
      body.push(<path key={"se" + i} d={d} fill="none" stroke={EDGE} strokeWidth={2} />);
      body.push(<rect key={"sb" + i} x={bx} y={1318} width={8} height={NB - 1318 - 1} fill={bar as string} />);
    });
    [[760, "Day 30"], [930, "Day 60"], [1100, "Day 90"]].forEach(([cx, t]) => (
      body.push(<text key={"dl" + cx} x={cx as number} y={1347} textAnchor="middle" fontFamily={FONT} fontSize={11.5} fontWeight={600} fill={MAGENTA}>{t}</text>)
    ));
  }

  // Page 14: each of the five cards grows downward to hold a longer action line
  if (page === 14) {
    const E = 26, LINE = "#E6DFCA", BEIGE = "#EEEADC";
    const cards: { side: "L" | "R"; top: number; bot: number }[] = [
      { side: "L", top: 299, bot: 573 }, { side: "R", top: 517, bot: 765 }, { side: "L", top: 749, bot: 1023 },
      { side: "R", top: 974, bot: 1248 }, { side: "L", top: 1207, bot: 1481 },
    ];
    cards.forEach((c, i) => {
      const nb = c.bot + E, x0 = c.side === "L" ? 93 : 729, x1 = c.side === "L" ? 546 : 1182;
      const barX = c.side === "L" ? 540 : 729, barC = c.side === "L" ? MAGENTA : GOLD;
      const inX = c.side === "L" ? 95 : 735, inX2 = c.side === "L" ? 540 : 1180;
      body.push(<rect key={"k14w" + i} x={inX} y={c.bot - 4} width={inX2 - inX} height={nb - c.bot + 4} fill="#FFFFFF" />);
      body.push(<rect key={"k14b" + i} x={barX} y={c.bot - 4} width={6} height={nb - c.bot + 4} fill={barC} />);
      body.push(<rect key={"k14p" + i} x={c.side === "L" ? 93 : 1180} y={c.bot - 4} width={2} height={nb - c.bot + 4} fill={c.side === "L" ? LINE : BEIGE} />);
      body.push(<rect key={"k14l" + i} x={x0} y={nb - 1} width={x1 - x0} height={2} fill={LINE} />);
    });
  }

  // Page 13: each level shows the website's words as labels, drawn here in place of the old boxes and law line
  if (page === 13) fiveDPillShapes().forEach(e => body.push(e));

  // Page 15: the three cards in the bottom row grow downward to hold a longer action line
  if (page === 15) {
    const EXT = 52, BOT = 1328 + EXT;
    [[93, 351], [462, 351], [831, 351]].forEach(([x, w], i) => {
      body.push(<rect key={"cg" + i} x={x + 2} y={1324} width={w - 4} height={BOT - 1324} fill="#FFFFFF" />);
      body.push(<path key={"cb" + i} d={`M${x + 0.5},1324 V${BOT} H${x + w - 0.5} V1324`} fill="none" stroke="#E6DFCA" strokeWidth={1} />);
    });
  }

  // Review copy only: the pink placeholder boxes behind the action lines on pages 14 and 15 follow the larger action boxes
  if (!clean && (page === 14 || page === 15)) {
    const BOXES: { p: number; old: number[]; now: number[] }[] = [
    { p: 14, old: [200, 507, 520, 557], now: [200, 507, 533, 586] },
    { p: 14, old: [840, 699, 1160, 749], now: [840, 699, 1173, 778] },
    { p: 14, old: [200, 957, 520, 1007], now: [200, 957, 533, 1036] },
    { p: 14, old: [840, 1182, 1160, 1232], now: [840, 1182, 1173, 1261] },
    { p: 14, old: [200, 1415, 520, 1464], now: [200, 1415, 533, 1494] },
    { p: 15, old: [203, 538, 605, 596], now: [203, 537, 605, 612] },
    { p: 15, old: [756, 538, 1158, 596], now: [757, 537, 1158, 612] },
    { p: 15, old: [202, 1252, 420, 1310], now: [202, 1251, 433, 1355] },
    { p: 15, old: [571, 1227, 789, 1285], now: [571, 1226, 802, 1330] },
    { p: 15, old: [940, 1227, 1158, 1285], now: [940, 1226, 1171, 1330] },
    ];
    BOXES.filter(b => b.p === page).forEach((b, i) => {
      body.push(<rect key={"po" + i} x={b.old[0] - 3} y={b.old[1] - 3} width={b.old[2] - b.old[0] + 7} height={b.old[3] - b.old[1] + 7} fill="#FFFFFF" />);
      body.push(<rect key={"pn" + i} x={b.now[0]} y={b.now[1]} width={b.now[2] - b.now[0]} height={b.now[3] - b.now[1]} rx={6} fill="#FCE3EC" stroke={MAGENTA} strokeWidth={2} strokeDasharray="7 4" />);
    });
  }

  // Page 5: the three boxes in the dark band sit lower, so each has a heading above it (as on the Strategic report)
  if (page === 5) {
    body.push(<rect key="bandcover" x={118} y={244} width={1040} height={66} fill={NAVY} />);
    [[126, 166], [328, 544], [908, 241]].forEach(([x, w], i) => (
      body.push(<rect key={"bx" + i} x={x} y={264} width={w} height={50} rx={5} fill={clean ? "#FAF6EA" : "#E4E9F2"} stroke={clean ? undefined : NAVY} strokeWidth={clean ? undefined : 2} strokeDasharray={clean ? undefined : "5 5"} />)
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

  // Page 19: the three numbered circles sit beside each decision. The picture's own circles are covered and drawn again at the new places.
  if (page === 19) {
    [274.5, 456.5, 639.5].forEach((oldCy, i) => {
      body.push(<rect key={"p19c" + i} x={78} y={oldCy - 28} width={70} height={56} fill={PAGE_BG} />);
    });
    [0, 1, 2].forEach(i => {
      const cy = P19_CIRCLE_CY[i];
      body.push(<circle key={"p19d" + i} cx={113} cy={cy} r={30} fill={NAVY} />);
      body.push(<text key={"p19n" + i} x={113} y={cy + 11} textAnchor="middle" fontFamily="Lora, serif" fontWeight={700} fontSize={32} fill={GOLD}>{i + 1}</text>);
    });
  }

  // Page 7: the table body is drawn again by the page itself (its rows grow with the wording), as on page 6 of the Strategic report
  if (page === 7) {
    const mk = (fill: string, stroke: string, dash: string, sw = 1) =>
      clean ? { fill: "none", stroke: "none" } : { fill, stroke, strokeWidth: sw, strokeDasharray: dash };
    body.push(<rect key="cover" x={93} y={308} width={1090} height={400} fill={PAGE_BG} />);
    for (let i = 0; i < 5; i++) {
      const y = ROW6_TOP + i * ROW6_H;
      body.push(<rect key={"r" + i} x={93} y={y} width={1089} height={ROW6_H} fill={i % 2 === 0 ? "#FFFFFF" : CREAM} />);
      body.push(<text key={"nr" + i} x={108} y={y + 34} fontFamily={FONT} fontWeight={700} fontSize={17} fill={NAVY}>{i + 1}</text>);
      body.push(<rect key={"g" + i} x={152} y={y + 14} width={200} height={ROW6_H - 28} rx={6} {...mk("#E2F2E6", "#5BAA6E", "5 3")} />);
      body.push(<rect key={"e" + i} x={385} y={y + 14} width={335} height={ROW6_H - 28} rx={6} {...mk("#FBF1CF", "#D9B84A", "5 3")} />);
      body.push(<rect key={"w" + i} x={752} y={y + 14} width={415} height={ROW6_H - 28} rx={6} {...mk("#FCE3EC", MAGENTA, "5 3")} />);
    }
    body.push(<line key="l1" x1={367} y1={ROW6_TOP} x2={367} y2={ROW6_TOP + 5 * ROW6_H} stroke="#E5E0D0" />);
    body.push(<line key="l2" x1={737} y1={ROW6_TOP} x2={737} y2={ROW6_TOP + 5 * ROW6_H} stroke="#E5E0D0" />);
  }

  if (!body.length) return null;
  return (
    <svg viewBox="0 0 1275 1650" preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
      {body}
    </svg>
  );
}
