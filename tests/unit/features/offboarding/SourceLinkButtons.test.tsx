import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SourceLinkButtons } from "../../../../src/features/offboarding/components/SourceLinks";
import type { FileRisk } from "../../../../src/services/offboardingTypes";

function file(repository: string): FileRisk {
  return {
    repository,
    path: "src/dir/A.kt",
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

describe("SourceLinkButtons", () => {
  it("opens a GitHub file and its history in a new tab", () => {
    render(<SourceLinkButtons file={file("github:acme/app")} />);

    const open = screen.getByRole("link", { name: /Open on GitHub/ });
    const history = screen.getByRole("link", { name: /History/ });
    expect(open).toHaveAttribute("href", "https://github.com/acme/app/blob/HEAD/src/dir/A.kt");
    expect(history).toHaveAttribute(
      "href",
      "https://github.com/acme/app/commits/HEAD/src/dir/A.kt",
    );
    [open, history].forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("offers a Bitbucket file without a history", () => {
    render(<SourceLinkButtons file={file("bitbucket:team/app")} />);

    expect(screen.getByRole("link", { name: /Open on Bitbucket/ })).toHaveAttribute(
      "href",
      "https://bitbucket.org/team/app/src/HEAD/src/dir/A.kt",
    );
    expect(screen.queryByRole("link", { name: /History/ })).not.toBeInTheDocument();
  });

  it("offers nothing for a host it does not know", () => {
    const { container } = render(<SourceLinkButtons file={file("local-repo")} />);

    expect(container).toBeEmptyDOMElement();
  });
});
