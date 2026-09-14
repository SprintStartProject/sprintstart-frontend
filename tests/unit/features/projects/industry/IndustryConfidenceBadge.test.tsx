import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { IndustryConfidenceBadge } from "../../../../../src/features/projects/industry/IndustryConfidenceBadge";

describe("IndustryConfidenceBadge", () => {
  it("renders nothing when confidence is null", () => {
    const { container } = render(<IndustryConfidenceBadge confidence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ["high", "High confidence"],
    ["medium", "Medium confidence"],
    ["low", "Low confidence"],
  ] as const)("renders the label for %s confidence", (confidence, label) => {
    render(<IndustryConfidenceBadge confidence={confidence} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
