import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { MarkFilterRail } from "../../../../src/features/board/components/MarkFilterRail";
import { markSection } from "../../../../src/features/board/layout/boardSections";
import type { SectionSummary } from "../../../../src/features/board/layout/boardSections";

function colourRow(overrides: Partial<SectionSummary> = {}): SectionSummary {
  return {
    id: markSection("green"),
    name: "ask about",
    mark: "green",
    stage: null,
    total: 3,
    done: 0,
    blocked: 0,
    ...overrides,
  };
}

describe("filtering the board by what the hire highlighted", () => {
  it("draws nothing on a board with no highlights on it", () => {
    const { container } = render(
      <MarkFilterRail sections={[]} selectedId={null} onSelect={vi.fn()} />,
    );

    // Four dots over a board nobody has marked would be a control for something that has not
    // happened yet.
    expect(container).toBeEmptyDOMElement();
  });

  it("names a colour by the hire's own word for it, with how much is under it", () => {
    render(<MarkFilterRail sections={[colourRow()]} selectedId={null} onSelect={vi.fn()} />);

    expect(screen.getByRole("button", { name: "ask about · 3 cards" })).toBeInTheDocument();
  });

  it("shows what is marked in a colour, and shows everything again when pressed twice", () => {
    const onSelect = vi.fn();
    const row = colourRow();

    const { rerender } = render(
      <MarkFilterRail sections={[row]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ask about/ }));
    expect(onSelect).toHaveBeenLastCalledWith(row.id);

    // Pressed again it clears itself, the way every other switch in this rail does — there is no
    // "all colours" button to find afterwards.
    rerender(<MarkFilterRail sections={[row]} selectedId={row.id} onSelect={onSelect} />);
    const dot = screen.getByRole("button", { name: /ask about/ });
    expect(dot).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(dot);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("counts one card as a card", () => {
    render(
      <MarkFilterRail sections={[colourRow({ total: 1 })]} selectedId={null} onSelect={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "ask about · 1 card" })).toBeInTheDocument();
  });
});
