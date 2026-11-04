import { describe, expect, it } from "vitest";
import {
  buildCloudLayouts,
  buildColumnOffsets,
  CLOUD_GRID_ROWS,
  CLOUD_LAYOUTS,
  CLOUD_MAX_OFFSET_PERCENT,
  CLOUD_MIN_COLUMN_GAP_PERCENT,
  CLOUD_PAGE_SIZE,
} from "../../../../src/features/starter-work/components/pool/cloudLayout";

const COLUMNS = 4;

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("buildColumnOffsets", () => {
  it("keeps every pair of rows at least the minimum gap apart, whatever the draw", () => {
    for (const draw of [0, 0.5, 0.999, 0.3]) {
      const offsets = buildColumnOffsets(() => draw);
      const sorted = [...offsets].sort((a, b) => a - b);
      for (let index = 1; index < sorted.length; index++) {
        expect(sorted[index] - sorted[index - 1]).toBeGreaterThanOrEqual(
          CLOUD_MIN_COLUMN_GAP_PERCENT - 1e-9,
        );
      }
    }
  });

  it("stays inside the card's free range", () => {
    for (const draw of [0, 1 - Number.EPSILON]) {
      for (const offset of buildColumnOffsets(() => draw)) {
        expect(offset).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(CLOUD_MAX_OFFSET_PERCENT);
      }
    }
  });

  it("gives one offset per row and shuffles which row gets which", () => {
    const first = buildColumnOffsets(sequence([0, 0, 0, 0, 0]));
    const second = buildColumnOffsets(sequence([0, 0, 0, 0.99, 0.99]));
    expect(first).toHaveLength(CLOUD_GRID_ROWS);
    expect(second).toHaveLength(CLOUD_GRID_ROWS);
    expect(second).not.toEqual(first);
    expect([...second].sort((a, b) => a - b)).toEqual([...first].sort((a, b) => a - b));
  });
});

describe("buildCloudLayouts", () => {
  it("returns the requested number of layouts with one slot per card", () => {
    const layouts = buildCloudLayouts(3, CLOUD_PAGE_SIZE, 10);
    expect(layouts).toHaveLength(3);
    layouts.forEach((layout) => expect(layout).toHaveLength(CLOUD_PAGE_SIZE));
  });

  it("is deterministic, so a layout never reshuffles on re-render", () => {
    expect(buildCloudLayouts(3, CLOUD_PAGE_SIZE, 10)).toEqual(
      buildCloudLayouts(3, CLOUD_PAGE_SIZE, 10),
    );
  });

  it("rounds offsets to one decimal", () => {
    for (const layout of CLOUD_LAYOUTS) {
      for (const { offsetPercent } of layout) {
        expect(Math.round(offsetPercent * 10) / 10).toBe(offsetPercent);
      }
    }
  });

  it("never stacks two cards of a column closer than the minimum gap", () => {
    for (const layout of CLOUD_LAYOUTS) {
      for (let column = 0; column < COLUMNS; column++) {
        const offsets = Array.from(
          { length: CLOUD_GRID_ROWS },
          (_, row) => layout[row * COLUMNS + column].offsetPercent,
        ).sort((a, b) => a - b);
        for (let index = 1; index < offsets.length; index++) {
          expect(offsets[index] - offsets[index - 1]).toBeGreaterThanOrEqual(
            CLOUD_MIN_COLUMN_GAP_PERCENT - 0.2,
          );
        }
      }
    }
  });

  it("makes the five shipped arrangements distinct from each other", () => {
    expect(CLOUD_LAYOUTS).toHaveLength(5);
    const keys = CLOUD_LAYOUTS.map((layout) => layout.map((slot) => slot.offsetPercent).join(","));
    expect(new Set(keys).size).toBe(5);
  });

  it("keeps the arrangements apart from their own mirror image", () => {
    const flat = CLOUD_LAYOUTS.map((layout) => layout.map((slot) => slot.offsetPercent));
    for (let a = 0; a < flat.length; a++) {
      for (let b = 0; b < flat.length; b++) {
        if (a === b) continue;
        const mirrored = flat[b].map((offset) => CLOUD_MAX_OFFSET_PERCENT - offset);
        expect(flat[a]).not.toEqual(mirrored);
      }
    }
  });
});
