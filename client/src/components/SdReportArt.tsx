// Charts and pictures on the SD report pages, drawn from the client's own numbers.
// Each page picture (the page background) holds the fixed design. Every part that changes per client is covered
// here and drawn again from the calculator figures. Coordinates are in pixels of the 1275 x 1650 page pictures.

const NAVY = "#0A2342";
const MAGENTA = "#C2185B";
const GOLD = "#D4AF37";
const TRACK = "#E9E4D4";
const PAGE_BG = "#FAFAF8";
const CREAM = "#F5EFE0";
const FONT = "Poppins, 'Segoe UI', sans-serif";

export type ArtReport = { numbers: any; first_name?: string | null };

const pillarColor = (score: number) => (score >= 12 ? NAVY : MAGENTA);
const money = (n: number) => "$" + Number(n).toLocaleString("en-US");

function Person({ cx, top, scale, filled }: { cx: number; top: number; scale: number; filled: boolean }) {
  const s = scale;
  const headR = 5.5 * s;
  const bodyW = 11 * s;
  const bodyTop = top + 14 * s;
  const bodyBottom = top + 22 * s + 4 * s;
  const common = filled ? { fill: NAVY, stroke: NAVY } : { fill: "none", stroke: MAGENTA };
  return (
    <g strokeWidth={2.2 * Math.max(s, 0.7)}>
      <circle cx={cx} cy={top + 6 * s} r={headR} {...common} />
      <path d={`M ${cx - bodyW} ${bodyBottom} A ${bodyW} ${bodyBottom - bodyTop} 0 0 1 ${cx + bodyW} ${bodyBottom} Z`} {...common} />
    </g>
  );
}

const PINK_FILL = "#FCE3EC", PINK = "#C2185B", CREAM_PG15 = "#F5EFE0";

function Ring({ cx, cy, score }: { cx: number; cy: number; score: number }) {
  const R = 63.5, C = 2 * Math.PI * R;
  const frac = Math.max(0, Math.min(1, score / 15));
  const a = (12 / 15) * 2 * Math.PI; // the gap line at 12
  const x1 = cx + 52 * Math.sin(a), y1 = cy - 52 * Math.cos(a);
  const x2 = cx + 80 * Math.sin(a), y2 = cy - 80 * Math.cos(a);
  return (
    <g>
      <rect x={cx - 82} y={cy - 82} width={164} height={164} fill="#FFFFFF" />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={TRACK} strokeWidth={15} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={pillarColor(score)} strokeWidth={15}
        strokeDasharray={`${frac * C} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GOLD} strokeWidth={4.5} />
      <text x={cx} y={cy + 8} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={36} fill={NAVY}>{score}</text>
    </g>
  );
}

export default function SdReportArt({ page, report }: { page: number; report: ArtReport }) {
  const n = report.numbers ?? {};
  const pillars = n.pillars ?? {};
  const score = (p: string): number => Number(pillars[p]?.score ?? 0);
  const body: JSX.Element[] = [];

  // Cover and page 5: the client's achievement picture
  if ((page === 1 || page === 5) && n.badge) {
    const src = `/report-badges/${String(n.badge).toLowerCase()}.png`;
    if (page === 1) {
      body.push(<image key="b" href={src} x={290} y={661} width={698} height={363} preserveAspectRatio="xMidYMid slice" />);
    } else {
      body.push(<rect key="bg" x={100} y={211} width={1080} height={506} fill={NAVY} />);
      body.push(<image key="b" href={src} x={158} y={211} width={964} height={506} preserveAspectRatio="xMidYMid meet" />);
    }
  }

  // Page 4: five pillar bars, lowest-to-highest scale 3 to 15 with the gap line at 12
  if (page === 4 && Object.keys(pillars).length) {
    body.push(<rect key="cover" x={256} y={396} width={522} height={236} fill={PAGE_BG} />);
    const ys = [402, 450, 498, 546, 594];
    ["Clarity", "Leadership", "Execution", "Alignment", "Results"].forEach((p, i) => {
      const sc = score(p);
      const w = (Math.max(sc - 3, 0) / 12) * 507;
      body.push(<rect key={"t" + i} x={264} y={ys[i]} width={507} height={31} rx={6} fill={TRACK} />);
      if (w > 0) body.push(<rect key={"f" + i} x={264} y={ys[i]} width={Math.max(w, 6)} height={31} rx={6} fill={pillarColor(sc)} />);
    });
    body.push(<line key="gl" x1={644} y1={382} x2={644} y2={632} stroke={GOLD} strokeOpacity={0.65} strokeWidth={2} strokeDasharray="7 5" />);
  }

  // Pillar pages: the score ring
  const ringPages: Record<number, { pillar: string; cx: number }> = {
    7: { pillar: "Clarity", cx: 210 }, 8: { pillar: "Leadership", cx: 1019 }, 9: { pillar: "Execution", cx: 210 },
    10: { pillar: "Alignment", cx: 1019 }, 11: { pillar: "Results", cx: 210 },
  };
  if (ringPages[page] && pillars[ringPages[page].pillar]) {
    body.push(<Ring key="ring" cx={ringPages[page].cx} cy={215.5} score={score(ringPages[page].pillar)} />);
  }

  // Page 8: one person icon for every leader on the team, filled for the leaders who can state the strategy
  if (page === 8 && n.leadership) {
    const total = Number(n.leadership.leaders_total) || 0;
    const filled = Number(n.leadership.leaders_who_can) || 0;
    body.push(<rect key="cover" x={118} y={402} width={532} height={68} fill={CREAM} />);
    const pitch = Math.min(51.5, 600 / Math.max(total, 1));
    const sc = Math.min(1, pitch / 40);
    for (let i = 0; i < total; i++) {
      body.push(<Person key={"p" + i} cx={146 + i * pitch} top={412} scale={sc} filled={i < filled} />);
    }
  }

  // Page 12: the law statement is a sentence, so its box is drawn wider than the baked one
  if (page === 12) {
    [15.4508, 31.2563, 46.1907, 62.4318, 77.8018].forEach((pct, i) => {
      const fy = (pct / 100) * 1650;
      body.push(<rect key={"lc" + i} x={897} y={fy - 9} width={270} height={40} fill="#FFFFFF" />);
      body.push(<rect key={"ln" + i} x={779} y={fy - 10} width={382} height={48} rx={6} fill={PINK_FILL} stroke={PINK} strokeWidth={2} strokeDasharray="7 5" />);
    });
  }

  // Page 15: each stage has an actions box and a checkpoint box, drawn at the sizes the wording needs
  if (page === 15) {
    [107, 327, 547, 767, 987].forEach((x, i) => {
      body.push(<rect key={"sc" + i} x={x - 6} y={414} width={193} height={570} fill={CREAM_PG15} />);
      body.push(<rect key={"sa" + i} x={x - 2} y={420} width={185} height={378} rx={6} fill={PINK_FILL} stroke={PINK} strokeWidth={2} strokeDasharray="7 5" />);
      body.push(<rect key={"sk" + i} x={x - 2} y={806} width={185} height={162} rx={6} fill={PINK_FILL} stroke={PINK} strokeWidth={2} strokeDasharray="7 5" />);
    });
  }

  // Page 9: the pre-session asks one obstacle question, so there is one "Blocked by" tile and the "Awaiting" tile moves up beside it
  if (page === 9) {
    body.push(<rect key="obs" x={237} y={456} width={134} height={46} rx={5} fill="#FBF1CF" stroke="#D9B84A" strokeDasharray="5 3" />);
    body.push(<rect key="rgc" x={118} y={502} width={510} height={58} fill={CREAM} />);
    body.push(<rect key="rg" x={126} y={508} width={491} height={46} rx={5} fill="#FBF1CF" stroke="#D9B84A" strokeDasharray="5 3" />);
    body.push(<rect key="t3c" x={380} y={398} width={274} height={116} fill={CREAM} />);
    body.push(<rect key="t3" x={388.5} y={410.5} width={100} height={91} rx={3} fill="#FFFFFF" stroke={PINK} strokeWidth={3} strokeDasharray="9 6" />);
  }

  // Page 10: the departments and their hours, as many rows as the client typed
  if (page === 10 && n.alignment) {
    const deps: { department: string; hours: number }[] = n.alignment.departments ?? [];
    body.push(<rect key="cover" x={118} y={402} width={430} height={244} fill={CREAM} />);
    const pitch = Math.min(44, 172 / Math.max(deps.length, 1));
    const h = Math.max(pitch - 14, 20);
    deps.forEach((d, i) => {
      const y = 410 + i * pitch;
      body.push(<rect key={"n" + i} x={126} y={y} width={261} height={h} rx={5} fill="#FBF1CF" stroke="#D9B84A" strokeDasharray="5 3" />);
      body.push(<text key={"nt" + i} x={138} y={y + h / 2 + 5} fontFamily={FONT} fontSize={15} fill="#7A5C00">{d.department}</text>);
      body.push(<rect key={"h" + i} x={406} y={y} width={121} height={h} rx={5} fill="#FBF1CF" stroke="#D9B84A" strokeDasharray="5 3" />);
      body.push(<text key={"ht" + i} x={418} y={y + h / 2 + 5} fontFamily={FONT} fontSize={15} fill="#7A5C00">{d.hours}</text>);
    });
    const ty = 410 + deps.length * pitch + 4;
    body.push(<rect key="tb" x={126} y={ty} width={401} height={h} rx={5} fill="#E2F2E6" stroke="#5BAA6E" strokeDasharray="5 3" />);
    body.push(<text key="tt" x={138} y={ty + h / 2 + 5} fontFamily={FONT} fontSize={15} fill="#2E7D46">{n.alignment.total_hours} hours in total</text>);
  }

  // Page 11: each initiative's value as a bar, sized by its share of the total
  if (page === 11 && n.results) {
    const inits: { initiative: number; value: number }[] = n.results.initiatives ?? [];
    const total = Number(n.results.total_value) || 1;
    body.push(<rect key="cover" x={118} y={398} width={500} height={166} fill={CREAM} />);
    const pitch = Math.min(37, 110 / Math.max(inits.length, 1));
    const h = Math.max(pitch - 7, 14);
    inits.forEach((it, i) => {
      const y = 405 + i * pitch;
      const w = Math.max((it.value / total) * 301, 6);
      body.push(<text key={"l" + i} x={130} y={y + h / 2 + 5} fontFamily={FONT} fontWeight={700} fontSize={Math.min(15, h * 0.7)} fill={NAVY}>{`Initiative ${it.initiative}`}</text>);
      body.push(<rect key={"t" + i} x={300} y={y} width={301} height={h} rx={5} fill={TRACK} />);
      body.push(<rect key={"b" + i} x={300} y={y} width={w} height={h} rx={5} fill={MAGENTA} />);
      const label = money(it.value);
      const inside = w > 80;
      body.push(<text key={"v" + i} x={inside ? 308 : 300 + w + 8} y={y + h / 2 + 5} fontFamily={FONT} fontWeight={700} fontSize={Math.min(14, h * 0.65)} fill={inside ? "#FFFFFF" : NAVY}>{label}</text>);
    });
    const ty = 405 + inits.length * pitch + 8;
    body.push(<rect key="tb" x={126} y={ty} width={475} height={30} rx={5} fill="#E2F2E6" stroke="#5BAA6E" strokeDasharray="5 3" />);
    body.push(<text key="tt" x={138} y={ty + 20} fontFamily={FONT} fontSize={15} fill="#2E7D46">{money(n.results.total_value)} in total</text>);
  }

  // Page 13: the five circles, navy for a strength and magenta for a gap
  if (page === 13 && Object.keys(pillars).length) {
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

  // Page 6: the table body is drawn again by the page itself (its rows grow with the wording)
  if (page === 6) {
    body.push(<rect key="cover" x={93} y={308} width={1090} height={400} fill={PAGE_BG} />);
    for (let i = 0; i < 5; i++) {
      const y = ROW6_TOP + i * ROW6_H;
      body.push(<rect key={"r" + i} x={93} y={y} width={1089} height={ROW6_H} fill={i % 2 === 0 ? "#FFFFFF" : CREAM} />);
      body.push(<text key={"nr" + i} x={108} y={y + 34} fontFamily={FONT} fontWeight={700} fontSize={17} fill={NAVY}>{i + 1}</text>);
      body.push(<rect key={"g" + i} x={152} y={y + 14} width={200} height={ROW6_H - 28} rx={6} fill="#E2F2E6" stroke="#5BAA6E" strokeDasharray="5 3" />);
      body.push(<rect key={"e" + i} x={385} y={y + 14} width={335} height={ROW6_H - 28} rx={6} fill="#FBF1CF" stroke="#D9B84A" strokeDasharray="5 3" />);
      body.push(<rect key={"w" + i} x={752} y={y + 14} width={415} height={ROW6_H - 28} rx={6} fill="#FCE3EC" stroke={MAGENTA} strokeDasharray="5 3" />);
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

// Page 6 table geometry, shared with the page so the wording boxes sit inside the drawn cells.
export const ROW6_TOP = 308;
export const ROW6_H = 170;
