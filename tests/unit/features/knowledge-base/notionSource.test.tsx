import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtifactFilters } from "../../../../src/features/knowledge-base/components/ArtifactFilters";
import { DEFAULT_SOURCE_ORDER, SOURCE_LABELS } from "../../../../src/features/knowledge-base/tabs";
import type { FacetOption } from "../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type { SourceSystem } from "../../../../src/features/knowledge-base/types";

describe("knowledge base source facet, Notion", () => {
  it("labels Notion and places it between Confluence and Uploads", () => {
    expect(SOURCE_LABELS.NOTION).toBe("Notion");
    expect(DEFAULT_SOURCE_ORDER).toEqual(["GITHUB", "JIRA", "CONFLUENCE", "NOTION", "UPLOAD"]);
  });

  it("offers Notion as a source filter and reports the toggle", () => {
    const onToggleSource = vi.fn();
    const sourceOptions: FacetOption<SourceSystem>[] = [
      { value: "GITHUB", label: "GitHub", count: 2 },
      { value: "NOTION", label: "Notion", count: 3 },
    ];

    render(
      <ArtifactFilters
        searchQuery=""
        onSearchChange={vi.fn()}
        activeTab="ALL"
        onTabChange={vi.fn()}
        tabOptions={[{ value: "ALL", label: "All", count: 5 }]}
        sourceOptions={sourceOptions}
        formatOptions={[]}
        repositoryOptions={[]}
        selectedSources={new Set<SourceSystem>()}
        selectedFormat={null}
        selectedRepositories={new Set<string>()}
        onToggleSource={onToggleSource}
        onToggleFormat={vi.fn()}
        onToggleRepository={vi.fn()}
        resultCount={5}
        hasActiveFilters={false}
        onClearFilters={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    const notion = screen.getByTestId("kb-filter-option-notion");
    expect(screen.getByText("Notion")).toBeInTheDocument();

    fireEvent.click(notion);
    expect(onToggleSource).toHaveBeenCalledWith("NOTION");
  });
});
