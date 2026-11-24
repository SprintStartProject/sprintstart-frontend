import { describe, expect, it } from "vitest";
import {
  EDGE_STYLE_SWATCH,
  EDGE_TONE_STYLE,
} from "../../../../src/features/graph-diagram/edgeStyles";

describe("EDGE_TONE_STYLE", () => {
  it("maps who set an arrow onto the style that carries the same feeling", () => {
    expect(EDGE_TONE_STYLE).toEqual({ rule: "done", own: "active", suggestion: "waiting" });
  });
});

describe("EDGE_STYLE_SWATCH", () => {
  it("draws a satisfied edge as a solid line", () => {
    expect(EDGE_STYLE_SWATCH.done).toEqual({
      className: "stroke-app-success-solid/70",
      width: 2.5,
      linecap: "round",
    });
  });

  it("draws the edge that is ready now dashed", () => {
    expect(EDGE_STYLE_SWATCH.active).toEqual({
      className: "stroke-app-brand",
      dash: "10 8",
      width: 2.5,
      linecap: "round",
    });
  });

  it("draws a waiting edge as dots", () => {
    expect(EDGE_STYLE_SWATCH.waiting).toEqual({
      className: "stroke-app-text-subtle/50",
      dash: "0.1 6",
      width: 2.5,
      linecap: "round",
    });
  });

  it("draws what has to come first as dash-dot with flat caps", () => {
    expect(EDGE_STYLE_SWATCH.upstream).toEqual({
      className: "stroke-app-orange-text",
      dash: "14 4 2 4",
      width: 2,
      linecap: "butt",
    });
  });

  it("draws a rule that locks as a plain line", () => {
    expect(EDGE_STYLE_SWATCH.rule).toEqual({
      className: "stroke-app-brand",
      width: 2,
      linecap: "round",
    });
  });
});
