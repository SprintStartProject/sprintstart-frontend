import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ArtifactFilters } from "../../../../../src/features/knowledge-base/components/ArtifactFilters";
import type {
  FacetOption,
  TabOption,
} from "../../../../../src/features/knowledge-base/hooks/useKnowledgeBase";
import type { KnowledgeTab, UploadFormat } from "../../../../../src/features/knowledge-base/tabs";
import type { SourceSystem } from "../../../../../src/features/knowledge-base/types";

const SOURCE_OPTIONS: FacetOption<SourceSystem>[] = [
  { value: "GITHUB", label: "GitHub", count: 6 },
  { value: "UPLOAD", label: "Uploads", count: 4 },
];

const TAB_OPTIONS: TabOption[] = [
  { value: "ALL", label: "All", count: 10 },
  { value: "PULL_REQUEST", label: "Pull requests", count: 2 },
  { value: "ISSUE", label: "Issues", count: 4 },
];

const FORMAT_OPTIONS: FacetOption<UploadFormat>[] = [
  { value: "PDF", label: "PDFs", count: 3 },
  { value: "MARKDOWN", label: "Markdown", count: 1 },
];

const REPOSITORY_OPTIONS: FacetOption<string>[] = [
  {
    value: "sprintstart/sprintstart-backend",
    label: "sprintstart/sprintstart-backend",
    count: 3,
  },
  {
    value: "sprintstart/sprintstart-frontend",
    label: "sprintstart/sprintstart-frontend",
    count: 2,
  },
];

function buildProps(overrides: Partial<Parameters<typeof ArtifactFilters>[0]> = {}) {
  return {
    searchQuery: "",
    onSearchChange: vi.fn(),
    activeTab: "ALL" as KnowledgeTab,
    onTabChange: vi.fn(),
    tabOptions: TAB_OPTIONS,
    sourceOptions: SOURCE_OPTIONS,
    formatOptions: [],
    repositoryOptions: [],
    selectedSources: new Set<SourceSystem>(),
    selectedFormat: null,
    selectedRepositories: new Set<string>(),
    onToggleSource: vi.fn(),
    onToggleFormat: vi.fn(),
    onToggleRepository: vi.fn(),
    resultCount: 10,
    hasActiveFilters: false,
    onClearFilters: vi.fn(),
    ...overrides,
  };
}

describe("ArtifactFilters", () => {
  it("renders search field, tab switcher, result count, and source filter trigger", () => {
    const onRefresh = vi.fn();
    render(<ArtifactFilters {...buildProps({ onRefresh })} />);

    expect(screen.getByTestId("kb-search-input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pull requests/i })).toBeInTheDocument();
    expect(screen.getByTestId("kb-result-count")).toHaveTextContent("10 results");
    expect(screen.getByTestId("kb-filter-trigger")).toHaveTextContent("All sources");

    fireEvent.click(screen.getByTestId("kb-refresh"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    render(<ArtifactFilters {...buildProps({ onTabChange })} />);

    fireEvent.click(screen.getByRole("button", { name: /pull requests/i }));
    expect(onTabChange).toHaveBeenCalledWith("PULL_REQUEST");
  });

  it("reports a source toggle from inside the source menu", () => {
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

  it("summarises the source selection and shows active filter count", () => {
    const { rerender } = render(
      <ArtifactFilters
        {...buildProps({
          selectedSources: new Set<SourceSystem>(["GITHUB"]),
        })}
      />,
    );

    const trigger = screen.getByTestId("kb-filter-trigger");
    expect(trigger).toHaveTextContent("GitHub");
    expect(trigger).toHaveTextContent("1");

    rerender(
      <ArtifactFilters
        {...buildProps({
          selectedSources: new Set<SourceSystem>(["GITHUB", "JIRA"]),
        })}
      />,
    );

    expect(trigger).toHaveTextContent("GitHub, Jira");
    expect(trigger).toHaveTextContent("2");
  });

  it("renders Clear filters button when hasActiveFilters is true and calls onClearFilters", () => {
    const onClearFilters = vi.fn();
    const { rerender } = render(
      <ArtifactFilters {...buildProps({ hasActiveFilters: false, onClearFilters })} />,
    );

    expect(screen.queryByTestId("kb-clear-filters")).not.toBeInTheDocument();

    rerender(<ArtifactFilters {...buildProps({ hasActiveFilters: true, onClearFilters })} />);
    const clearBtn = screen.getByTestId("kb-clear-filters");
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("marks ticked options as checked", () => {
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

  it("says what the search looks at and ties the hint to the field", () => {
    render(<ArtifactFilters {...buildProps()} />);

    const hint = screen.getByTestId("kb-search-hint");
    expect(hint).toHaveTextContent("Searches titles and links");
    const input = screen.getByTestId("kb-search-input");
    expect(input.getAttribute("aria-describedby")).toContain(hint.id);
    expect(
      screen.getByRole("textbox", { name: "Search knowledge base" }),
    ).toHaveAccessibleDescription("Searches titles and links");
  });

  it("renders the repositories section only when repository options are provided", () => {
    const { unmount } = render(<ArtifactFilters {...buildProps()} />);

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(
      screen.queryByTestId("kb-filter-option-sprintstart/sprintstart-backend"),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <ArtifactFilters
        {...buildProps({
          repositoryOptions: REPOSITORY_OPTIONS,
          selectedSources: new Set<SourceSystem>(["GITHUB"]),
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));
    expect(
      screen.getByTestId("kb-filter-option-sprintstart/sprintstart-backend"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("kb-filter-option-sprintstart/sprintstart-frontend"),
    ).toBeInTheDocument();
  });

  it("reports a repository toggle from inside the source menu", () => {
    const onToggleRepository = vi.fn();
    render(
      <ArtifactFilters
        {...buildProps({
          repositoryOptions: REPOSITORY_OPTIONS,
          selectedSources: new Set<SourceSystem>(["GITHUB"]),
          selectedRepositories: new Set<string>(["sprintstart/sprintstart-backend"]),
          onToggleRepository,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId("kb-filter-trigger"));

    expect(screen.getByTestId("kb-filter-option-sprintstart/sprintstart-backend")).toBeChecked();
    fireEvent.click(screen.getByTestId("kb-filter-option-sprintstart/sprintstart-frontend"));
    expect(onToggleRepository).toHaveBeenCalledWith("sprintstart/sprintstart-frontend");
  });

  it("summarises selected repositories in the trigger", () => {
    render(
      <ArtifactFilters
        {...buildProps({
          selectedSources: new Set<SourceSystem>(["GITHUB"]),
          selectedRepositories: new Set<string>([
            "sprintstart/sprintstart-backend",
            "sprintstart/sprintstart-frontend",
          ]),
        })}
      />,
    );

    expect(screen.getByTestId("kb-filter-trigger")).toHaveTextContent("2 repositories");
  });
});
