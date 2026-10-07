import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EdgeLegend } from "../../../../src/features/graph-diagram/EdgeLegend";
import { EDGE_STYLE_SWATCH } from "../../../../src/features/graph-diagram/edgeStyles";

describe("edge styles", () => {
  // The arrows on a graph say what state they are in, and colour must not be the only thing that
  // does (WCAG 1.4.1): done, ready, waiting and "comes first" each have their own dash pattern.
  it("draws done, ready, waiting and comes-first with four different line patterns", () => {
    const patterns = (["done", "active", "waiting", "upstream"] as const).map(
      (tone) => EDGE_STYLE_SWATCH[tone].dash ?? "solid",
    );

    expect(new Set(patterns).size).toBe(4);
  });

  it("writes the key out in words next to each sample line", () => {
    render(<EdgeLegend tones={["done", "active", "waiting"]} />);

    const legend = screen.getByRole("list", { name: "Arrow styles" });
    expect(legend).toHaveTextContent("done");
    expect(legend).toHaveTextContent("ready now");
    expect(legend).toHaveTextContent("waiting");
  });
});
