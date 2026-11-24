import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RiskResults } from "../../../../src/features/offboarding";
import type { RiskMap } from "../../../../src/services/offboardingTypes";

function mapOf(overrides: Partial<RiskMap> = {}): RiskMap {
  return {
    asOf: "2026-11-20T12:00:00Z",
    settings: {
      halfLifeDays: 152,
      inactiveAfterDays: 365,
      authorThreshold: 0.75,
      knowledgeWeight: 0.7,
      activityWeight: 0.3,
      name: "default",
      sourceWeights: { commits: 1 },
    },
    departing: ["ada"],
    unknownDeparting: [],
    summary: { files: 12, orphaned: 2, hoarded: 1, alreadyOrphaned: 3, listed: 0 },
    files: [],
    ...overrides,
  };
}

describe("RiskResults", () => {
  it("shows how many files lose their last author and how many rely on one person", () => {
    render(<RiskResults map={mapOf()} />);

    expect(screen.getByText("files lose their last author")).toBeInTheDocument();
    expect(screen.getByText("files rely on a single author")).toBeInTheDocument();
    expect(screen.getByText("3 had no active author before")).toBeInTheDocument();
  });

  it("shows the counts themselves", () => {
    render(<RiskResults map={mapOf()} />);

    const stats = screen.getAllByText(/^\d+$/).map((node) => node.textContent);
    expect(stats).toEqual(["2", "1", "12"]);
  });

  it("warns about leaving people no record belongs to", () => {
    render(<RiskResults map={mapOf({ unknownDeparting: ["typo@x.org"] })} />);

    expect(screen.getByRole("status")).toHaveTextContent("typo@x.org");
  });

  it("names every person the history knows nothing about", () => {
    render(<RiskResults map={mapOf({ unknownDeparting: ["a@x.org", "b"] })} />);

    expect(screen.getByRole("status")).toHaveTextContent("a@x.org, b");
  });

  it("flags the stat of files without an author only while there are any", () => {
    const { container, rerender } = render(<RiskResults map={mapOf()} />);
    expect(container.querySelectorAll(".animate-ping")).toHaveLength(1);

    rerender(
      <RiskResults
        map={mapOf({
          summary: { files: 4, orphaned: 0, hoarded: 1, alreadyOrphaned: 0, listed: 0 },
        })}
      />,
    );

    expect(container.querySelectorAll(".animate-ping")).toHaveLength(0);
  });

  it("does not warn when everybody was found", () => {
    render(<RiskResults map={mapOf()} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
