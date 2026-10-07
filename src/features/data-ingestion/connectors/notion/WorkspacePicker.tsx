import { AlertTriangle, ExternalLink, Info, NotebookText, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../../components/ui/Button.tsx";
import { DropdownSelect } from "../../../../components/ui/DropdownSelect.tsx";
import { EmptyState } from "../../../../components/ui/EmptyState.tsx";
import { IconTile } from "../../../../components/ui/IconTile.tsx";
import { Input } from "../../../../components/ui/Input.tsx";
import { Spinner } from "../../../../components/ui/Spinner.tsx";
import { queryKeys } from "../../../../services/queryKeys.ts";
import {
  notionService,
  type NotionCredentialDto,
  type NotionPageDto,
} from "../../../../services/sources/notionService.ts";
import { describeNotionCredentialError } from "../../../settings/components/notion/notionCredentialErrors.ts";
import { notionConnections } from "./connections.ts";

/** The workspace of the chosen credential, handed to the form's draft. */
export type NotionWorkspaceSelection = {
  credentialName: string;
  /** The credential's workspace, or the credential name when Notion names none. */
  workspaceName: string;
  /** Pages the credential can see right now, as counted by the preview. */
  pageCount: number;
};

type WorkspacePickerProps = {
  credentials: NotionCredentialDto[];
  /** Controlled credential selection (the form needs it at connect time). */
  credentialName: string;
  onCredentialNameChange: (name: string) => void;
  /**
   * Project the workspace would be connected to, or `null` when there is no
   * project yet (the create-project wizard). With no project the "already in
   * this project" check is skipped.
   */
  projectId: string | null;
  /**
   * Reports the connectable workspace, or `null` while there is none (preview not
   * loaded, or already connected). Must be stable.
   */
  onWorkspaceChange: (selection: NotionWorkspaceSelection | null) => void;
  /** True while the host runs its connect batch; locks the inputs. */
  isConnecting?: boolean;
};

const DISCOVER_FALLBACK = "Pages could not be loaded.";

function pageTitle(page: NotionPageDto): string {
  return page.title.trim() || "Untitled";
}

function pagesVisibleLabel(count: number): string {
  return count === 1 ? "1 page visible" : `${count} pages visible`;
}

/**
 * Connect step for Notion: picks the stored credential whose workspace gets
 * connected and shows a read-only preview of what the credential can see.
 *
 * A connection covers everything the credential can see, so there is nothing to
 * tick: the scope is whatever is shared with the token inside Notion, and an empty
 * preview usually means "share something in Notion first". The page list only
 * lets the user check that this is the workspace they meant.
 *
 * The workspace is reported up as connectable only once the preview has loaded
 * and the credential is not connected to the project already. The "already in this
 * project" check matches the project's connections by credential name, which is the
 * key the backend rejects duplicates by, so the backend's 409 stays the safety net.
 * Owns the preview; the host decides what connecting means (immediate on the Data
 * Ingestion page, staged in the wizard).
 */
export function NotionWorkspacePicker({
  credentials,
  credentialName,
  onCredentialNameChange,
  projectId,
  onWorkspaceChange,
  isConnecting = false,
}: WorkspacePickerProps) {
  const hasCredentials = credentials.length > 0;
  const [filter, setFilter] = useState("");

  const credential = credentials.find((candidate) => candidate.name === credentialName);
  const workspaceName = credential ? (credential.workspaceName ?? credential.name) : null;

  const pagesQuery = useQuery({
    queryKey: queryKeys.notion.pages(credentialName),
    queryFn: ({ signal }) => notionService.discoverPages(credentialName, signal),
    enabled: Boolean(credentialName),
    retry: false,
  });

  // A failed read only costs the "Already in this project" notice; the backend still
  // rejects a duplicate when the connection is made.
  const connectionsQuery = useQuery({
    queryKey: queryKeys.ingestion.connections(notionConnections.scope, projectId ?? ""),
    queryFn: () => notionConnections.load(projectId as string),
    enabled: Boolean(projectId),
    retry: false,
  });

  const pages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);
  const inProject = (connectionsQuery.data ?? []).some(
    (connection) => connection.credentialName === credentialName,
  );

  const filteredPages = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return pages;

    return pages.filter((page) => pageTitle(page).toLowerCase().includes(normalized));
  }, [filter, pages]);

  const pageCount = pagesQuery.isSuccess ? pages.length : null;
  const selection = useMemo<NotionWorkspaceSelection | null>(() => {
    if (workspaceName === null || pageCount === null || inProject) return null;

    return { credentialName, workspaceName, pageCount };
  }, [credentialName, inProject, pageCount, workspaceName]);

  // Report the connectable workspace up. `onWorkspaceChange` must be stable (a state
  // setter or a memoised callback) so this only fires when the selection changes.
  useEffect(() => {
    onWorkspaceChange(selection);
  }, [onWorkspaceChange, selection]);

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
                ? credentials.map((option) => ({
                    value: option.name,
                    label: option.workspaceName
                      ? `${option.name} · ${option.workspaceName}`
                      : option.name,
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

      {inProject && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Already in this project.</span>
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      )}

      {workspaceName !== null && (
        <div className="flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3">
          <IconTile icon={NotebookText} size="lg" tone="neutral" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-app-text" title={workspaceName}>
              {workspaceName}
            </p>
            <p className="text-xs text-app-text-muted">
              {pageCount === null ? "Counting pages…" : pagesVisibleLabel(pageCount)}
            </p>
          </div>
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
          Notion only lists pages that were shared with the token&apos;s integration. Open the page
          in Notion, choose Connections in its menu, add your integration, then reload the pages
          here.
        </EmptyState>
      )}

      {pages.length > 0 && (
        <div className="space-y-3">
          <div className="sm:max-w-xs">
            <Input
              size="sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter pages"
              aria-label="Filter pages"
              icon={<Search className="h-4 w-4" />}
            />
          </div>

          {filteredPages.length === 0 ? (
            <EmptyState size="sm">No page matches this filter.</EmptyState>
          ) : (
            <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {filteredPages.map((page) => {
                const title = pageTitle(page);

                return (
                  <li
                    key={page.id}
                    className="flex items-center gap-3 rounded-xl border border-app-border bg-app-surface px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:flex-nowrap">
                      <span
                        className="max-w-full min-w-0 truncate text-sm font-medium text-app-text sm:flex-1"
                        title={title}
                      >
                        {title}
                      </span>

                      {page.lastEditedTime && (
                        <span className="shrink-0 text-xs text-app-text-muted">
                          Edited {new Date(page.lastEditedTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${title} in Notion`}
                      className="shrink-0 text-app-text-muted transition hover:text-app-brand"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
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
