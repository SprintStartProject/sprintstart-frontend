import type { ReactNode } from "react";
import {
  BookOpen,
  Building2,
  CircleDot,
  File,
  FileCode,
  FileText,
  GitBranch,
  GitCommit,
  GitPullRequest,
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
import type { FacetOption } from "../hooks/useKnowledgeBase";
import {
  DEFAULT_FORMAT_ORDER,
  DEFAULT_SOURCE_ORDER,
  DEFAULT_TYPE_ORDER,
  FORMAT_LABELS,
  SOURCE_LABELS,
  TYPE_LABELS,
  type UploadFormat,
} from "../tabs";
import type { ArtifactType, SourceSystem } from "../types";

export type { ArtifactType, SourceSystem };

/** Props for {@link ArtifactFilters}. */
export interface ArtifactFiltersProps {
  searchQuery: string;
  /** Fired on every keystroke with the new search text. Resets pagination in the parent. */
  onSearchChange: (query: string) => void;
  /** Sources present in the project, with the count each would add. */
  sourceOptions: FacetOption<SourceSystem>[];
  /** Artifact types present in the project, with the count each would add. */
  typeOptions: FacetOption<ArtifactType>[];
  /**
   * Upload file formats, with counts. Empty unless Uploads is part of the source
   * selection — the facet describes uploads only, so the section disappears with
   * them and the hook owns that rule rather than the toolbar re-deriving it.
   */
  formatOptions: FacetOption<UploadFormat>[];
  selectedSources: ReadonlySet<SourceSystem>;
  selectedTypes: ReadonlySet<ArtifactType>;
  selectedFormat: UploadFormat | null;
  onToggleSource: (source: SourceSystem) => void;
  onToggleType: (type: ArtifactType) => void;
  onToggleFormat: (format: UploadFormat) => void;
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

const TYPE_ICONS: Record<ArtifactType, ReactNode> = {
  PULL_REQUEST: <GitPullRequest className={ICON_CLASS} aria-hidden="true" />,
  ISSUE: <CircleDot className={ICON_CLASS} aria-hidden="true" />,
  FILE: <FileCode className={ICON_CLASS} aria-hidden="true" />,
  PAGE: <FileText className={ICON_CLASS} aria-hidden="true" />,
  COMMIT: <GitCommit className={ICON_CLASS} aria-hidden="true" />,
  ORG_METADATA: <Building2 className={ICON_CLASS} aria-hidden="true" />,
};

const FORMAT_ICONS: Record<UploadFormat, ReactNode> = {
  PDF: <FileText className={ICON_CLASS} aria-hidden="true" />,
  MARKDOWN: <FileCode className={ICON_CLASS} aria-hidden="true" />,
  IMAGE: <ImageIcon className={ICON_CLASS} aria-hidden="true" />,
  OTHER: <File className={ICON_CLASS} aria-hidden="true" />,
};

/**
 * The trigger's text for the current selection.
 *
 * Names the values while there are few enough to read ("GitHub · Pull requests")
 * and counts them once there are not ("3 sources"), because a trigger that grows
 * with the selection eventually truncates to the one word that says least.
 */
function summariseSelection(
  sources: ReadonlySet<SourceSystem>,
  types: ReadonlySet<ArtifactType>,
  format: UploadFormat | null,
): string {
  const parts: string[] = [];

  if (sources.size === 1) parts.push(SOURCE_LABELS[[...sources][0]]);
  else if (sources.size > 1) parts.push(`${sources.size} sources`);

  if (types.size === 1) parts.push(TYPE_LABELS[[...types][0]]);
  else if (types.size > 1) parts.push(`${types.size} types`);

  if (format !== null) parts.push(FORMAT_LABELS[format]);

  return parts.length > 0 ? parts.join(" · ") : "All sources · All types";
}

/**
 * Whether a toggled value belongs to the source facet.
 *
 * The three facets share one flat `value` space in the dropdown — a checkbox
 * carries a plain string — and the value itself says which facet it came from,
 * so no section id has to be threaded through the toggle call.
 */
function isSource(value: string): value is SourceSystem {
  return (DEFAULT_SOURCE_ORDER as readonly string[]).includes(value);
}

function isArtifactType(value: string): value is ArtifactType {
  return (DEFAULT_TYPE_ORDER as readonly string[]).includes(value);
}

function isUploadFormat(value: string): value is UploadFormat {
  return (DEFAULT_FORMAT_ORDER as readonly string[]).includes(value);
}

/**
 * ArtifactFilters
 *
 * The knowledge base's filter bar: a search field, one multi-select filter over
 * the source / type / upload-format facets, and refresh.
 *
 * It replaced a two-tier bar of connector tabs plus contextual type chips. Those
 * could only ever express "one connector AND one type", and they made the type
 * list a property of the connector — which is why `Issues` and Jira's `Tickets`
 * existed as two names for one `artifactType`, and why the same `PRs`/`Issues`
 * chips had to be declared twice, once for `ALL` and once for `GITHUB`.
 *
 * **All the filter state lives in {@link useKnowledgeBase}.** This component
 * renders options and reports toggles; it does not decide what a selection means,
 * which is what keeps the visible list and the option counts from disagreeing.
 */
export function ArtifactFilters({
  searchQuery,
  onSearchChange,
  sourceOptions,
  typeOptions,
  formatOptions,
  selectedSources,
  selectedTypes,
  selectedFormat,
  onToggleSource,
  onToggleType,
  onToggleFormat,
  onRefresh,
  isRefreshing,
}: ArtifactFiltersProps) {
  // A section with nothing in it is not rendered at all: a heading over an empty
  // group reads as a loading state, and `Types` legitimately empties out once the
  // chosen sources cannot produce any type the project has.
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

  if (typeOptions.length > 0) {
    sections.push({
      id: "types",
      label: "Types",
      options: typeOptions.map((option) => ({
        value: option.value,
        label: option.label,
        count: option.count,
        icon: TYPE_ICONS[option.value],
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

  const selectedValues = new Set<string>([...selectedSources, ...selectedTypes]);
  if (selectedFormat !== null) selectedValues.add(selectedFormat);

  // One per non-empty facet, not per ticked box: "2" should mean "two of the
  // three things you can narrow by", so the reader can see at a glance that
  // nothing is narrowing the types.
  const activeCount =
    (selectedSources.size > 0 ? 1 : 0) +
    (selectedTypes.size > 0 ? 1 : 0) +
    (selectedFormat !== null ? 1 : 0);

  const handleToggle = (value: string) => {
    if (isSource(value)) onToggleSource(value);
    else if (isArtifactType(value)) onToggleType(value);
    else if (isUploadFormat(value)) onToggleFormat(value);
  };

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      {/*
        The filter leads the row and is the tallest control in it; the search box
        is the small one beside it. That is the reverse of the usual toolbar and
        it is deliberate: the trigger has to carry the reader's whole selection in
        words ("GitHub · Issues") and grows with it, while the search box is a
        single line of text that is never the thing being read.
      */}
      <MultiSelectFilter
        label="Filter artifacts"
        summary={summariseSelection(selectedSources, selectedTypes, selectedFormat)}
        activeCount={activeCount}
        sections={sections}
        selected={selectedValues}
        onToggle={handleToggle}
        size="md"
        testId="kb-filter"
        className="min-w-0 sm:flex-1"
      />

      <div className="w-full sm:w-64 sm:shrink-0">
        <Input
          type="text"
          size="sm"
          placeholder="Search artifacts..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          data-testid="kb-search-input"
          aria-label="Search knowledge base"
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {onRefresh && (
        <Button
          variant="secondary"
          size="sm"
          iconOnly
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Knowledge Base"
          aria-label="Refresh knowledge base"
          data-testid="kb-refresh"
          className="shrink-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-app-brand" : ""}`} />
        </Button>
      )}
    </div>
  );
}
