import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EdgeLegend, EdgeSwatch } from "../../../../src/features/graph-diagram/EdgeLegend";

function lineOf(container: HTMLElement) {
  const line = container.querySelector("line");
  if (!line) throw new Error("no line drawn");
  return line;
}

describe("EdgeSwatch", () => {
  it("is decorative and 28px long by default", () => {
    const { container } = render(<EdgeSwatch tone="done" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "28");
    expect(svg).toHaveAttribute("height", "8");
    expect(svg).toHaveClass("shrink-0");
  });

  it("takes the length and an extra class", () => {
    const { container } = render(<EdgeSwatch tone="done" length={40} className="extra" />);

    expect(container.querySelector("svg")).toHaveAttribute("width", "40");
    expect(container.querySelector("svg")).toHaveClass("extra");
  });

  it("insets a round-capped line so its ends are not clipped", () => {
    const { container } = render(<EdgeSwatch tone="done" length={40} />);

    const line = lineOf(container);
    expect(line).toHaveAttribute("x1", "1.5");
    expect(line).toHaveAttribute("x2", "38.5");
    expect(line).toHaveAttribute("y1", "4");
    expect(line).toHaveAttribute("y2", "4");
    expect(line).toHaveAttribute("fill", "none");
    expect(line).toHaveAttribute("stroke-linecap", "round");
    expect(line).toHaveAttribute("stroke-width", "2.5");
    expect(line).toHaveClass("stroke-app-success-solid/70");
    expect(line).not.toHaveAttribute("stroke-dasharray");
  });

  it("runs a flat-capped line edge to edge and draws its dash pattern", () => {
    const { container } = render(<EdgeSwatch tone="upstream" length={40} />);

    const line = lineOf(container);
    expect(line).toHaveAttribute("x1", "0");
    expect(line).toHaveAttribute("x2", "40");
    expect(line).toHaveAttribute("stroke-linecap", "butt");
    expect(line).toHaveAttribute("stroke-dasharray", "14 4 2 4");
    expect(line).toHaveAttribute("stroke-width", "2");
  });
});

describe("EdgeLegend", () => {
  it("lists a sample and the word for every tone it is given", () => {
    render(<EdgeLegend tones={["done", "active", "waiting", "upstream", "rule"]} />);

    const list = screen.getByRole("list", { name: "Arrow styles" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "done",
      "ready now",
      "waiting",
      "comes first",
      "locks",
    ]);
    items.forEach((item) => expect(item.querySelector("svg")).not.toBeNull());
  });

  it("lists only the tones asked for, in the order asked for", () => {
    render(<EdgeLegend tones={["waiting", "done"]} />);

    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["waiting", "done"]);
  });

  it("takes an extra class on the list", () => {
    render(<EdgeLegend tones={["done"]} className="mt-2" />);

    expect(screen.getByRole("list", { name: "Arrow styles" })).toHaveClass("mt-2");
  });
});
