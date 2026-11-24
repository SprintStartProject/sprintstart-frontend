import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { FilesCard } from "../../../../src/features/offboarding/components/FilesCard";
import { formatDay } from "../../../../src/features/offboarding/format";
import type { FileRisk, RiskMap } from "../../../../src/services/offboardingTypes";

function file(path: string): FileRisk {
  return {
    repository: "github:acme/app",
    path,
    level: "ORPHANED",
    score: 0.8,
    departingShare: 1,
    sourceBreakdown: { commits: 1 },
    recentActivity: 0.4,
    fragmentation: 0,
    remainingKnowers: [],
    lastChangedAt: "2026-11-01T00:00:00Z",
  };
}

function mapOf(files: FileRisk[], orphaned = files.length): RiskMap {
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
    summary: { files: 12, orphaned, hoarded: 0, alreadyOrphaned: 0, listed: files.length },
    files,
  };
}

describe("FilesCard", () => {
  it("starts with the ranked list, which shows each file by its whole path", () => {
    render(<FilesCard map={mapOf([file("src/A.kt")])} />);

    expect(screen.getByText("src/A.kt")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /by folder/ })).not.toBeInTheDocument();
  });

  it("switches to the tree and back", async () => {
    const user = userEvent.setup();
    render(<FilesCard map={mapOf([file("src/A.kt")])} />);

    await user.click(screen.getByRole("button", { name: "Tree" }));
    expect(screen.getByRole("list", { name: /by folder/ })).toBeInTheDocument();
    expect(screen.queryByText("src/A.kt")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "List" }));
    expect(screen.getByText("src/A.kt")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /by folder/ })).not.toBeInTheDocument();
  });

  it("shows the same files in both views", async () => {
    const user = userEvent.setup();
    render(<FilesCard map={mapOf([file("src/A.kt"), file("src/B.kt")])} />);
    expect(screen.getAllByText(/^src\/[AB]\.kt$/)).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getAllByRole("button", { name: /\.kt, Nobody left/ })).toHaveLength(2);
  });

  it("says so when nothing is at risk, in either view", async () => {
    const user = userEvent.setup();
    render(<FilesCard map={mapOf([], 0)} />);
    expect(screen.getByText(/Nothing is left without its authors/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getByText(/Nothing is left without its authors/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /by folder/ })).not.toBeInTheDocument();
  });

  it("says how many files at risk are left out of both views", async () => {
    const user = userEvent.setup();
    render(<FilesCard map={mapOf([file("src/A.kt")], 3)} />);
    expect(screen.getByText("2 more files at risk are not listed.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Tree" }));

    expect(screen.getByText("2 more files at risk are not listed.")).toBeInTheDocument();
  });
});

describe("formatDay", () => {
  it("writes a moment as a short calendar day in UTC", () => {
    expect(formatDay("2026-11-01T10:00:00Z")).toBe("1 Nov 2026");
    expect(formatDay("2026-12-31T23:59:59Z")).toBe("31 Dec 2026");
  });
});
