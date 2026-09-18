import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtifactFilters } from "../../../../../src/features/knowledge-base/components/ArtifactFilters";
import type { FacetOption } from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type { UploadFormat } from "../../../../../src/features/knowledge-base/tabs";
import type { ArtifactType, SourceSystem } from "../../../../../src/features/knowledge-base/types";

const SOURCE_OPTIONS: FacetOption<SourceSystem>[] = [
  { value: "GITHUB", label: "GitHub", count: 6 },
  { value: "UPLOAD", label: "Uploads", count: 4 },
];

const TYPE_OPTIONS: FacetOption<ArtifactType>[] = [
  { value: "PULL_REQUEST", label: "Pull requests", count: 2 },
  { value: "ISSUE", label: "Issues", count: 4 },
];

const FORMAT_OPTIONS: FacetOption<UploadFormat>[] = [
  { value: "PDF", label: "PDFs", count: 3 },
  { value: "MARKDOWN", label: "Markdown", count: 1 },
];

function buildProps(overrides: Partial<Parameters<typeof ArtifactFilters>[0]> = {}) {
  return {
    searchQuery: "",
    onSearchChange: vi.fn(),
    sourceOptions: SOURCE_OPTIONS,
    typeOptions: TYPE_OPTIONS,
    formatOptions: [],
    selectedSources: new Set<SourceSystem>(),
    selectedTypes: new Set<ArtifactType>(),
    selectedFormat: null,
    onToggleSource: vi.fn(),
    onToggleType: vi.fn(),
    onToggleFormat: vi.fn(),
    ...overrides,
  };
}

describe("ArtifactFilters", () => {
  it("renders the search field, the filter trigger and refresh", () => {
    const onRefresh = vi.fn();
    render(<ArtifactFilters {...buildProps({ onRefresh })} />);

    expect(screen.getByTestId("kb-search-input")).toBeInTheDocument();
    expect(screen.getByTestId("kb-filter-trigger")).toHaveTextContent("All sources · All types");

    fireEvent.click(screen.getByTestId("kb-refresh"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("reports a source toggle from inside the menu", () => {
    const onToggleSource = vi.fn();
    render(<ArtifactFilters {...buildProps({ onToggleSource })} />);

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    const github = screen.getByTestId("kb-filter-option-github");
    expect(github).not.toBeChecked();

    fireEvent.click(github);
    expect(onToggleSource).toHaveBeenCalledWith("GITHUB");
  });

  it("offers no file-format section while Uploads is not selected", () => {
    const { unmount } = render(<ArtifactFilters {...buildProps()} />);

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(screen.queryByTestId("kb-filter-option-pdf")).not.toBeInTheDocument();
    unmount();

    render(
      <ArtifactFilters
        {...buildProps({
          formatOptions: FORMAT_OPTIONS,
          selectedSources: new Set<SourceSystem>(["UPLOAD"]),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(screen.getByTestId("kb-filter-option-pdf")).toBeInTheDocument();
    expect(screen.getByTestId("kb-filter-option-markdown")).toBeInTheDocument();
  });

  it("summarises the selection and counts the facets, not the options", () => {
    render(
      <ArtifactFilters
        {...buildProps({
          selectedSources: new Set<SourceSystem>(["GITHUB"]),
          selectedTypes: new Set<ArtifactType>(["ISSUE"]),
        })}
      />,
    );

    const trigger = screen.getByTestId("kb-filter-trigger");
    expect(trigger).toHaveTextContent("GitHub · Issues");
    // Two facets, not the two option values behind them.
    expect(trigger).toHaveTextContent("2");
  });

  it("marks the ticked options as checked", () => {
    render(
      <ArtifactFilters {...buildProps({ selectedSources: new Set<SourceSystem>(["UPLOAD"]) })} />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    expect(screen.getByTestId("kb-filter-option-upload")).toBeChecked();
    expect(screen.getByTestId("kb-filter-option-github")).not.toBeChecked();
  });

  it("forwards search typing", () => {
    const onSearchChange = vi.fn();
    render(<ArtifactFilters {...buildProps({ onSearchChange })} />);

    fireEvent.change(screen.getByTestId("kb-search-input"), { target: { value: "readme" } });

    expect(onSearchChange).toHaveBeenCalledWith("readme");
  });
  it("leaves out a section that has no options left to show", () => {
    render(<ArtifactFilters {...buildProps({ typeOptions: [] })} />);

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    expect(screen.getByTestId("kb-filter-section-sources")).toBeInTheDocument();
    // `Types` empties out once the chosen sources cannot produce any of them; a
    // heading over an empty group reads as a loading state.
    expect(screen.queryByTestId("kb-filter-section-types")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kb-filter-section-formats")).not.toBeInTheDocument();
  });
});
