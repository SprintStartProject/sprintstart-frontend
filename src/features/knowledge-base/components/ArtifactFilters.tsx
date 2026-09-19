import type { ReactNode } from "react";
import {
  BookOpen,
  File,
  FileCode,
  FileText,
  GitBranch,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Ticket,
  Upload,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import {
  MultiSelectFilter,
  type MultiSelectFilterSection,
} from "../../../components/ui/MultiSelectFilter";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs";
import type { FacetOption, TabOption } from "../hooks/useKnowledgeBase";
import {
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  FORMAT_LABELS,
  SOURCE_LABELS,
  type KnowledgeTab,
  type UploadFormat,
} from "../tabs";
import type { ArtifactType, SourceSystem } from "../types";

export type { ArtifactType, KnowledgeTab, SourceSystem, TabOption };

/** Props for {@link ArtifactFilters}. */
export interface ArtifactFiltersProps {
  searchQuery: string;
  /** Fired on every keystroke with the new search text. Resets pagination in the parent. */
  onSearchChange: (query: string) => void;
  /** Currently active artifact type tab. */
  activeTab: KnowledgeTab;
  /** Fired when the user picks a different artifact type tab. */
  onTabChange: (tab: KnowledgeTab) => void;
  /** Primary artifact type tabs for SegmentedTabs with counts. */
  tabOptions: TabOption[];
  /** Sources present in the project, with the count each would add. */
  sourceOptions: FacetOption<SourceSystem>[];
  /**
   * Upload file formats, with counts. Empty unless Uploads is part of the source
   * selection — the facet describes uploads only, so the section disappears with
   * them and the hook owns that rule rather than the toolbar re-deriving it.
   */
  formatOptions: FacetOption<UploadFormat>[];
  /**
   * Repositories behind the project's GitHub artifacts, with counts. Empty
   * unless GitHub is part of the source selection — the facet describes GitHub
   * only, so the section disappears with it and the hook owns that rule rather
   * than the toolbar re-deriving it.
   */
  repositoryOptions: FacetOption<string>[];
  selectedSources: ReadonlySet<SourceSystem>;
  selectedFormat: UploadFormat | null;
  selectedRepositories: ReadonlySet<string>;
  onToggleSource: (source: SourceSystem) => void;
  onToggleFormat: (format: UploadFormat) => void;
  onToggleRepository: (repository: string) => void;
  /** Total count of matching artifacts. */
  resultCount: number;
  /** Whether any filter, facet, or search query is currently non-default. */
  hasActiveFilters: boolean;
  /** Clears all active filters, facets, and search query. */
  onClearFilters: () => void;
  /** Fired when the user clicks the refresh button. */
  onRefresh?: () => void;
  /** Whether a refresh is currently in progress. */
  isRefreshing?: boolean;
}

const ICON_CLASS = "h-4 w-4 shrink-0 text-app-text-muted";

const SOURCE_ICONS: Record<SourceSystem, ReactNode> = {
  GITHUB: <GitBranch className={ICON_CLASS} aria-hidden="true" />,
  JIRA: <Ticket className={ICON_CLASS} aria-hidden="true" />,
  CONFLUENCE: <BookOpen className={ICON_CLASS} aria-hidden="true" />,
  UPLOAD: <Upload className={ICON_CLASS} aria-hidden="true" />,
};

const FORMAT_ICONS: Record<UploadFormat, ReactNode> = {
  PDF: <FileText className={ICON_CLASS} aria-hidden="true" />,
  MARKDOWN: <FileCode className={ICON_CLASS} aria-hidden="true" />,
  IMAGE: <ImageIcon className={ICON_CLASS} aria-hidden="true" />,
  OTHER: <File className={ICON_CLASS} aria-hidden="true" />,
};

/**
 * Summary string for the source multi-select filter trigger.
 */
function summariseSources(
  sources: ReadonlySet<SourceSystem>,
  format: UploadFormat | null,
  repositories: ReadonlySet<string>,
): string {
  const parts: string[] = [];

  if (sources.size === 0) {
    parts.push("All sources");
  } else {
    const ordered = DEFAULT_SOURCE_ORDER.filter((source) => sources.has(source));
    const others = [...sources].filter(
      (source) => !(DEFAULT_SOURCE_ORDER as readonly SourceSystem[]).includes(source),
    );
    const names = [...ordered, ...others].map((source) => SOURCE_LABELS[source] ?? source);
    parts.push(names.join(", "));
  }

  if (format !== null) {
    parts.push(FORMAT_LABELS[format]);
  }

  if (repositories.size === 1) {
    parts.push([...repositories][0]);
  } else if (repositories.size > 1) {
    parts.push(`${repositories.size} repositories`);
  }

  return parts.join(" · ");
}

function isSource(value: string): value is SourceSystem {
  return (DEFAULT_SOURCE_ORDER as readonly string[]).includes(value);
}

function isUploadFormat(value: string): value is UploadFormat {
  return (DEFAULT_FORMAT_ORDER as readonly string[]).includes(value);
}

/**
 * ArtifactFilters
 *
 * 3-tier filtering hierarchy for the knowledge base:
 * 1. Tier 1: Prominent full-width search input with refresh trigger.
 * 2. Tier 2: Content-width SegmentedTabs switcher for artifact types.
 * 3. Tier 3: Action & facet row with result count, "Clear filters", and a compact,
 *    right-aligned Source multi-select dropdown.
 */
export function ArtifactFilters({
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  tabOptions,
  sourceOptions,
  formatOptions,
  repositoryOptions,
  selectedSources,
  selectedFormat,
  selectedRepositories,
  onToggleSource,
  onToggleFormat,
  onToggleRepository,
  resultCount,
  hasActiveFilters,
  onClearFilters,
  onRefresh,
  isRefreshing,
}: ArtifactFiltersProps) {
  const sections: MultiSelectFilterSection<string>[] = [];

  if (sourceOptions.length > 0) {
    sections.push({
      id: "sources",
      label: "Sources",
      options: sourceOptions.map((option) => ({
        value: option.value,
        label: option.label,
        count: option.count,
        icon: SOURCE_ICONS[option.value],
      })),
    });
  }

  if (formatOptions.length > 0) {
    sections.push({
      id: "formats",
      label: "File format",
      options: formatOptions.map((option) => ({
        value: option.value,
        label: option.label,
        count: option.count,
        icon: FORMAT_ICONS[option.value],
      })),
    });
  }

  if (repositoryOptions.length > 0) {
    sections.push({
      id: "repositories",
      label: "Repositories",
      options: repositoryOptions.map((option) => ({
        value: option.value,
        label: option.label,
        count: option.count,
        icon: <GitBranch className={ICON_CLASS} aria-hidden="true" />,
      })),
    });
  }

  const selectedValues = new Set<string>([...selectedSources]);
  if (selectedFormat !== null) selectedValues.add(selectedFormat);
  for (const repository of selectedRepositories) selectedValues.add(repository);

  const activeCount =
    selectedSources.size + (selectedFormat !== null ? 1 : 0) + selectedRepositories.size;

  const handleToggle = (value: string) => {
    if (isSource(value)) onToggleSource(value);
    else if (isUploadFormat(value)) onToggleFormat(value);
    else onToggleRepository(value);
  };

  return (
    <div className="mb-6 flex flex-col gap-5">
      {/* Tier 1: Search bar with integrated refresh button */}
      <Input
        type="text"
        placeholder="Search knowledge base..."
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        data-testid="kb-search-input"
        aria-label="Search knowledge base"
        icon={<Search className="h-4 w-4" />}
        trailing={
          onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Knowledge Base"
              aria-label="Refresh knowledge base"
              data-testid="kb-refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin text-app-brand" : ""}`}
              />
            </Button>
          )
        }
      />

      {/* Tier 2: Tab switcher for artifact types */}
      <SegmentedTabs
        value={activeTab}
        options={tabOptions.map((tab) => ({
          value: tab.value,
          label: tab.label,
          count: tab.count,
        }))}
        onChange={onTabChange}
        layoutId="kb-artifact-type-tab"
        ariaLabel="Filter artifacts by type"
        className="self-start"
      />

      {/* Tier 3: Action bar with result count, Clear filters, and compact Sources dropdown */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <p
          className="flex h-9 shrink-0 items-center text-sm leading-none font-medium whitespace-nowrap text-app-text-muted"
          data-testid="kb-result-count"
        >
          {resultCount} {resultCount === 1 ? "result" : "results"}
        </p>

        <div className="ml-auto flex w-full items-center justify-end gap-3 sm:w-auto">
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              data-testid="kb-clear-filters"
              className="shrink-0 text-app-text-muted hover:text-app-text"
            >
              Clear filters
            </Button>
          )}

          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <MultiSelectFilter
              label="Filter sources"
              summary={summariseSources(selectedSources, selectedFormat, selectedRepositories)}
              activeCount={activeCount}
              sections={sections}
              selected={selectedValues}
              onToggle={handleToggle}
              size="sm"
              testId="kb-filter"
              className="w-full"
              collapsible={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
