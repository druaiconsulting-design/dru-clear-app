// Layout of the five pillar pages (SD pages 7 to 11): a full-height navy bar that holds the score ring, the pillar's
// title and its own chart, beside a column of writing. The bar sits on the right of pages 7, 9 and 11 and on the left
// of pages 8 and 10. Every size here is in pixels of the 1275 x 1650 page picture.
// The art (SdPillarArt) and the wording boxes (pillarGeometry) both read their places from this file.

export const W = 1275;
export const H = 1650;
export const S = W / 816; // the approved mock was drawn 816 wide
const m = (v: number) => v * S;

export const NAVY = "#0A2342";
export const GOLD = "#D4AF37";
export const MAGENTA = "#C2185B";
export const PAGE_BG = "#FAFAF8";
export const CREAM = "#F5EFE0";

export type LField = {
  n: string; p: number; x: number; y: number; w: number; h: number; s: number; ctr?: boolean;
  c: string; f: string; wt: number; it: boolean; ml: boolean; d: string; rt?: boolean; fx?: boolean;
  ls?: number; lh?: number; va?: "mid";
};

export const PILLAR_PAGES: Record<number, { pillar: string; right: boolean; num: string }> = {
  7: { pillar: "Clarity", right: true, num: "1" },
  8: { pillar: "Leadership", right: false, num: "2" },
  9: { pillar: "Execution", right: true, num: "3" },
  10: { pillar: "Alignment", right: false, num: "4" },
  11: { pillar: "Results", right: true, num: "5" },
};
export const isPillarPage = (p: number) => p in PILLAR_PAGES;

export type Lay = {
  right: boolean; barX: number; barW: number; inner: number; bx0: number; tw: number; cx: number; cy: number;
  colX: number; colW: number; top: number; bottom: number;
};
export function lay(page: number): Lay {
  const right = PILLAR_PAGES[page].right;
  const barW = m(250);
  const barX = right ? W - barW : 0;
  const inner = right ? barX + m(4) : 0;
  const bx0 = inner + m(30);
  return {
    right, barX, barW, inner, bx0, tw: m(196), cx: inner + m(100), cy: 247,
    colX: right ? m(60) : m(280), colW: m(476), top: 51, bottom: 1599,
  };
}

// Vertical places shared by every pillar page
export const Y = {
  kick: 96, pill: 362.5, title: 410, tag: 512, rule1: 631,
  ahaLab: 94, ahaTop: 129, ahaH: 275,
  ccLab: 428, ccText: 462, ccH: 160,
  firstTop: 648, firstH: 216,
  sigLab: 890, sigTop: 925, sigH: 252,
  qLab: 1203, q: [1237, 1340, 1443], qH: 84,
};
export const COL = { half: m(228), halfR: m(250), halfRW: m(226), pillX: 97 };

// The writing and the fixed words on each pillar page, by role
type Roles = { kick: string; title: string; tag: string; ofn: string; pill: string; aha: string; cc: string; conn: string; first: string; str: string; sig: string; q: [string, string, string] };
export const ROLES: Record<number, Roles> = {
  7: { kick: "sd_0059", title: "sd_0060", tag: "sd_0061", ofn: "sd_0058", pill: "calc_037", aha: "agent_038", cc: "agent_039", conn: "agent_040", first: "agent_041", str: "agent_044", sig: "agent_045", q: ["agent_046", "agent_047", "agent_048"] },
  8: { kick: "sd_0072_L1", title: "sd_0073_L1", tag: "sd_0074_L1", ofn: "sd_0075", pill: "calc_052", aha: "agent_053", cc: "agent_055", conn: "agent_054", first: "agent_056", str: "agent_062", sig: "agent_063", q: ["agent_064", "agent_065", "agent_066"] },
  9: { kick: "sd_0089", title: "sd_0090", tag: "sd_0091", ofn: "sd_0088", pill: "calc_070", aha: "agent_071", cc: "agent_072", conn: "agent_073", first: "agent_074", str: "agent_081", sig: "agent_082", q: ["agent_083", "agent_084", "agent_085"] },
  10: { kick: "sd_0108_L1", title: "sd_0109_L1", tag: "sd_0110_L1", ofn: "sd_0111", pill: "calc_089", aha: "agent_090", cc: "agent_092", conn: "agent_091", first: "agent_093", str: "agent_101", sig: "agent_102", q: ["agent_103", "agent_104", "agent_105"] },
  11: { kick: "sd_0122", title: "sd_0123", tag: "sd_0124", ofn: "sd_0121", pill: "calc_109", aha: "agent_110", cc: "agent_111", conn: "agent_112", first: "agent_113", str: "agent_121", sig: "agent_122", q: ["agent_123", "agent_124", "agent_125"] },
};
type Role = keyof Roles | "q1" | "q2" | "q3";
const BY_NAME: Record<string, { page: number; role: Role }> = {};
Object.entries(ROLES).forEach(([pg, r]) => {
  (Object.keys(r) as (keyof Roles)[]).forEach(k => {
    if (k === "q") r.q.forEach((nm, i) => { BY_NAME[nm] = { page: +pg, role: ("q" + (i + 1)) as Role }; });
    else BY_NAME[r[k] as string] = { page: +pg, role: k };
  });
});

// Place a box from pixel values
function G(f: LField, o: { x: number; y: number; w: number; h: number; px: number } & Partial<LField>): LField {
  const { x, y, w, h, px, ...rest } = o;
  return { ...f, x: (x / W) * 100, y: (y / H) * 100, w: (w / W) * 100, h: (h / H) * 100, s: (px / W) * 100, ...rest };
}

// ---------------------------------------------------------------- page 9 (Execution): the bar's stack of tiles
export type Exec9 = { head: number; cap: number; pilot: number; r1: number | null; r2: number | null; r3: number | null; h1: number; h2: number; h3: number; line: number; cost: number; rule3: number };
export function exec9(hasRegions: boolean, hasObstacle: boolean, hasStage: boolean): Exec9 {
  const gap = 12;
  let y = 800;
  const h1 = 124, h2 = 100, h3 = 100;
  const r1 = hasRegions ? y : null; if (hasRegions) y += h1 + gap;
  const r2 = hasObstacle ? y : null; if (hasObstacle) y += h2 + gap;
  const r3 = hasStage ? y : null; if (hasStage) y += h3 + gap;
  return { head: 655, cap: 708, pilot: 764, r1, r2, r3, h1, h2, h3, line: y + 6, cost: y + 150, rule3: y + 138 };
}

// ---------------------------------------------------------------- page 10 (Alignment): the departments list
export function align10(depCount: number) {
  const n = Math.max(depCount, 1);
  const pitch = Math.min(58, 400 / n);
  const top = 722;
  const totalY = top + n * pitch + 8;
  return { top, pitch, totalY, objRule: totalY + 62, objLab: totalY + 84 };
}

// ---------------------------------------------------------------- page 11 (Results): the initiatives
export function results11(count: number) {
  const n = Math.max(count, 1);
  const pitch = Math.min(84, 420 / n);
  const top = 735;
  return { top, pitch, totalY: top + n * pitch + 14 };
}

export type Ctx = { numbers?: any; client_answers?: { framework: string; pillar: string; order: number; answer: string }[]; client_texts?: { field: string; value: string }[] };

export function execFlags(c: Ctx) {
  const ans = (o: number) => (c.client_answers ?? []).find(a => a.framework === "CLEAR" && a.pillar === "Execution" && a.order === o)?.answer ?? "";
  return { hasRegions: c.numbers?.execution?.regions_reached != null, hasObstacle: !!ans(1), hasStage: !!ans(3) };
}

// Where a wording box sits on a pillar page. null = the box is not used on the new layout. undefined = not a pillar page.
export function pillarGeometry(f: LField, ctx: Ctx): LField | null | undefined {
  if (!isPillarPage(f.p)) return undefined;
  const L = lay(f.p);
  const page = f.p;
  const hit = BY_NAME[f.n];
  const white = "#FFFFFF";
  const soft = "#E4E8EF";

  if (hit && hit.page === page) {
    switch (hit.role) {
      case "kick": return G(f, { x: L.bx0, y: Y.kick, w: L.tw, h: 22, px: m(8.5), c: GOLD, fx: true, ml: false, ls: 0.08 });
      case "ofn": return G(f, { x: L.cx - 60, y: 262, w: 120, h: 24, px: m(11), c: "#C9D1DE", fx: true, ctr: true, ml: false });
      case "pill": return G(f, { x: L.bx0, y: Y.pill, w: m(90), h: m(20), px: m(8), c: white, fx: true, ctr: true, ml: false, ls: 0.1 });
      case "title": return G(f, { x: L.bx0 - m(2), y: Y.title, w: m(190), h: 98, px: m(46), c: white, fx: true, ml: true, lh: 1.2, f: "Lora", wt: 700, it: false });
      case "tag": return G(f, { x: L.bx0, y: Y.tag, w: m(190), h: 96, px: m(13), c: PAGE_BG, fx: true, ml: true, lh: 1.35, f: "Lora", wt: 400, it: true });
      case "aha": return G(f, { x: L.colX + m(4) + m(16), y: Y.ahaTop + m(14), w: L.colW - m(4) - m(16) - m(66), h: Y.ahaH - m(28), px: m(11), ml: true, lh: 1.55 });
      case "cc": return G(f, { x: L.colX, y: Y.ccText, w: COL.half, h: Y.ccH, px: m(11), ml: true, lh: 1.55 });
      case "conn": return G(f, { x: L.colX + COL.halfR, y: Y.ccText, w: COL.halfRW, h: Y.ccH, px: m(11), ml: true, lh: 1.55 });
      case "first": {
        const tx = L.right ? L.colX + m(6) + m(20) : L.colX + m(70);
        return G(f, { x: tx, y: Y.firstTop + m(16) + 20 + m(7), w: L.colW - m(6) - m(20) - m(70), h: Y.firstH - m(16) * 2 - 20 - m(7), px: m(11), ml: true, lh: 1.55 });
      }
      case "str": return G(f, { x: L.colX + 1.6 + m(16), y: Y.sigTop + 3 + m(14), w: COL.half - 3.2 - m(32), h: Y.sigH - 3 - m(14) * 2, px: m(11), ml: true, lh: 1.55 });
      case "sig": return G(f, { x: L.colX + COL.halfR + 1.6 + m(16), y: Y.sigTop + 3 + m(14), w: COL.half - 3.2 - m(32), h: Y.sigH - 3 - m(14) - 64 - 20, px: m(11), ml: true, lh: 1.55 });
      case "q1": case "q2": case "q3": {
        const i = +hit.role.slice(1) - 1;
        return G(f, { x: L.colX + COL.pillX, y: Y.q[i] + 6, w: L.colW - COL.pillX - m(20), h: Y.qH - 12, px: m(10.5), ml: true, lh: 1.35, va: "mid" });
      }
    }
  }

  // Everything else on these pages sits in the bar. The words are white or gold on navy and keep their colour in the client copy.
  const bx = L.bx0, tw = L.tw;
  const lab = (y: number, h = 44) => G(f, { x: bx, y, w: tw, h, px: m(8), c: GOLD, fx: true, ml: true, ls: 0.06, lh: 1.35, wt: 700 });
  const small = (y: number, h = 24, wt = 400) => G(f, { x: bx, y, w: tw, h, px: m(9), c: soft, fx: true, ml: false, wt });
  const figure = (y: number, h = 44, px = m(19), ml = false) => G(f, { x: bx, y, w: tw, h, px, c: GOLD, fx: true, ml, f: "Lora", wt: 700, it: false, lh: 1.25 });

  if (page === 7) {
    switch (f.n) {
      case "sd_0062": return lab(655);
      case "sd_0063": return small(716, 24, 400);
      case "answer_042": return figure(740, 44);
      case "sd_0064": return small(806, 24, 400);
      case "calc_043": return figure(830, 84, m(19), true);
    }
  }
  if (page === 8) {
    const tileW = (tw - 2 * m(6)) / 3;
    const tile = (i: number) => bx + i * (tileW + m(6));
    switch (f.n) {
      case "sd_0077": return lab(656, 42);
      case "answer_057": case "answer_058": case "answer_059": {
        const i = ["answer_057", "answer_058", "answer_059"].indexOf(f.n);
        return G(f, { x: tile(i), y: 730, w: tileW, h: 36, px: m(18), c: GOLD, fx: true, ctr: true, ml: false, f: "Lora", wt: 700, it: false });
      }
      case "sd_0078_L1": case "sd_0079_L1": case "sd_0080_L1": {
        const i = ["sd_0078_L1", "sd_0079_L1", "sd_0080_L1"].indexOf(f.n);
        return G(f, { x: tile(i) + 3, y: 766, w: tileW - 6, h: 34, px: m(7.5), c: PAGE_BG, fx: true, ctr: true, ml: true, lh: 1.2 });
      }
      case "sd_p8_across": return small(826, 24, 400);
      case "calc_061": return figure(850, 34, m(15));
      case "sd_0076": return lab(960, 42);
      case "answer_060": return figure(L8_COUNT_Y(ctx), 36, m(15));
    }
  }
  if (page === 9) {
    const fl = execFlags(ctx);
    const e = exec9(fl.hasRegions, fl.hasObstacle, fl.hasStage);
    switch (f.n) {
      case "answer_067": return G(f, { x: bx, y: e.head, w: tw, h: 50, px: m(22), c: GOLD, fx: true, ml: false, f: "Lora", wt: 700, it: false });
      case "answer_068": return G(f, { x: bx, y: e.cap, w: tw, h: 46, px: m(9), c: PAGE_BG, fx: true, ml: true, lh: 1.35 });
      case "answer_080": return G(f, { x: bx, y: e.pilot, w: tw, h: 26, px: m(10.5), c: white, fx: true, ml: false, wt: 700 });
      case "sd_0092_L1": return e.r1 == null ? null : G(f, { x: bx + 14, y: e.r1 + 12, w: tw - 28, h: 22, px: m(8), c: GOLD, fx: true, ml: false, ls: 0.08, wt: 700 });
      case "sd_0093_L1": return e.r1 == null ? null : G(f, { x: bx + 14, y: e.r1 + 36, w: tw - 28, h: 48, px: m(24), c: white, fx: true, ctr: true, ml: false, f: "Lora", wt: 700, it: false });
      case "sd_0093_L2": return e.r1 == null ? null : G(f, { x: bx + 14, y: e.r1 + 88, w: tw - 28, h: 24, px: m(9), c: soft, fx: true, ctr: true, ml: false });
      case "sd_0094_L1": return e.r2 == null ? null : G(f, { x: bx + 14, y: e.r2 + 12, w: tw - 28, h: 22, px: m(8), c: GOLD, fx: true, ml: false, ls: 0.08, wt: 700 });
      case "answer_075": return e.r2 == null ? null : G(f, { x: bx + 14, y: e.r2 + 38, w: tw - 28, h: e.h2 - 46, px: m(10), c: white, fx: true, ml: true, lh: 1.3 });
      case "sd_0095_L1": return e.r3 == null ? null : G(f, { x: bx + 14, y: e.r3 + 12, w: tw - 28, h: 22, px: m(8), c: GOLD, fx: true, ml: false, ls: 0.08, wt: 700 });
      case "answer_076": return e.r3 == null ? null : G(f, { x: bx + 14, y: e.r3 + 38, w: tw - 28, h: e.h3 - 46, px: m(10), c: white, fx: true, ml: true, lh: 1.3 });
      case "answer_077": return G(f, { x: bx, y: e.line, w: tw, h: 138, px: m(9.5), c: PAGE_BG, fx: true, ml: true, lh: 1.45 });
      case "sd_0098": return lab(e.cost, 62);
      case "sd_0099": return small(e.cost + 66);
      case "answer_078": return figure(e.cost + 90, 40);
      case "sd_0100": return small(e.cost + 136);
      case "calc_079": return figure(e.cost + 160, 40);
    }
  }
  if (page === 10) {
    const a = align10((ctx.numbers?.alignment?.departments ?? []).length);
    // the client's own objective may run to a few lines, so the note beneath it starts below however many it takes
    const objText = (ctx.client_answers ?? []).find(x => x.framework === "CLEAR" && x.pillar === "Alignment" && x.order === 1)?.answer ?? "";
    const objH = Math.min(6, Math.max(1, Math.ceil(objText.length / 27)));
    switch (f.n) {
      case "sd_0112": return lab(655, 62);
      case "sd_0113": return lab(a.objLab, 62);
      case "answer_099": return G(f, { x: bx, y: a.objLab + 66, w: tw, h: objH * 22 + 8, px: m(10.5), c: white, fx: true, ml: true, lh: 1.4, wt: 700 });
      case "agent_100": return G(f, { x: bx, y: a.objLab + 66 + objH * 22 + 26, w: tw, h: 150, px: m(9.5), c: PAGE_BG, fx: true, ml: true, lh: 1.45 });
    }
  }
  if (page === 11) {
    if (f.n === "sd_0125") return lab(655, 62);
  }
  return null;
}

// "3 of 10" sits under the leader icons; the icons' rows are set by the leader count
export function leaders8(total: number) {
  const cols = total <= 10 ? 5 : total <= 24 ? 8 : 12;
  const pitchMock = Math.min(38, 190 / cols);
  const rows = Math.max(Math.ceil(total / cols), 1);
  const rowPitch = Math.min(36, pitchMock * 0.95) * S;
  return { cols, pitch: pitchMock * S, scale: (pitchMock / 38) * S, rows, rowPitch, top: 1025 };
}
function L8_COUNT_Y(ctx: Ctx) {
  const t = Number(ctx.numbers?.leadership?.leaders_total) || 10;
  const g = leaders8(t);
  return g.top + g.rows * g.rowPitch + 18;
}
