import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { SourceLinkBadge } from "../../../../../src/features/knowledge-base/components/SourceLinkBadge";

describe("SourceLinkBadge", () => {
  it("renders GitHub link badge with appropriate label and security attributes", () => {
    render(
      <SourceLinkBadge
        sourceUrl="https://github.com/org/repo/blob/main/doc.md"
        sourceSystem="GITHUB"
      />,
    );

    const link = screen.getByTestId("artifact-drawer-source-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Open in GitHub");
    expect(link).toHaveAttribute("href", "https://github.com/org/repo/blob/main/doc.md");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("aria-label", "Open in GitHub (opens in a new tab)");
    expect(link).toHaveAttribute("title", "https://github.com/org/repo/blob/main/doc.md");
  });

  it("renders Jira link badge", () => {
    render(
      <SourceLinkBadge sourceUrl="https://jira.example.com/browse/KEY-123" sourceSystem="JIRA" />,
    );

    const link = screen.getByTestId("artifact-drawer-source-link");
    expect(link).toHaveTextContent("Open in Jira");
    expect(link).toHaveAttribute("href", "https://jira.example.com/browse/KEY-123");
  });

  it("renders Confluence link badge", () => {
    render(
      <SourceLinkBadge
        sourceUrl="https://confluence.example.com/wiki/page/123"
        sourceSystem="CONFLUENCE"
      />,
    );

    const link = screen.getByTestId("artifact-drawer-source-link");
    expect(link).toHaveTextContent("Open in Confluence");
  });

  it("falls back to generic label for other source systems", () => {
    render(
      <SourceLinkBadge sourceUrl="https://example.com/custom" sourceSystem={"OTHER" as never} />,
    );

    const link = screen.getByTestId("artifact-drawer-source-link");
    expect(link).toHaveTextContent("Open source");
  });

  it("respects custom testId prop", () => {
    render(
      <SourceLinkBadge
        sourceUrl="https://github.com/org/repo"
        sourceSystem="GITHUB"
        testId="custom-source-link"
      />,
    );

    expect(screen.getByTestId("custom-source-link")).toBeInTheDocument();
  });
});
