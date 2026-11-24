import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RiskResults } from "../../../../src/features/offboarding";
import { SourceLinkIcon } from "../../../../src/features/offboarding/components/SourceLinks";
import type { FileRisk, RiskMap } from "../../../../src/services/offboardingTypes";

function file(repository: string, path = "src/dir/A.kt"): FileRisk {
  return {
    repository,
    path,
    level: "ORPHANED",
    score: 0.5,
    departingShare: 1,
    sourceBreakdown: { commits: 1 },
    recentActivity: 0.5,
    fragmentation: 0,
    remainingKnowers: [],
    lastChangedAt: "2026-11-01T00:00:00Z",
  };
}

function mapOf(files: FileRisk[]): RiskMap {
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
    summary: {
      files: 5,
      orphaned: files.length,
      hoarded: 0,
      alreadyOrphaned: 0,
      listed: files.length,
    },
    files,
  };
}

describe("SourceLinkIcon", () => {
  it("opens the file at its source in a new tab, named by the file and the host", () => {
    render(<SourceLinkIcon file={file("github:acme/app")} />);

    const link = screen.getByRole("link", { name: "Open A.kt on GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/app/blob/HEAD/src/dir/A.kt");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("names a Bitbucket file by its host", () => {
    render(<SourceLinkIcon file={file("bitbucket:team/app")} />);

    expect(screen.getByRole("link", { name: "Open A.kt on Bitbucket" })).toHaveAttribute(
      "href",
      "https://bitbucket.org/team/app/src/HEAD/src/dir/A.kt",
    );
  });

  it("names a file in the root of a repository by its whole path", () => {
    render(<SourceLinkIcon file={file("github:acme/app", "README.md")} />);

    expect(screen.getByRole("link", { name: "Open README.md on GitHub" })).toBeInTheDocument();
  });

  it("is nothing for a host it does not know", () => {
    const { container } = render(<SourceLinkIcon file={file("local-repo")} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("the list of files at risk", () => {
  it("lets each file be opened at its source from its row", () => {
    render(
      <RiskResults
        map={mapOf([file("github:acme/app", "src/A.kt"), file("local-repo", "notes/B.md")])}
      />,
    );

    const first = screen.getByText("src/A.kt").closest("li")!;
    const second = screen.getByText("notes/B.md").closest("li")!;
    expect(within(first).getByRole("link", { name: "Open A.kt on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/acme/app/blob/HEAD/src/A.kt",
    );
    expect(within(second).queryByRole("link")).not.toBeInTheDocument();
  });
});
