// Charts and pictures on the SD report pages, drawn from the client's own numbers.
// Each page picture (the page background) holds the fixed design. Every part that changes per client is covered
// here and drawn again from the calculator figures. Coordinates are in pixels of the 1275 x 1650 page pictures.

import { fiveDPillShapes } from "./fiveDPills";
import pillarArt from "./SdPillarArt";
import { isPillarPage } from "../data/sdPillarLayout";

const NAVY = "#0A2342";
const MAGENTA = "#C2185B";
const GOLD = "#D4AF37";
const TRACK = "#E9E4D4";
const PAGE_BG = "#FAFAF8";
const CREAM = "#F5EFE0";
const FONT = "Poppins, 'Segoe UI', sans-serif";

export type ArtReport = { numbers: any; first_name?: string | null; client_answers?: { framework: string; pillar: string; order: number; answer: string }[] };

const pillarColor = (score: number) => (score >= 12 ? NAVY : MAGENTA);
const money = (n: number) => "$" + Number(n).toLocaleString("en-US");

const PINK_FILL = "#FCE3EC", PINK = "#C2185B", CREAM_PG15 = "#F5EFE0";

export default function SdReportArt({ page, report, clean = false }: { page: number; report: ArtReport; clean?: boolean }) {
  // The review page draws dashed marker boxes where wording goes. The client copy draws none of them.
  // keep = a light plate that stays (on a dark band or a gold tile), drawn solid.
  const mk = (fill: string, stroke: string, dash: string, sw = 1, keep = false) =>
    clean ? (keep ? { fill, stroke: "none" } : { fill: "none", stroke: "none" }) : { fill, stroke, strokeWidth: sw, strokeDasharray: dash };
  const PAGES = clean ? "/report-pages-clean/" : "/report-pages/";
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

  // Page 4: five pillar bars, scale 1 to 15 with the gap line at 12
  if (page === 4 && Object.keys(pillars).length) {
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

  // Pillar pages 7 to 11: the bar, ring, chart, cards and question rows
  if (isPillarPage(page)) pillarArt(page, report).forEach(e => body.push(e));

  // Page 1: the legend of slot types is for the working copy only
  if (page === 1) {
    body.push(<rect key="lg" x={150} y={1408} width={975} height={110} fill={PAGE_BG} />);
  }

  // Pages 2 to 16: the footer carries the copyright line and the page number
  if (page >= 2) {
    body.push(<rect key="ft" x={200} y={1604} width={875} height={40} fill={NAVY} />);
    body.push(<text key="ftt" x={637.5} y={1628} textAnchor="middle" fontFamily={FONT} fontSize={13} fill="#FFFFFF">{`© 2026 DRU AI Consulting · Confidential | Page ${page} / 16`}</text>);
  }

  // Page 4: the banner is redrawn so its heading words are large enough to read
  if (page === 4) {
    body.push(<rect key="bn" x={98} y={236} width={1078} height={78} fill={NAVY} />);
    [[136, 146], [338, 524], [918, 221]].forEach(([x, w], i) => {
      body.push(<rect key={"bx" + i} x={x} y={268} width={w} height={42} rx={5} {...mk("#E4E9F2", "#3B4F69", "5 3", 1.5, true)} />);
    });
  }

  // Page 12: each level shows the website's words as labels, drawn here in place of the old boxes and law line
  if (page === 12) fiveDPillShapes().forEach(e => body.push(e));

  // Page 15: each stage has an actions box and a checkpoint box, drawn at the sizes the wording needs
  if (page === 15) {
    [107, 327, 547, 767, 987].forEach((x, i) => {
      body.push(<rect key={"sc" + i} x={x - 6} y={414} width={193} height={570} fill={CREAM_PG15} />);
      body.push(<rect key={"sa" + i} x={x - 2} y={420} width={185} height={378} rx={6} {...mk(PINK_FILL, PINK, "7 5", 2)} />);
      body.push(<rect key={"sk" + i} x={x - 2} y={806} width={185} height={162} rx={6} {...mk(PINK_FILL, PINK, "7 5", 2)} />);
    });
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

// Page 6 table geometry, shared with the page so the wording boxes sit inside the drawn cells.
export const ROW6_TOP = 308;
export const ROW6_H = 170;
