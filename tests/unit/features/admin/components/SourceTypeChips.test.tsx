import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceTypeChips } from "../../../../../src/features/admin/components/SourceTypeChips";

describe("SourceTypeChips", () => {
  it("renders nothing without sources", () => {
    const { container } = render(<SourceTypeChips sources={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("groups sources by type and shows how many there are", () => {
    render(
      <SourceTypeChips sources={[{ type: "GITHUB" }, { type: "github" }, { type: "JIRA" }]} />,
    );

    expect(screen.getByText("GitHub ×2")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
  });

  it("collapses the types beyond the limit into a +N chip", () => {
    render(
      <SourceTypeChips
        sources={[{ type: "GITHUB" }, { type: "JIRA" }, { type: "UPLOAD" }, { type: "CONFLUENCE" }]}
        maxVisible={2}
      />,
    );

    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Jira")).toBeInTheDocument();
    expect(screen.queryByText("Upload")).not.toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("keeps a type without shared metadata visible", () => {
    render(<SourceTypeChips sources={[{ type: "SONARQUBE" }]} />);

    expect(screen.getByText("Sonarqube")).toBeInTheDocument();
  });
});
