import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { getProjectArtifacts } from "../../../services/ingestionService.ts";
import { formatDateTime, formatNumber, getSourceLabel } from "../data.ts";
import type { Artifact, ArtifactPage, DataSource } from "../types.ts";

type ArtifactTableProps = {
  projectId: string | null;
  sources: DataSource[];
};

type LoadingState = "idle" | "loading" | "success" | "error";

const ARTIFACT_PAGE_SIZE = 10;
const EMPTY_ARTIFACT_PAGE: ArtifactPage = {
  items: [],
  page: {
    number: 1,
    size: ARTIFACT_PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  },
};

/**
 * Displays persisted ingestion artifacts for the selected project.
 * The rows come from the backend artifact listing instead of inferred run counters.
 */
export function ArtifactTable({ projectId, sources }: ArtifactTableProps) {
  const [artifactPage, setArtifactPage] =
    useState<ArtifactPage>(EMPTY_ARTIFACT_PAGE);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [draftFilter, setDraftFilter] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      if (!projectId) {
        if (!isMounted) return;

        setArtifactPage(EMPTY_ARTIFACT_PAGE);
        setLoadingState("idle");
        setErrorMessage(null);
        return;
      }

      if (!isMounted) return;
      setLoadingState("loading");
      setErrorMessage(null);

      try {
        const nextArtifactPage = await getProjectArtifacts(projectId, {
          page: pageNumber,
          size: ARTIFACT_PAGE_SIZE,
          filter,
        });

        if (!isMounted) return;

        setArtifactPage(nextArtifactPage);
        setLoadingState("success");
      } catch (error) {
        if (!isMounted) return;

        setArtifactPage(EMPTY_ARTIFACT_PAGE);
        setLoadingState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Artifacts could not be loaded.",
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [filter, pageNumber, projectId]);

  const sourceCount = useMemo(
    () =>
      new Set(artifactPage.items.map((artifact) => artifact.sourceSystem)).size,
    [artifactPage.items],
  );
  const failedCount = sources.reduce((sum, source) => sum + source.errors, 0);
  const isLoading = loadingState === "loading";
  const hasArtifacts = artifactPage.items.length > 0;

  const submitFilter = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPageNumber(1);
    setFilter(draftFilter.trim());
  };

  const clearFilter = () => {
    setDraftFilter("");
    setFilter("");
    setPageNumber(1);
  };

  if (!projectId) {
    return (
      <EmptyState value="Select a project to browse ingested artifacts." />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Artifacts"
          value={formatNumber(artifactPage.page.totalElements)}
          description={
            filter ? "matching current search" : "stored for this project"
          }
        />

        <SummaryCard
          title="Visible Sources"
          value={formatNumber(sourceCount)}
          description="source systems on this page"
        />

        <SummaryCard
          title="Latest Failures"
          value={formatNumber(failedCount)}
          description="from latest source statuses"
          warning={failedCount > 0}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-app-border bg-app-surface">
        <div className="flex flex-col gap-4 border-b border-app-border bg-app-bg-soft px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-app-text">
              Project Artifacts
            </h3>
            <p className="mt-1 text-sm text-app-text-muted">
              Persisted artifacts returned by the ingestion backend.
            </p>
          </div>

          <form
            onSubmit={submitFilter}
            className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl"
          >
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Search artifacts</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-disabled" />
              <input
                value={draftFilter}
                onChange={(event) => setDraftFilter(event.target.value)}
                placeholder="Search title, type or source"
                className="h-11 w-full rounded-xl border border-app-border bg-app-surface pl-10 pr-3 text-sm text-app-text outline-none transition focus:border-app-brand-border-strong focus:ring-2 focus:ring-app-brand-glow"
              />
            </label>

            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-app-brand px-4 text-sm font-medium text-app-text-inverse transition hover:bg-app-brand-hover"
            >
              Search
            </button>

            {filter && (
              <button
                type="button"
                onClick={clearFilter}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text transition hover:bg-app-surface-hover"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {errorMessage && (
          <div className="border-b border-app-warning-border bg-app-warning-bg px-5 py-3 text-sm text-app-warning-text">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center bg-app-surface px-5 py-10">
            <div className="flex items-center gap-3 text-sm text-app-text-muted">
              <Loader2 className="h-5 w-5 animate-spin text-app-brand" />
              Loading artifacts...
            </div>
          </div>
        ) : hasArtifacts ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-app-border text-left text-sm">
                <thead className="bg-app-surface-muted text-xs uppercase tracking-wide text-app-text-subtle">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Artifact
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Source
                    </th>
                    <th scope="col" className="px-5 py-3 font-semibold">
                      Ingested
                    </th>

                    <th scope="col" className="px-5 py-3 font-semibold">
                      Link
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-app-border bg-app-surface">
                  {artifactPage.items.map((artifact) => (
                    <ArtifactRow key={artifact.id} artifact={artifact} />
                  ))}
                </tbody>
              </table>
            </div>

            <ArtifactPagination
              artifactPage={artifactPage}
              onPrevious={() =>
                setPageNumber((current) => Math.max(current - 1, 1))
              }
              onNext={() => setPageNumber((current) => current + 1)}
            />
          </>
        ) : (
          <EmptyState
            value={
              filter
                ? "No artifacts match the current search."
                : "No ingested artifacts have been returned for this project yet."
            }
          />
        )}
      </section>
    </div>
  );
}

function ArtifactRow({ artifact }: { artifact: Artifact }) {
  const title = artifact.title?.trim() || artifact.id;

  return (
    <tr className="align-top transition hover:bg-app-surface-hover">
      <td className="max-w-md px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-bg-soft text-app-text-muted">
            <FileText className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <p className="break-words font-semibold text-app-text">{title}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{artifact.artifactType.replace("_", " ")}</Badge>
              <span className="break-all font-mono text-xs text-app-text-subtle">
                {artifact.id}
              </span>
            </div>
          </div>
        </div>
      </td>

      <td className="px-5 py-4 text-app-text-muted">
        {getSourceLabel(artifact.sourceSystem)}
      </td>

      <td className="whitespace-nowrap px-5 py-4 text-app-text-muted">
        {formatDateTime(artifact.ingestedAt)}
      </td>

      <td className="px-5 py-4">
        {artifact.sourceUrl ? (
          <a
            href={artifact.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-app-surface px-3 py-2 text-xs font-medium text-app-brand transition hover:bg-app-surface-hover hover:text-app-brand-hover"
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-sm text-app-text-disabled">No link</span>
        )}
      </td>
    </tr>
  );
}

function ArtifactPagination({
  artifactPage,
  onPrevious,
  onNext,
}: {
  artifactPage: ArtifactPage;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const firstVisible =
    artifactPage.page.totalElements === 0
      ? 0
      : (artifactPage.page.number - 1) * artifactPage.page.size + 1;
  const lastVisible = Math.min(
    artifactPage.page.number * artifactPage.page.size,
    artifactPage.page.totalElements,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-app-border bg-app-bg-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-app-text-muted">
        Showing {formatNumber(firstVisible)}-{formatNumber(lastVisible)} of{" "}
        {formatNumber(artifactPage.page.totalElements)} artifacts
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!artifactPage.page.hasPrevious}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!artifactPage.page.hasNext}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-app-border bg-app-surface px-4 text-sm font-medium text-app-text transition hover:bg-app-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  warning = false,
}: {
  title: string;
  value: string;
  description: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-app-text-muted">{title}</p>
          <p className="mt-2 text-3xl font-bold text-app-text">{value}</p>
        </div>

        {warning ? (
          <AlertTriangle className="h-5 w-5 text-app-warning-solid" />
        ) : (
          <FileText className="h-5 w-5 text-app-brand" />
        )}
      </div>

      <p className="mt-3 text-sm text-app-text-muted">{description}</p>
    </div>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-app-neutral-bg px-2.5 py-1 text-xs font-medium text-app-neutral-text">
      {children}
    </span>
  );
}

function EmptyState({ value }: { value: string }) {
  return (
    <div className="bg-app-surface px-5 py-10 text-center text-sm text-app-text-muted">
      {value}
    </div>
  );
}
