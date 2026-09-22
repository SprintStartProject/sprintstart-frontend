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

  it("renders a Custom badge instead of a confidence badge when isCustom is set", () => {
    render(<IndustryConfidenceBadge confidence="high" isCustom />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
    expect(screen.queryByText("High confidence")).not.toBeInTheDocument();
  });

  it("renders a Custom badge even without a confidence value", () => {
    render(<IndustryConfidenceBadge confidence={null} isCustom />);

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });
});
