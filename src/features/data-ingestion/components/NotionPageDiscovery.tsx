import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ExternalLink,
  NotebookText,
  RefreshCw,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { Spinner } from "../../../components/ui/Spinner";
import { queryKeys } from "../../../services/queryKeys.ts";
import {
  notionService,
  type NotionCredentialDto,
  type NotionPageDto,
} from "../../../services/sources/notionService.ts";
import { describeNotionCredentialError } from "../../settings/components/notion/notionCredentialErrors.ts";

/** One ticked page, handed to the parent's connect flow. */
export type NotionPageSelection = {
  pageId: string;
  title: string;
  url: string;
};

type NotionPageDiscoveryProps = {
  credentials: NotionCredentialDto[];
  /** Controlled credential selection (the parent needs it at connect time). */
  credentialName: string;
  onCredentialNameChange: (name: string) => void;
  /**
   * Project the pages would be connected to, or `null` when there is no project
   * yet (the create-project wizard). With no project the "already in this
   * project" marker is skipped.
   */
  projectId: string | null;
  /** Page ids already staged in the parent's list; they cannot be picked twice. */
  stagedPageIds?: readonly string[];
  /** Reports the ticked pages whenever they change. Must be stable. */
  onSelectionChange: (selection: NotionPageSelection[]) => void;
  /** True while the parent runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
};

// Module-level so the default has a stable identity; a fresh array per render would re-run
// the selection memo and, through `onSelectionChange`, loop.
const NO_STAGED_PAGES: readonly string[] = [];

const DISCOVER_FALLBACK = "Pages could not be loaded.";

function pageTitle(page: NotionPageDto): string {
  return page.title.trim() || "Untitled";
}

/**
 * Multi-select list of the Notion pages a stored credential can see.
 *
 * Notion only returns pages that were shared with the credential's integration,
 * so an empty list usually means "share the page in Notion first" rather than
 * "there is nothing". Pages that already belong to the project, or are already
 * staged in the parent's list, are shown but cannot be ticked.
 *
 * The ticked pages are derived from the current credential's page list, so
 * switching credentials can never leave a page selected that the new credential
 * did not return. Owns discovery and the selection; the parent decides what
 * connecting means (immediate on the Data Ingestion page, staged in the wizard).
 */
export function NotionPageDiscovery({
  credentials,
  credentialName,
  onCredentialNameChange,
  projectId,
  stagedPageIds = NO_STAGED_PAGES,
  onSelectionChange,
  isConnecting = false,
}: NotionPageDiscoveryProps) {
  const hasCredentials = credentials.length > 0;
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pagesQuery = useQuery({
    queryKey: queryKeys.notion.pages(credentialName),
    queryFn: ({ signal }) => notionService.discoverPages(credentialName, signal),
    enabled: Boolean(credentialName),
    retry: false,
  });

  // A failed read only costs the "In this project" marker; the backend still
  // rejects a duplicate page when the connection is made.
  const connectionsQuery = useQuery({
    queryKey: queryKeys.notion.connections(projectId ?? ""),
    queryFn: () => notionService.listConnections(projectId as string),
    enabled: Boolean(projectId),
    retry: false,
  });

  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const connectedIds = useMemo(
    () => new Set((connectionsQuery.data ?? []).map((connection) => connection.pageId)),
    [connectionsQuery.data],
  );
  const stagedIds = useMemo(() => new Set(stagedPageIds), [stagedPageIds]);

  const isSelectable = (id: string) => !connectedIds.has(id) && !stagedIds.has(id);

  const filteredPages = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return pages;

    return pages.filter((page) => pageTitle(page).toLowerCase().includes(normalized));
  }, [filter, pages]);

  const selectableVisible = filteredPages.filter((page) => isSelectable(page.id));
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((page) => selected.has(page.id));

  const togglePage = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      selectableVisible.forEach((page) => {
        if (allVisibleSelected) {
          next.delete(page.id);
        } else {
          next.add(page.id);
        }
      });
      return next;
    });
  };

  const selection = useMemo<NotionPageSelection[]>(
    () =>
      pages
        .filter(
          (page) => selected.has(page.id) && !connectedIds.has(page.id) && !stagedIds.has(page.id),
        )
        .map((page) => ({ pageId: page.id, title: pageTitle(page), url: page.url })),
    [connectedIds, pages, selected, stagedIds],
  );

  // Report the ticked pages up. `onSelectionChange` must be stable (a state
  // setter or a memoised callback) so this only fires when the selection changes.
  useEffect(() => {
    onSelectionChange(selection);
  }, [onSelectionChange, selection]);

  const isLoading = pagesQuery.isFetching;
  const isBusy = isLoading || isConnecting;
  const loadError = pagesQuery.isError
    ? describeNotionCredentialError(pagesQuery.error, DISCOVER_FALLBACK)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <span className="text-sm font-medium text-app-text">Credential</span>
          <DropdownSelect
            label="Notion credential"
            value={credentialName}
            options={
              hasCredentials
                ? credentials.map((credential) => ({
                    value: credential.name,
                    label: credential.name,
                  }))
                : [{ value: "", label: "No saved credentials" }]
            }
            onChange={onCredentialNameChange}
            disabled={isConnecting || !hasCredentials}
            className="mt-2"
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => void pagesQuery.refetch()}
          disabled={isBusy || !credentialName}
          loading={isLoading}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Reload pages
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {isLoading && pages.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-app-text-muted">
          <Spinner size="sm" />
          Loading pages…
        </div>
      )}

      {pagesQuery.isSuccess && pages.length === 0 && (
        <EmptyState icon={<NotebookText className="h-8 w-8" />} title="No pages found">
          Notion only lists pages that were shared with the integration. Open the page in Notion,
          choose Connections in its menu, add your integration, then reload the pages here.
        </EmptyState>
      )}

      {pages.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:max-w-xs sm:flex-1">
              <Input
                size="sm"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter pages"
                aria-label="Filter pages"
                icon={<Search className="h-4 w-4" />}
              />
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="text-app-text-muted">{selection.length} selected</span>
              <button
                type="button"
                onClick={toggleAllVisible}
                disabled={selectableVisible.length === 0}
                className="rounded-lg px-2 py-1 font-semibold text-app-brand-text transition hover:bg-app-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {allVisibleSelected ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>

          {filteredPages.length === 0 ? (
            <EmptyState size="sm">No page matches this filter.</EmptyState>
          ) : (
            <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {filteredPages.map((page) => {
                const title = pageTitle(page);
                const inProject = connectedIds.has(page.id);
                const staged = !inProject && stagedIds.has(page.id);
                const disabledRow = !isSelectable(page.id);
                const isSelected = selected.has(page.id) && !disabledRow;

                return (
                  <li key={page.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        disabledRow
                          ? "cursor-not-allowed border-app-border bg-app-surface-muted opacity-70"
                          : isSelected
                            ? "border-app-brand bg-app-brand-soft shadow-sm"
                            : "border-app-border bg-app-surface hover:border-app-brand-border hover:bg-app-surface-hover"
                      }`}
                    >
                      <span className="relative flex shrink-0 items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={disabledRow || isConnecting}
                          onChange={() => togglePage(page.id)}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className={`flex h-5 w-5 items-center justify-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-app-focus peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-app-surface ${
                            isSelected
                              ? "border-app-brand bg-app-brand text-white"
                              : "border-app-border-strong bg-app-surface"
                          } ${disabledRow ? "opacity-60" : ""}`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </span>

                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
                        <span className="max-w-full min-w-0 truncate text-sm font-medium text-app-text sm:flex-1">
                          {title}
                        </span>

                        {page.lastEditedTime && (
                          <span className="shrink-0 text-xs text-app-text-muted">
                            Edited {new Date(page.lastEditedTime).toLocaleDateString()}
                          </span>
                        )}

                        {inProject && (
                          <Badge variant="neutral" size="sm" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            In this project
                          </Badge>
                        )}

                        {staged && (
                          <Badge variant="neutral" size="sm" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            In your list
                          </Badge>
                        )}
                      </div>

                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Open ${title} in Notion`}
                        className="shrink-0 text-app-text-muted transition hover:text-app-brand"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
