/** One page fills the cloud with twelve cards, or the list's matching stack of ten — a compact row
 *  holds more than a card does. */
export const CLOUD_PAGE_SIZE = 12;
export const LIST_PAGE_SIZE = 10;

/** The cloud is always four columns of three — used to know which slots sit in the same column. */
const CLOUD_GRID_COLUMNS = 4;
export const CLOUD_GRID_ROWS = CLOUD_PAGE_SIZE / CLOUD_GRID_COLUMNS;

/** How far a card can be pulled right from its cell's left edge, as a percent of the cell's width —
 *  its own width is 70%, so up to 30% of the cell is free to shift into. */
export const CLOUD_MAX_OFFSET_PERCENT = 30;

/** The least two vertically stacked cards in the same column are ever allowed to differ by — below
 *  this, a card gets nudged aside so the column never reads as a straight stack of edges. */
export const CLOUD_MIN_COLUMN_GAP_PERCENT = 10;

/** Where one card sits inside its grid cell: a left offset, never a fixed slot — always level and
 *  never nudged up or down, so every card stays upright and every row reads as a straight line. */
export type CloudSlotStyle = { offsetPercent: number };

/** A small seeded PRNG (mulberry32) — deterministic, so a layout never reshuffles on re-render. */
function mulberry32(seed: number) {
  let state = seed;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The three offsets for one column, at least `CLOUD_MIN_COLUMN_GAP_PERCENT` apart by construction
 * rather than by retrying a random draw until it happens to clear that gap — with three rows sharing
 * a 0–30 range and a required 10-point gap, rejecting-and-redrawing can run out of attempts before it
 * finds a spot, which is exactly what let two rows in the same column land on top of each other
 * before. Instead: draw `CLOUD_GRID_ROWS` values in whatever's left over once the gaps themselves are
 * reserved, sort them, and lay them out back to back with the gaps between — which mathematically
 * cannot place any two closer than the gap — then shuffle which row gets which resulting position.
 */
export function buildColumnOffsets(random: () => number): number[] {
  const slack = CLOUD_MAX_OFFSET_PERCENT - (CLOUD_GRID_ROWS - 1) * CLOUD_MIN_COLUMN_GAP_PERCENT;
  const spaced = Array.from({ length: CLOUD_GRID_ROWS }, () => random() * slack)
    .sort((a, b) => a - b)
    .map((value, rank) => value + rank * CLOUD_MIN_COLUMN_GAP_PERCENT);

  for (let index = spaced.length - 1; index > 0; index--) {
    const swapWith = Math.floor(random() * (index + 1));
    [spaced[index], spaced[swapWith]] = [spaced[swapWith], spaced[index]];
  }
  return spaced;
}

/** One set of twelve left-offsets, built column by column so every column gets its own guaranteed
 *  spread rather than being assembled from independently-drawn rows. */
function buildCandidateOffsets(random: () => number, slotCount: number): number[] {
  const offsets: number[] = new Array<number>(slotCount);
  for (let columnIndex = 0; columnIndex < CLOUD_GRID_COLUMNS; columnIndex++) {
    buildColumnOffsets(random).forEach((offset, rowIndex) => {
      offsets[rowIndex * CLOUD_GRID_COLUMNS + columnIndex] = offset;
    });
  }
  return offsets;
}

/** How unlike two arrangements are, checked both as they are and mirrored left-right — a pair that
 *  merely looks flipped is just as much a repeat, to the eye, as an outright duplicate. */
function offsetSetDistance(a: number[], b: number[]): number {
  let direct = 0;
  let mirrored = 0;
  for (let index = 0; index < a.length; index++) {
    direct += Math.abs(a[index] - b[index]);
    mirrored += Math.abs(a[index] - (CLOUD_MAX_OFFSET_PERCENT - b[index]));
  }
  return Math.min(direct, mirrored) / a.length;
}

/**
 * Five fixed arrangements for a full page, not one regenerated at random on every render —
 * regenerating would make cards jump every time something unrelated re-renders the page. Sampling
 * five independent arrangements occasionally left two that read as the same shape, or as a mirror of
 * one another, so instead this draws a larger pool from one continuous PRNG stream and greedily
 * keeps whichever candidate is least like anything already picked, guaranteeing all five stay
 * visibly distinct from each other (and from their own left-right flip).
 */
export function buildCloudLayouts(
  layoutCount: number,
  slotCount: number,
  candidatePoolSize: number,
): CloudSlotStyle[][] {
  const random = mulberry32(20240917);
  const candidates = Array.from({ length: candidatePoolSize }, () =>
    buildCandidateOffsets(random, slotCount),
  );

  const selected = [candidates[0]];
  while (selected.length < layoutCount) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    candidates.forEach((candidate, index) => {
      if (selected.includes(candidate)) return;
      const score = Math.min(...selected.map((chosen) => offsetSetDistance(candidate, chosen)));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    selected.push(candidates[bestIndex]);
  }

  return selected.map((offsets) =>
    offsets.map((offsetPercent) => ({ offsetPercent: Math.round(offsetPercent * 10) / 10 })),
  );
}

export const CLOUD_LAYOUTS: CloudSlotStyle[][] = buildCloudLayouts(5, CLOUD_PAGE_SIZE, 40);
