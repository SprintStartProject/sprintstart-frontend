import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MessageCitations } from "../../../../../src/features/chatbot/components/MessageCitations";
import type { Citation } from "../../../../../src/features/chatbot/types";

// Two chunks from the same file so the grouping logic produces one chip
// with locations "Line 1" / "Line 5" — the "Open source / Line 1" popover.
const citations: Citation[] = [
  {
    artifactId: "a1",
    filename: "README.md",
    startLine: 1,
    sourceUrl: "https://example.com/repo/blob/main/README.md",
  },
  {
    artifactId: "a1",
    filename: "README.md",
    startLine: 5,
    sourceUrl: "https://example.com/repo/blob/main/README.md",
  },
];

describe("MessageCitations", () => {
  it('closes the citation popover when "Open source" opens the artifact', () => {
    const onOpenArtifact = vi.fn();
    render(<MessageCitations citations={citations} onOpenArtifact={onOpenArtifact} />);

    // Expand the collapsed sources block.
    fireEvent.click(screen.getByRole("button", { name: /Sources/ }));

    // Open the per-file sub-popover by clicking the file chip.
    fireEvent.click(screen.getByRole("button", { name: /README\.md/ }));

    const openSource = screen.getByRole("button", { name: /Open source/ });
    fireEvent.click(openSource);

    // The artifact-open handler is invoked with the grouped citation data.
    expect(onOpenArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        artifactId: "a1",
        filename: "README.md",
        sourceUrl: "https://example.com/repo/blob/main/README.md",
      }),
    );

    // The popover (and its "Open source" action) must be gone. This is the
    // regression: previously the popover stayed floating over the
    // knowledge-base drawer until the user clicked the drawer (outside
    // click) to finally dismiss it.
    expect(screen.queryByRole("button", { name: /Open source/ })).not.toBeInTheDocument();
  });

  it("closes the popover when the sourceUrl link is clicked (no onOpenArtifact)", () => {
    render(<MessageCitations citations={citations} />);

    fireEvent.click(screen.getByRole("button", { name: /Sources/ }));
    fireEvent.click(screen.getByRole("button", { name: /README\.md/ }));

    fireEvent.click(screen.getByRole("link", { name: /Open source/ }));

    expect(screen.queryByRole("link", { name: /Open source/ })).not.toBeInTheDocument();
  });
});
