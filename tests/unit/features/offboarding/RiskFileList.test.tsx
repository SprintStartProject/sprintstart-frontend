import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RiskResults } from "../../../../src/features/offboarding";
import { describeBreakdown, percent } from "../../../../src/features/offboarding/format";
import type { FileRisk, RiskMap } from "../../../../src/services/offboardingTypes";

function file(overrides: Partial<FileRisk> = {}): FileRisk {
  return {
    repository: "github:acme/app",
    path: "src/core/Engine.kt",
    level: "ORPHANED",
    score: 0.812,
    departingShare: 1,
    sourceBreakdown: { commits: 0.5, reviews: 0.75 },
    recentActivity: 0.4,
    fragmentation: 0,
    remainingKnowers: [],
    lastChangedAt: "2026-11-01T00:00:00Z",
    ...overrides,
  };
}

function mapOf(files: FileRisk[], overrides: Partial<RiskMap> = {}): RiskMap {
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
    summary: { files: 12, orphaned: 2, hoarded: 1, alreadyOrphaned: 3, listed: files.length },
    files,
    ...overrides,
  };
}

describe("the list of files at risk", () => {
  it("lists each file with how it was left, its score and what the evidence says", () => {
    render(<RiskResults map={mapOf([file()])} />);

    const row = screen.getByText("src/core/Engine.kt").closest("li")!;
    expect(within(row).getByText("Nobody left")).toBeInTheDocument();
    expect(within(row).getByText("81%")).toBeInTheDocument();
    expect(within(row).getByText("commits 50% · reviews 75%")).toBeInTheDocument();
    expect(within(row).getByRole("meter", { name: "Risk score" })).toHaveAttribute(
      "aria-valuetext",
      "81%",
    );
    expect(within(row).getByText("github:acme/app")).toBeInTheDocument();
  });

  it("names the person who stays on a file left to one person", () => {
    render(<RiskResults map={mapOf([file({ level: "HOARDED", remainingKnowers: ["ben"] })])} />);

    const row = screen.getByText("src/core/Engine.kt").closest("li")!;
    expect(within(row).getByText("One person left")).toBeInTheDocument();
    expect(within(row).getByText(/stays: ben/)).toBeInTheDocument();
  });

  it("names nobody on a file that is left with no author", () => {
    render(<RiskResults map={mapOf([file()])} />);

    expect(screen.queryByText(/stays:/)).not.toBeInTheDocument();
  });

  it("keeps the order of the ranking", () => {
    render(<RiskResults map={mapOf([file({ path: "first.kt" }), file({ path: "second.kt" })])} />);

    const rows = screen.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(rows[0]).toContain("first.kt");
    expect(rows[1]).toContain("second.kt");
  });

  it("names the settings the ranking was computed with", () => {
    render(<RiskResults map={mapOf([file()])} />);

    expect(screen.getByText(/default settings/)).toBeInTheDocument();
  });

  it("says so when nothing is at risk", () => {
    const none = mapOf([], {
      summary: { files: 5, orphaned: 0, hoarded: 0, alreadyOrphaned: 0, listed: 0 },
    });

    render(<RiskResults map={none} />);

    expect(screen.getByText(/Nothing is left without its authors/)).toBeInTheDocument();
    expect(screen.queryByText(/not listed/)).not.toBeInTheDocument();
  });

  it("says how many files at risk the list leaves out", () => {
    render(<RiskResults map={mapOf([file()])} />);

    expect(screen.getByText("2 more files at risk are not listed.")).toBeInTheDocument();
  });

  it("does not claim files are left out when all are listed", () => {
    const all = mapOf([file(), file({ path: "b.kt" }), file({ path: "c.kt" })]);

    render(<RiskResults map={all} />);

    expect(screen.queryByText(/not listed/)).not.toBeInTheDocument();
  });
});

describe("format", () => {
  it("writes a score as a rounded percentage", () => {
    expect(percent(0)).toBe("0%");
    expect(percent(0.625)).toBe("63%");
    expect(percent(1)).toBe("100%");
  });

  it("lists the share of each kind of evidence", () => {
    expect(describeBreakdown({ commits: 0.5, reviews: 0.75 })).toBe("commits 50% · reviews 75%");
    expect(describeBreakdown({})).toBe("");
  });
});
