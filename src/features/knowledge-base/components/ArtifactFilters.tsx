import { useId } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  File,
  FileCode,
  FileText,
  FolderGit2,
  GitBranch,
  Image as ImageIcon,
  Languages,
  ListChecks,
  RefreshCw,
  Search,
  Ticket,
  Upload,
} from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select.tsx";
import {
  MultiSelectFilter,
  type MultiSelectFilterSection,
} from "../../../components/ui/MultiSelectFilter";
import { SegmentedTabs } from "../../../components/ui/SegmentedTabs";
import type { FacetOption, TabOption } from "../hooks/useKnowledgeBase";
import {
  ARTIFACT_SORT_ORDER,
  DEFAULT_ARTIFACT_SORT,
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  FORMAT_LABELS,
  SORT_LABELS,
  SOURCE_LABELS,
  type KnowledgeTab,
  type UploadFormat,
} from "../tabs";
import type { ArtifactSort, ArtifactType, SourceSystem } from "../types";
import type { DateRange } from "../dateRange.ts";
import type { KnowledgeBaseHistoryMode } from "../hooks/useKnowledgeBaseUrlState.ts";
import { ArtifactDateRangeFilter } from "./ArtifactDateRangeFilter.tsx";
import { formatResultRange } from "../resultRange.ts";

export type { ArtifactType, KnowledgeTab, SourceSystem, TabOption };

/** Props for {@link ArtifactFilters}. */
export interface ArtifactFiltersProps {
  searchQuery: string;
  /**
   * Fired on every keystroke with the new search text. The parent debounces it before it reaches
   * the URL and the server, and resets pagination once it does.
   */
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
  /**
   * Languages the project's artifacts are written in, with counts. Not gated on a
   * source, and empty (section hidden) when the project has no language values.
   * Optional so surfaces that predate the facet keep compiling; the page wires it.
   */
  languageOptions?: FacetOption<string>[];
  selectedLanguages?: ReadonlySet<string>;
  onToggleLanguage?: (language: string) => void;
  /** Total count of matching artifacts. */
  resultCount: number;
  /**
   * 1-based position of the first and last artifact on the current page, for the
   * "1–20 of 412 artifacts" line. Omitted, the line falls back to the total alone.
   */
  resultRange?: { start: number; end: number };
  /** Whether any filter, facet, or search query is currently non-default. */
  hasActiveFilters: boolean;
  /** Clears all active filters, facets, and search query. */
  onClearFilters: () => void;
  /** Current list order. Defaults to newest added. */
  sort?: ArtifactSort;
  /** Fired when the reader picks another order. The sort control is only shown when given. */
  onSortChange?: (sort: ArtifactSort) => void;
  /** The "Updated" window on last activity (last change, else import); open ends are null. */
  dateRange?: DateRange;
  /** Fired with a valid, ordered range. The date filter is only shown when given. */
  onDateRangeChange?: (range: DateRange, mode: KnowledgeBaseHistoryMode) => void;
  /** Fired when the user clicks the refresh button. */
  onRefresh?: () => void;
  /** Whether a refresh is currently in progress. */
  isRefreshing?: boolean;
  /** Whether upload checkboxes are showing (bulk delete). */
  isSelectMode?: boolean;
  /**
   * Toggles select mode. The Select button is only shown when given, and the
   * page gives it only to roles allowed to delete uploads — no dead control.
   */
  onSelectModeChange?: (on: boolean) => void;
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
  languages: ReadonlySet<string>,
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

  if (languages.size === 1) {
    parts.push([...languages][0]);
  } else if (languages.size > 1) {
    parts.push(`${languages.size} languages`);
  }

  return parts.join(" · ");
}

function isSource(value: string): value is SourceSystem {
  return (DEFAULT_SOURCE_ORDER as readonly string[]).includes(value);
}

function isUploadFormat(value: string): value is UploadFormat {
  return (DEFAULT_FORMAT_ORDER as readonly string[]).includes(value);
}

/** Repositories shown before the section folds behind "Show all". */
const REPOSITORY_VISIBLE_LIMIT = 10;

/** Stable empty range, so an omitted prop does not re-sync the date filter every render. */
const NO_DATE_RANGE: DateRange = { from: null, to: null };

/**
 * Prefix for language values inside the shared multi-select. Languages are free
 * strings, so an unprefixed "Markdown" (reachable by a hand-typed URL) would be
 * mistaken for the MARKDOWN format in the one selected set and in test ids.
 */
const LANGUAGE_VALUE_PREFIX = "lang:";
const NO_LANGUAGES: ReadonlySet<string> = new Set();
const NO_LANGUAGE_OPTIONS: FacetOption<string>[] = [];

/**
 * What the numbers beside each option mean. They are "what you would get if you
 * added this", not a project total, and nothing on screen said so.
 */
const FACET_COUNT_FOOTNOTE = "Counts show what you would get if you added this option.";

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
  languageOptions = NO_LANGUAGE_OPTIONS,
  selectedLanguages = NO_LANGUAGES,
  onToggleLanguage,
  resultCount,
  resultRange,
  hasActiveFilters,
  onClearFilters,
  onRefresh,
  isRefreshing,
  sort = DEFAULT_ARTIFACT_SORT,
  onSortChange,
  dateRange = NO_DATE_RANGE,
  onDateRangeChange,
  isSelectMode = false,
  onSelectModeChange,
}: ArtifactFiltersProps) {
  const searchHintId = useId();
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
        icon: <FolderGit2 className={ICON_CLASS} aria-hidden="true" />,
      })),
      // A connected org can bring dozens of repositories; past the threshold the
      // section gets a filter box and folds to the ten biggest (facets arrive
      // count-descending), with ticked ones always kept in view.
      searchable: true,
      visibleLimit: REPOSITORY_VISIBLE_LIMIT,
    });
  }

  if (languageOptions.length > 0) {
    sections.push({
      id: "languages",
      label: "Language",
      options: languageOptions.map((option) => ({
        value: `${LANGUAGE_VALUE_PREFIX}${option.value}`,
        label: option.label,
        count: option.count,
        icon: <Languages className={ICON_CLASS} aria-hidden="true" />,
      })),
    });
  }

  const selectedValues = new Set<string>([...selectedSources]);
  if (selectedFormat !== null) selectedValues.add(selectedFormat);
  for (const repository of selectedRepositories) selectedValues.add(repository);
  for (const language of selectedLanguages) {
    selectedValues.add(`${LANGUAGE_VALUE_PREFIX}${language}`);
  }

  const activeCount =
    selectedSources.size +
    (selectedFormat !== null ? 1 : 0) +
    selectedRepositories.size +
    selectedLanguages.size;

  const repositoryValues = new Set(repositoryOptions.map((option) => option.value));

  const handleToggle = (value: string) => {
    if (value.startsWith(LANGUAGE_VALUE_PREFIX)) {
      onToggleLanguage?.(value.slice(LANGUAGE_VALUE_PREFIX.length));
    } else if (isSource(value)) {
      onToggleSource(value);
    } else if (isUploadFormat(value)) {
      onToggleFormat(value);
    } else if (repositoryValues.has(value)) {
      onToggleRepository(value);
    }
    // A value matching no known facet does nothing on purpose: a facet added
    // later must be wired explicitly instead of silently falling through to
    // the repository toggle.
  };

  return (
    <div className="mb-6 flex flex-col gap-5">
      {/* Tier 1: Search bar with integrated refresh button */}
      <div className="flex flex-col gap-1.5">
        <Input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          data-testid="kb-search-input"
          aria-label="Search knowledge base"
          aria-describedby={searchHintId}
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
        {/*
        The backend matches the text against titles and source links only, never the content,
        so the hint says so: otherwise a phrase from inside a document finding nothing reads as
        "the knowledge base does not have it" rather than "search does not look there".
      */}
        <p id={searchHintId} className="text-xs text-app-text-muted" data-testid="kb-search-hint">
          Searches titles and links
        </p>
      </div>

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
          {formatResultRange(resultCount, resultRange)}
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

          {onDateRangeChange && (
            <ArtifactDateRangeFilter range={dateRange} onRangeChange={onDateRangeChange} />
          )}

          {onSortChange && (
            // The field style is `w-full`, so the width lives on a wrapper, as the filter's does.
            <div className="w-44 shrink-0">
              <Select
                size="sm"
                value={sort}
                onChange={(event) => onSortChange(event.target.value as ArtifactSort)}
                aria-label="Sort artifacts"
                data-testid="kb-sort"
              >
                {ARTIFACT_SORT_ORDER.map((option) => (
                  <option key={option} value={option}>
                    {SORT_LABELS[option]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {onSelectModeChange && (
            <Button
              variant={isSelectMode ? "primary" : "secondary"}
              size="sm"
              icon={<ListChecks className="h-4 w-4" aria-hidden="true" />}
              aria-pressed={isSelectMode}
              onClick={() => onSelectModeChange(!isSelectMode)}
              data-testid="kb-select-toggle"
              className="shrink-0"
            >
              {/* Constant label: a toggle's state is aria-pressed, not a changing name. */}
              Select
            </Button>
          )}

          <div className="min-w-0 flex-1 sm:w-80 sm:flex-none">
            <MultiSelectFilter
              label="Filter sources"
              summary={summariseSources(
                selectedSources,
                selectedFormat,
                selectedRepositories,
                selectedLanguages,
              )}
              activeCount={activeCount}
              sections={sections}
              selected={selectedValues}
              onToggle={handleToggle}
              size="sm"
              testId="kb-filter"
              className="w-full"
              collapsible={false}
              footnote={FACET_COUNT_FOOTNOTE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
