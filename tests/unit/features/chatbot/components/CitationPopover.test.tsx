import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CitationPopover } from "../../../../../src/features/chatbot/components/CitationPopover";
import type { SelectedCitation } from "../../../../../src/context/ChatContext";

const mockCitation: SelectedCitation = {
  citation: {
    artifactId: "art-1",
    filename: "README.md",
    startLine: 12,
    sourceUrl: "https://example.com/repo/README.md",
  },
  rect: new DOMRect(100, 100, 50, 20),
};

describe("CitationPopover", () => {
  it("renders filename and line number", () => {
    render(<CitationPopover selected={mockCitation} onClose={() => {}} />);
    expect(screen.getByText("README.md")).toBeInTheDocument();
    expect(screen.getByText("Line 12")).toBeInTheDocument();
  });

  it("calls onOpenArtifact when Open source is clicked and artifactId is present", () => {
    const onOpenArtifact = vi.fn();
    const onClose = vi.fn();

    render(
      <CitationPopover selected={mockCitation} onClose={onClose} onOpenArtifact={onOpenArtifact} />,
    );

    const openBtn = screen.getByRole("button", { name: /Open source/ });
    fireEvent.click(openBtn);

    expect(onOpenArtifact).toHaveBeenCalledWith({
      artifactId: "art-1",
      filename: "README.md",
      sourceUrl: "https://example.com/repo/README.md",
      lines: [12],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders anchor link when onOpenArtifact is not provided", () => {
    render(<CitationPopover selected={mockCitation} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /Open source/ });
    expect(link).toHaveAttribute("href", "https://example.com/repo/README.md");
  });
});
