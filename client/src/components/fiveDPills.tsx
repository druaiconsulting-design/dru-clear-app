// The word labels under each level name on the 5D Leadership Reflection page (page 12 of the Strategic report, page 13 of the Executive report).
// Each level shows the words from the website. The pictures hold the old boxes, so they are covered here and the new boxes are drawn.
const GOLD = "#D4AF37";
const BOX_FILL = "#F5EFE0";

// The five 5D levels: where each row of word labels sits (top of the box, then x and width of each label),
// drawn in the same place on the Strategic and Executive pages.
export const FIVE_D_PILLS: [number, [number, number][]][] = [[257, [[246, 175], [428, 188]]], [518, [[282, 151], [440, 119], [566, 105]]], [764, [[280, 108], [395, 68], [470, 148]]], [1018, [[376, 166], [549, 228], [784, 196]]], [1286, [[321, 158], [486, 116]]]];

// Where the old labels and the old law box sat in the page pictures (top of each level's row).
const OLD_TOPS: [number, number][] = [[255, 281], [516, 542], [762, 788], [1016, 1070], [1284, 1310]];
const LAW_COVER: [number, number][] = [[241, 292], [502, 553], [748, 799], [1016, 1067], [1270, 1321]];

export function fiveDPillShapes(): JSX.Element[] {
  const out: JSX.Element[] = [];
  OLD_TOPS.forEach(([y0, y1], i) => {
    out.push(<rect key={"pc" + i} x={238} y={y0} width={528} height={y1 - y0} fill="#FFFFFF" />);
    out.push(<rect key={"lc" + i} x={770} y={LAW_COVER[i][0]} width={400} height={LAW_COVER[i][1] - LAW_COVER[i][0]} fill="#FFFFFF" />);
  });
  FIVE_D_PILLS.forEach(([top, row], i) => {
    row.forEach(([x, w], k) => {
      out.push(<rect key={"pb" + i + "_" + k} x={x + 0.75} y={top + 0.75} width={w - 1.5} height={21.5} fill={BOX_FILL} stroke={GOLD} strokeWidth={1.5} />);
    });
  });
  return out;
}
