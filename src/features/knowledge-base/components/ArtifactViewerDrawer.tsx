import { useEffect, useReducer, useRef, useMemo, useCallback, type ReactNode } from "react";
import {
  Sparkles,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  ArrowDown,
  BookOpen,
  Building2,
  MapPin,
  Globe,
  Mail,
  Users,
  Hash,
  Link2,
} from "lucide-react";
import ReactMarkdown, { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Artifact, ArtifactContent, ArtifactSummaryCitation } from "../types";
import { preprocessMarkdown } from "../markdown";
import {
  parseOrgMetadata,
  type OrgMetadataArtifactMetadata,
  type OrgMetadataTeam,
} from "../orgMetadata";
import { knowledgeService } from "../../../services/knowledgeService";
import { useToast } from "../../../context/useToast";
import { Button } from "../../../components/ui/Button";
import { ApiError } from "../../../services/apiClient";
import { SidePanel } from "../../../components/ui/SidePanel";
import { Modal } from "../../../components/ui/Modal";
import { useAuth } from "../../../context/useAuth";
import { CitationsList } from "./CitationsList";

/**
 * Props for the ArtifactViewerDrawer component.
 */
interface ArtifactViewerDrawerProps {
  artifact: Artifact | null;
  /** Closes the drawer and clears the selected artifact in the parent. */
  onClose: () => void;
  /** Project scope required to fetch the artifact content and summary. */
  projectId: string;
  /** Optional line numbers to highlight and scroll into view. */
  highlightLines?: number[];
  /** When true, renders the Delete button for UPLOAD-sourced artifacts. The
   *  parent gates this via accessPolicy Pattern A (PM/HR/ADMIN only). */
  canDelete: boolean;
  /** Called after a successful deletion so the parent can clear the selection
   *  and re-fetch the artifact list. */
  onDelete: (artifactId: string) => void;
}

type ViewMode = "raw" | "summary";
type MarkdownViewMode = "rendered" | "source";

interface DrawerState {
  viewMode: ViewMode;
  markdownViewMode: MarkdownViewMode;
  content: ArtifactContent | null;
  summary: string;
  citations: ArtifactSummaryCitation[];
  isLoading: boolean;
  isFetchingSummary: boolean;
  isIndexing: boolean;
  isDeleting: boolean;
  isConfirmDeleteOpen: boolean;
  stageDetail?: string;
  error: string | null;
}

type DrawerAction =
  | { type: "reset" }
  | { type: "loadStart" }
  | { type: "loadSuccess"; content: ArtifactContent }
  | { type: "loadError"; error: string }
  | { type: "skipContentLoad" }
  | { type: "setMarkdownViewMode"; mode: MarkdownViewMode }
  | { type: "summarizeStart" }
  | { type: "summarizeIndexing" }
  | { type: "summarizeStage"; name: string; detail: string }
  | { type: "summarizeToken"; chunk: string }
  | { type: "summarizeCitation"; citation: ArtifactSummaryCitation }
  | { type: "summarizeDone" }
  | { type: "summarizeError"; error: string }
  | { type: "showRaw" }
  | { type: "deleteStart" }
  | { type: "deleteSuccess" }
  | { type: "deleteFailed" }
  | { type: "openDeleteConfirm" }
  | { type: "closeDeleteConfirm" };

const initialState: DrawerState = {
  viewMode: "raw",
  markdownViewMode: "rendered",
  content: null,
  summary: "",
  citations: [],
  isLoading: false,
  isFetchingSummary: false,
  isIndexing: false,
  isDeleting: false,
  isConfirmDeleteOpen: false,
  stageDetail: undefined,
  error: null,
};

function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
  switch (action.type) {
    case "reset":
      return { ...initialState, isLoading: true };
    case "loadStart":
      return { ...state, isLoading: true, error: null };
    case "loadSuccess":
      return { ...state, isLoading: false, content: action.content };
    case "skipContentLoad":
      // ORG_METADATA artifacts have no stored content (their content endpoint
      // redirects), so nothing to fetch — just end the loading state.
      return { ...state, isLoading: false };
    case "loadError":
      return { ...state, isLoading: false, error: action.error };
    case "setMarkdownViewMode":
      return { ...state, markdownViewMode: action.mode };
    case "summarizeStart":
      return {
        ...state,
        viewMode: "summary",
        summary: "",
        citations: [],
        isFetchingSummary: true,
        isIndexing: false,
        stageDetail: undefined,
        error: null,
      };
    case "summarizeIndexing":
      return { ...state, isFetchingSummary: true, isIndexing: true, stageDetail: undefined };
    case "summarizeStage":
      return { ...state, isFetchingSummary: true, isIndexing: false, stageDetail: action.detail };
    case "summarizeToken":
      return { ...state, summary: state.summary + action.chunk };
    case "summarizeCitation":
      return { ...state, citations: [...state.citations, action.citation] };
    case "summarizeDone":
      return { ...state, isFetchingSummary: false, isIndexing: false };
    case "summarizeError":
      return { ...state, isFetchingSummary: false, isIndexing: false, error: action.error };
    case "showRaw":
      return { ...state, viewMode: "raw" };
    case "deleteStart":
      return { ...state, isDeleting: true };
    case "deleteSuccess":
      return { ...state, isDeleting: false };
    case "deleteFailed":
      return { ...state, isDeleting: false };
    case "openDeleteConfirm":
      return { ...state, isConfirmDeleteOpen: true };
    case "closeDeleteConfirm":
      return { ...state, isConfirmDeleteOpen: false };
    default:
      return state;
  }
}

/**
 * Determines whether an artifact should be rendered as Markdown.
 * Issues, Pull Requests, Jira items, and Markdown files (.md/.markdown) are always rendered as Markdown.
 */
const shouldRenderAsMarkdown = (
  content: ArtifactContent | null | undefined,
  artifact: Artifact | null,
): boolean => {
  if (!content) return false;
  const title = artifact?.title?.toLowerCase() ?? "";
  const sourceUrl = artifact?.sourceUrl?.toLowerCase() ?? "";

  const isMd =
    title.endsWith(".md") ||
    title.endsWith(".markdown") ||
    title.endsWith(".mdown") ||
    title.endsWith(".mkd");

  const isPrOrIssue =
    artifact?.artifactType === "ISSUE" ||
    artifact?.artifactType === "PULL_REQUEST" ||
    title.startsWith("pr #") ||
    title.startsWith("pull request") ||
    title.startsWith("issue #") ||
    title.startsWith("jira #") ||
    sourceUrl.includes("/pull/") ||
    sourceUrl.includes("/issues/") ||
    sourceUrl.includes("/browse/");

  return content.mimeType.startsWith("text/markdown") || isPrOrIssue || isMd;
};

// Hoisted to module scope so ReactMarkdown doesn't see a new array on every render
// (otherwise it always re-renders even when the content is unchanged).
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [
  [rehypeKatex, { strict: "ignore", errorColor: "inherit" }],
];

type UnistPosition = {
  start: { line: number; column: number; offset?: number };
  end: { line: number; column: number; offset?: number };
};

type HastNode = {
  type?: string;
  tagName?: string;
  position?: UnistPosition;
};

/**
 * Checks whether an AST node's line position intersects with the requested highlight lines.
 */
function isNodeHighlighted(
  node?: HastNode,
  highlightLines?: number[],
): { isHighlighted: boolean; startLine?: number; endLine?: number } {
  if (!highlightLines || highlightLines.length === 0 || !node?.position) {
    return { isHighlighted: false };
  }
  const start = node.position.start.line;
  const end = node.position.end.line;
  const isHighlighted = highlightLines.some((line) => line >= start && line <= end);
  return { isHighlighted, startLine: start, endLine: end };
}

function formatLineRanges(lines?: number[]): string {
  if (!lines || lines.length === 0) return "";
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  if (sorted.length === 1) return `Line ${sorted[0]}`;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (last === first) return `Line ${first}`;
  return `Lines ${first}–${last}`;
}

const STATIC_MARKDOWN_COMPONENTS = {
  code({ className, children }: { className?: string; children?: ReactNode }) {
    const match = /language-(\w+)/.exec(className || "");
    if (!match) {
      return <code className={className}>{children}</code>;
    }
    return (
      <div className="my-4 overflow-hidden rounded-lg border border-app-border text-sm">
        <SyntaxHighlighter
          language={match[1]}
          style={vscDarkPlus}
          showLineNumbers={false}
          wrapLines={true}
          customStyle={{ margin: 0, padding: "1rem", backgroundColor: "var(--color-app-bg)" }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    );
  },
  pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
} as const;

function createMarkdownComponents(highlightLines?: number[]) {
  const highlightClass =
    "rounded-r-lg border-l-4 border-app-brand bg-app-brand-soft/75 px-3.5 py-2 my-2 shadow-xs ring-1 ring-app-brand-border/50 transition-colors dark:bg-app-brand/20 dark:ring-app-brand/30";

  return {
    code({
      className,
      children,
      node,
    }: {
      className?: string;
      children?: ReactNode;
      node?: HastNode;
    }) {
      const match = /language-(\w+)/.exec(className || "");
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      if (!match) {
        return (
          <code
            data-highlighted={isHighlighted || undefined}
            className={`${className || ""} ${
              isHighlighted
                ? "rounded bg-app-brand-soft px-1 py-0.5 font-bold text-app-brand-text ring-1 ring-app-brand-border dark:bg-app-brand/30 dark:text-app-text"
                : ""
            }`}
          >
            {children}
          </code>
        );
      }
      return (
        <div
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`my-4 overflow-hidden rounded-lg border text-sm transition-all ${
            isHighlighted
              ? "border-app-brand shadow-sm ring-2 ring-app-brand/40"
              : "border-app-border"
          }`}
        >
          <SyntaxHighlighter
            language={match[1]}
            style={vscDarkPlus}
            showLineNumbers={false}
            wrapLines={true}
            customStyle={{ margin: 0, padding: "1rem", backgroundColor: "var(--color-app-bg)" }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        </div>
      );
    },
    pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
    p({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <p
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </p>
      );
    },
    h1({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h1
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h1>
      );
    },
    h2({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h2
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h2>
      );
    },
    h3({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h3
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h3>
      );
    },
    h4({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h4
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h4>
      );
    },
    h5({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h5
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h5>
      );
    },
    h6({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <h6
          id={startLine ? `line-${startLine}` : undefined}
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </h6>
      );
    },
    blockquote({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <blockquote
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${isHighlighted ? highlightClass : ""}`}
        >
          {children}
        </blockquote>
      );
    },
    li({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <li
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${
            isHighlighted
              ? "my-1 rounded-r-md border-l-4 border-app-brand bg-app-brand-soft/75 py-1 pr-1.5 pl-2.5 ring-1 ring-app-brand-border/50 dark:bg-app-brand/20 dark:ring-app-brand/30"
              : ""
          }`}
        >
          {children}
        </li>
      );
    },
    tr({
      children,
      node,
      className,
    }: {
      children?: ReactNode;
      node?: HastNode;
      className?: string;
    }) {
      const { isHighlighted, startLine, endLine } = isNodeHighlighted(node, highlightLines);
      return (
        <tr
          data-highlighted={isHighlighted || undefined}
          data-line-start={startLine}
          data-line-end={endLine}
          className={`${className || ""} ${
            isHighlighted
              ? "border-l-4 border-app-brand bg-app-brand-soft/80 font-medium dark:bg-app-brand/25"
              : ""
          }`}
        >
          {children}
        </tr>
      );
    },
  };
}

const getLanguage = (filename?: string | null) => {
  if (!filename) return "text";
  const ext = filename.split(".").pop()?.toLowerCase();
  if (filename.toLowerCase() === "dockerfile") return "docker";
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "kt":
    case "kts":
      return "kotlin";
    case "java":
      return "java";
    case "md":
      return "markdown";
    case "json":
      return "json";
    case "yml":
    case "yaml":
      return "yaml";
    case "sh":
      return "bash";
    case "html":
      return "markup";
    case "css":
      return "css";
    case "sql":
      return "sql";
    case "xml":
      return "xml";
    case "csv":
      return "csv";
    default:
      // Plain text beats guessing TypeScript: extension-less titles (LICENSE,
      // Makefile, dotfiles) and unknown extensions rendered as TS produce
      // nonsense highlighting; unstyled plain text stays honest.
      return "text";
  }
};

/**
 * Renders a labeled metadata row (icon + label + value) for the org profile.
 */
function OrgProfileRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-app-text-subtle">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-app-text-subtle">{label}</dt>
        <dd className="text-sm text-app-text">{children}</dd>
      </div>
    </div>
  );
}

/** GitHub's `blog` is usually a URL; link it, prefixing a scheme when bare. */
function normalizeUrl(value: string | null): string | null {
  const trimmed = value?.trim();
  // Shortest realistic hostname is 4 chars (e.g. a.io); anything shorter
  // (including "N/A", "?", whitespace) is not a real URL and must not be linked.
  if (!trimmed || trimmed.length < 4) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Org profile view, rendered purely from the artifact's `metadata` JSON.
 *  Teams and members are always fully expanded. */
function OrgMetadataView({
  metadata,
  title,
}: {
  metadata: OrgMetadataArtifactMetadata | null;
  title: string | null;
}) {
  if (!metadata) {
    // Known backend gap: the org artifact exists but its metadata couldn't be
    // parsed. Show a quiet empty state instead of killing the drawer or falling
    // through to the (redirect-following) content fetch.
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-app-text-muted">
        <Building2 className="h-10 w-10 opacity-50" />
        <p className="text-sm">Organization profile unavailable.</p>
      </div>
    );
  }

  const blogUrl = normalizeUrl(metadata.blog);

  return (
    <div className="space-y-6" data-testid="org-metadata-view">
      <header className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl border border-app-border bg-app-bg-soft p-2.5">
          <Building2 className="h-6 w-6 text-app-text-muted" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-app-text">
            {metadata.name || title || "Organization"}
          </h2>
          <a
            href={`https://github.com/${metadata.login}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-app-brand hover:underline"
          >
            @{metadata.login}
          </a>
          {metadata.description && (
            <p className="mt-2 text-sm text-app-text-muted">{metadata.description}</p>
          )}
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        {metadata.location && (
          <OrgProfileRow icon={<MapPin className="h-4 w-4" />} label="Location">
            {metadata.location}
          </OrgProfileRow>
        )}
        {blogUrl && (
          <OrgProfileRow icon={<Globe className="h-4 w-4" />} label="Blog">
            <a
              href={blogUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-app-brand hover:underline"
            >
              <Link2 className="h-3.5 w-3.5" />
              {metadata.blog}
            </a>
          </OrgProfileRow>
        )}
        {metadata.company && (
          <OrgProfileRow icon={<Building2 className="h-4 w-4" />} label="Company">
            {metadata.company}
          </OrgProfileRow>
        )}
        {metadata.email && (
          <OrgProfileRow icon={<Mail className="h-4 w-4" />} label="Email">
            <a href={`mailto:${metadata.email}`} className="text-app-brand hover:underline">
              {metadata.email}
            </a>
          </OrgProfileRow>
        )}
        <OrgProfileRow icon={<Hash className="h-4 w-4" />} label="Repositories">
          {metadata.publicRepos !== null && metadata.privateRepos !== null ? (
            <>
              {metadata.publicRepos} public · {metadata.privateRepos} private
            </>
          ) : (
            "N/A"
          )}
        </OrgProfileRow>
      </dl>

      {metadata.teams && metadata.teams.length > 0 && (
        <section aria-label="Teams">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-text">
            <Users className="h-4 w-4 text-app-text-subtle" />
            Teams
          </h3>
          <div className="space-y-3">
            {metadata.teams.map((team: OrgMetadataTeam) => (
              <div
                key={team.slug ?? team.name}
                className="rounded-xl border border-app-border bg-app-bg-soft/60 p-3.5"
              >
                <p className="text-sm font-semibold text-app-text">{team.name}</p>
                {team.members.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {team.members.map((member) => (
                      <li
                        key={member.login}
                        className="rounded-md border border-app-border bg-app-bg px-2 py-0.5 text-xs text-app-text-muted"
                      >
                        {member.login}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {metadata.members.length > 0 && (
        <section aria-label="Members">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-app-text">
            <Users className="h-4 w-4 text-app-text-subtle" />
            Members
            <span className="rounded-full bg-app-surface px-2 py-0.5 text-xs font-bold text-app-text-subtle">
              {metadata.members.length}
            </span>
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {metadata.members.map((member) => (
              <li key={member.login}>
                <a
                  href={member.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-app-border bg-app-bg px-2 py-1 text-xs text-app-text-muted transition-colors hover:border-app-brand/50 hover:text-app-brand"
                >
                  <Users className="h-3 w-3" />
                  {member.login}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * ArtifactViewerDrawer
 *
 * Slide-out panel that displays the raw content of a selected artifact.
 * Allows users to trigger an AI summarization of the content to quickly extract key information
 * without reading massive files or issues. The summary is streamed over Server-Sent Events and
 * rendered incrementally as tokens arrive; citation metadata is rendered as a source list.
 */
export function ArtifactViewerDrawer({
  artifact,
  onClose,
  projectId,
  highlightLines,
  canDelete,
  onDelete,
}: ArtifactViewerDrawerProps) {
  const { profile } = useAuth();
  const [state, dispatch] = useReducer(drawerReducer, initialState);
  const toast = useToast();

  const abortRef = useRef<AbortController | null>(null);
  // Bumped each time the user switches artifact or unmounts. Long-running
  // summarize loops read this to bail out before dispatching into a stale reducer.
  const summarizeGenerationRef = useRef(0);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Loads the raw artifact content from the backend whenever a new artifact is selected.
   * Required to properly render the markdown or raw text in the drawer.
   */
  useEffect(() => {
    if (!artifact) return;

    // Invalidate any in-flight summarize loop: when the artifact changes, the
    // previous loop's pending retry delay must not start a new stream for the
    // old artifact, and must not abort the new artifact's controller.
    summarizeGenerationRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;

    let isMounted = true;
    // `reset` action also closes any open delete-confirm modal so a stale
    // confirmation for the previous artifact can't be carried over.
    dispatch({ type: "reset" });

    // ORG_METADATA artifacts carry no stored bytes: the backend's content
    // endpoint answers a 302 redirect to the org's GitHub page, and following it
    // would land the drawer on GitHub's HTML. They render purely from
    // `artifact.metadata` (org profile/teams/members), so skip the fetch entirely.
    if (artifact.artifactType === "ORG_METADATA") {
      dispatch({ type: "skipContentLoad" });
      const myGeneration = summarizeGenerationRef.current;
      return () => {
        isMounted = false;
        summarizeGenerationRef.current = myGeneration + 1;
        abortRef.current?.abort();
        abortRef.current = null;
      };
    }

    knowledgeService
      .getArtifactContent(projectId, artifact.id, artifact.sourceSystem)
      .then((data) => {
        if (isMounted) dispatch({ type: "loadSuccess", content: data });
      })
      .catch((err) => {
        if (isMounted)
          dispatch({ type: "loadError", error: err instanceof Error ? err.message : String(err) });
      });

    const myGeneration = summarizeGenerationRef.current;
    return () => {
      isMounted = false;
      // Bump unconditionally: unmount or artifact switch invalidates any in-flight
      // summarize loop captured against `myGeneration`. Idempotent if already bumped.
      summarizeGenerationRef.current = myGeneration + 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [artifact, projectId]);

  useEffect(() => {
    const currentContent = state.content;
    return () => {
      if (currentContent?.isObjectUrl) {
        URL.revokeObjectURL(currentContent.content);
      }
    };
  }, [state.content]);

  const scrollToHighlightedChunk = useCallback(() => {
    if (!highlightLines || highlightLines.length === 0) return;
    const container = contentContainerRef.current;
    if (!container) return;

    const firstLine = Math.min(...highlightLines);
    const directLineEl = container.querySelector<HTMLElement>(`#line-${firstLine}`);
    if (directLineEl) {
      directLineEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const highlightedEl = container.querySelector<HTMLElement>("[data-highlighted='true']");
    if (highlightedEl) {
      highlightedEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const allLineElements = container.querySelectorAll<HTMLElement>("[data-line-start]");
    for (const el of allLineElements) {
      const start = Number(el.dataset.lineStart);
      const end = Number(el.dataset.lineEnd || start);
      if (firstLine >= start && firstLine <= end) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
  }, [highlightLines]);

  useEffect(() => {
    if (
      highlightLines &&
      highlightLines.length > 0 &&
      state.viewMode === "raw" &&
      !state.isLoading &&
      state.content
    ) {
      // 120ms delay lets ReactMarkdown / SyntaxHighlighter finish rendering DOM nodes
      // before we try to scroll to one.
      const timer = setTimeout(() => {
        scrollToHighlightedChunk();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [
    highlightLines,
    state.viewMode,
    state.isLoading,
    state.content,
    state.markdownViewMode,
    scrollToHighlightedChunk,
  ]);

  const markdownComponents = useMemo(
    () => createMarkdownComponents(highlightLines),
    [highlightLines],
  );

  /**
   * Triggers the AI summarization stream for the currently loaded artifact.
   *
   * The backend may return 503 when the artifact is still being indexed by the AI service
   * (the async ingestion hasn't completed yet). In that case the handler aborts the current
   * stream and retries with exponential backoff (2s, 4s, 8s, ... capped at 30s), showing a
   * "Preparing summary..." spinner until the artifact is ready. Non-503 errors surface
   * immediately with a retry button.
   *
   * Race-safety: each invocation captures a generation token; the content-load effect bumps
   * `summarizeGenerationRef` on artifact change/unmount, so a pending retry delay for the
   * previous artifact bails out before starting a stale stream. The retry delay itself is
   * wired to the same `AbortController` as the stream, so unmount cancels both the in-flight
   * fetch and the pending timeout.
   */
  const handleSummarize = async () => {
    if (!artifact) return;

    const myGeneration = ++summarizeGenerationRef.current;
    dispatch({ type: "summarizeStart" });

    let attempt = 0;
    while (true) {
      if (myGeneration !== summarizeGenerationRef.current) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await knowledgeService.streamArtifactSummary(
          projectId,
          artifact.id,
          {
            onStage: (name, detail) => dispatch({ type: "summarizeStage", name, detail }),
            onToken: (chunk) => dispatch({ type: "summarizeToken", chunk }),
            onCitation: (citation) => dispatch({ type: "summarizeCitation", citation }),
            onDone: () => dispatch({ type: "summarizeDone" }),
          },
          controller.signal,
        );
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        const isStillIndexing = err instanceof ApiError && err.status === 503;
        if (!isStillIndexing) {
          const message = err instanceof Error ? err.message : "Failed to summarize";
          dispatch({ type: "summarizeError", error: message });
          return;
        }
        dispatch({ type: "summarizeIndexing" });
        const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
        // Abortable sleep: if the controller aborts (unmount / artifact change /
        // a newer summarize loop), stop immediately instead of waiting out the
        // timer. Resolves `true` rather than rejecting: `handleSummarize` runs
        // fire-and-forget (`void handleSummarize()`), so a rejected sleep would
        // escape as an unhandled promise rejection.
        const aborted = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), delay);
          controller.signal.addEventListener(
            "abort",
            () => {
              clearTimeout(timer);
              resolve(true);
            },
            { once: true },
          );
        });
        if (aborted) {
          return;
        }
        attempt++;
      }
    }
  };

  const {
    viewMode,
    markdownViewMode,
    content,
    summary,
    citations,
    isLoading,
    isFetchingSummary,
    isIndexing,
    isDeleting,
    isConfirmDeleteOpen,
    stageDetail,
    error,
  } = state;

  /**
   * Deletes the currently selected uploaded artifact.
   *
   * Confirms via an alertdialog before issuing the delete. The `removerId` is
   * the authenticated user's id; the backend uses it for audit and project-
   * membership validation. On success the parent `onDelete` callback clears
   * the selection and re-fetches the artifact list. Errors are surfaced in
   * the modal's own error slot (not the content-load error slot) so the
   * artifact view stays visible while the user retries.
   *
   * @remarks The delete endpoint expects the `UploadedArtifact`'s UUID, not
   * the ingestion `Artifact`'s UUID. The displayed artifact is usually the
   * ingestion mirror (its `id` is the ingestion UUID); the corresponding
   * `UploadedArtifact` id is carried in `artifact.sourceId`, which
   * `getUnifiedArtifacts` enriches via title-matching against the uploads
   * list. When `sourceId` is missing (e.g. ingestion mirror without a
   * matching upload), deletion is refused with a user-facing error.
   */
  const handleDelete = async () => {
    if (!artifact) return;
    const removerId = profile?.id;
    if (!removerId) {
      toast.error("Could not resolve the authenticated user id.");
      return;
    }
    const uploadArtifactId = artifact.sourceId;
    if (!uploadArtifactId) {
      toast.error("Couldn't resolve the uploaded artifact id for deletion.");
      return;
    }

    dispatch({ type: "deleteStart" });
    try {
      await knowledgeService.deleteUpload(projectId, uploadArtifactId, removerId);
      dispatch({ type: "deleteSuccess" });
      dispatch({ type: "closeDeleteConfirm" });
      onDelete(artifact.id);
      toast.success("Artifact deleted");
    } catch (err) {
      // Reset the deleting state (the reducer clears the flag) and surface the
      // reason as a toast; the confirm dialog stays open for a retry.
      const message = err instanceof Error ? err.message : "Couldn't delete the artifact.";
      dispatch({ type: "deleteFailed" });
      toast.error(message);
    }
  };

  /** Opens the delete confirmation, clearing any prior delete error. */
  const openDeleteConfirm = () => {
    dispatch({ type: "openDeleteConfirm" });
  };

  const titleContent =
    viewMode === "summary" ? (
      <button
        onClick={() => dispatch({ type: "showRaw" })}
        className="flex items-center gap-1 rounded-md border border-transparent p-1.5 text-sm font-medium text-app-text-muted transition-colors hover:border-app-border hover:bg-app-surface"
        data-testid="back-to-file-btn"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to File
      </button>
    ) : (
      <div className="line-clamp-1 text-lg font-semibold text-app-text">{artifact?.title}</div>
    );

  const canDeleteThisArtifact = canDelete && artifact?.sourceSystem === "UPLOAD";

  const isMarkdownArtifact =
    artifact && content ? shouldRenderAsMarkdown(content, artifact) : false;

  const isPdfOrImage =
    content?.mimeType === "application/pdf" || (content?.mimeType.startsWith("image/") ?? false);
  const canHighlight = highlightLines && highlightLines.length > 0 && !isPdfOrImage;

  const orgMetadata = useMemo(
    () => (artifact?.artifactType === "ORG_METADATA" ? parseOrgMetadata(artifact.metadata) : null),
    [artifact],
  );

  const actionsContent = viewMode === "raw" && artifact?.artifactType !== "ORG_METADATA" && (
    <div className="flex items-center gap-2">
      {isMarkdownArtifact && content && (
        <div className="flex items-center rounded-lg border border-app-border bg-app-bg p-0.5 text-xs">
          <button
            type="button"
            onClick={() => dispatch({ type: "setMarkdownViewMode", mode: "rendered" })}
            className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors ${
              markdownViewMode === "rendered"
                ? "bg-app-surface text-app-brand-text shadow-xs"
                : "text-app-text-muted hover:text-app-text"
            }`}
            data-testid="view-rendered-btn"
          >
            Formatted
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "setMarkdownViewMode", mode: "source" })}
            className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors ${
              markdownViewMode === "source"
                ? "bg-app-surface text-app-brand-text shadow-xs"
                : "text-app-text-muted hover:text-app-text"
            }`}
            data-testid="view-source-btn"
          >
            Source
          </button>
        </div>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={() => void handleSummarize()}
        data-testid="summarise-btn"
        icon={<Sparkles className="h-4 w-4" />}
      >
        Summarise
      </Button>
      {canDeleteThisArtifact && (
        <button
          onClick={openDeleteConfirm}
          data-testid="delete-artifact-btn"
          disabled={isDeleting}
          className="flex items-center gap-2 rounded-md border border-app-danger-border bg-app-danger-bg px-3 py-1.5 text-sm font-medium text-app-danger-text transition-colors hover:bg-app-danger-text/10 focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      )}
    </div>
  );

  return (
    <SidePanel
      isOpen={!!artifact}
      onClose={onClose}
      title={titleContent}
      actions={actionsContent}
      widthClassName="w-full max-w-[720px] md:w-[60%] lg:w-[70%]"
      zIndexClassName="z-50 md:z-30"
      panelClassName="border-l border-app-border shadow-2xl"
      panelBackgroundClassName="bg-app-surface"
      headerClassName="p-4 bg-app-bg"
      contentClassName="p-6"
    >
      {error && viewMode === "raw" ? (
        <div className="rounded-2xl border border-app-danger-border bg-app-danger-bg p-4 text-app-danger-text">
          <p className="font-medium">Error loading content</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : viewMode === "raw" && artifact?.artifactType === "ORG_METADATA" ? (
        <div data-testid="raw-content" aria-busy={false}>
          <OrgMetadataView metadata={orgMetadata} title={artifact?.title ?? null} />
        </div>
      ) : viewMode === "raw" ? (
        <div ref={contentContainerRef} data-testid="raw-content" aria-busy={isLoading}>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-3/4 rounded bg-app-border"></div>
              <div className="h-4 w-1/2 rounded bg-app-border"></div>
              <div className="h-4 w-5/6 rounded bg-app-border"></div>
              <div className="h-4 w-2/3 rounded bg-app-border"></div>
            </div>
          ) : (
            <>
              {canHighlight && (
                <div
                  data-testid="cited-chunk-banner"
                  className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-app-brand-border bg-app-brand-soft/90 px-3.5 py-2 text-xs font-medium text-app-brand-text shadow-xs dark:border-app-brand/40 dark:bg-app-brand/20"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 shrink-0 text-app-brand" />
                    <span>Showing cited chunk ({formatLineRanges(highlightLines)})</span>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToHighlightedChunk}
                    data-testid="jump-to-chunk-btn"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-app-brand-border bg-app-surface px-2.5 py-1 text-xs font-semibold text-app-brand-text shadow-xs transition-colors hover:bg-app-surface-hover hover:text-app-brand"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                    Jump to chunk
                  </button>
                </div>
              )}
              {content &&
              shouldRenderAsMarkdown(content, artifact) &&
              markdownViewMode === "rendered" ? (
                <div className="prose prose-sm max-w-none text-app-text dark:prose-invert">
                  <ReactMarkdown
                    remarkPlugins={REMARK_PLUGINS}
                    rehypePlugins={REHYPE_PLUGINS}
                    components={markdownComponents}
                  >
                    {preprocessMarkdown(content.content)}
                  </ReactMarkdown>
                </div>
              ) : content?.mimeType === "application/pdf" ? (
                <div className="h-[calc(100vh-12rem)] min-h-[500px] w-full overflow-hidden rounded-lg border border-app-border">
                  <object data={content.content} type="application/pdf" className="h-full w-full">
                    <p className="p-4 text-app-text-muted">
                      Unable to display PDF file.{" "}
                      <a
                        href={content.content}
                        download={artifact?.title || "document.pdf"}
                        className="text-app-brand hover:underline"
                      >
                        Download
                      </a>{" "}
                      instead.
                    </p>
                  </object>
                </div>
              ) : content?.mimeType.startsWith("image/") ? (
                <div className="flex justify-center rounded-2xl border border-app-border bg-app-bg p-4">
                  <img
                    src={content.content}
                    alt={artifact?.title || "Image"}
                    className="max-w-full rounded shadow-sm"
                  />
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-app-border text-sm">
                  <SyntaxHighlighter
                    language={isMarkdownArtifact ? "markdown" : getLanguage(artifact?.title)}
                    style={vscDarkPlus}
                    showLineNumbers={true}
                    wrapLines={true}
                    customStyle={{
                      margin: 0,
                      padding: "1rem",
                      backgroundColor: "var(--color-app-bg)",
                    }}
                    lineProps={(lineNumber) => ({
                      style: { display: "block", padding: "0 4px" },
                      className: highlightLines?.includes(lineNumber)
                        ? "bg-app-brand/30 border-l-2 border-app-brand"
                        : "",
                      id: `line-${lineNumber}`,
                    })}
                  >
                    {content?.content || ""}
                  </SyntaxHighlighter>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div data-testid="summary-content" className="max-w-none">
          <div className="mb-6 flex items-center gap-2 border-b border-app-border pb-4 font-medium text-app-brand">
            <Sparkles className="h-5 w-5" />
            <span className="text-lg">AI Summary</span>
          </div>

          {!summary && isFetchingSummary ? (
            <div
              className="flex items-center justify-center gap-3 py-8 text-app-text-muted"
              aria-live="polite"
            >
              <Loader2 className="h-5 w-5 animate-spin text-app-brand" />
              <span className="text-base font-medium">
                {stageDetail
                  ? stageDetail
                  : isIndexing
                    ? "Preparing summary..."
                    : "Generating summary..."}
              </span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="max-w-sm text-center text-sm text-app-text-muted">{error}</p>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => void handleSummarize()}
                  data-testid="retry-summary-btn"
                  icon={<RefreshCw className="h-4 w-4" />}
                >
                  Retry
                </Button>
                <button
                  onClick={() => dispatch({ type: "showRaw" })}
                  className="flex items-center gap-2 rounded-md border border-app-border px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to File
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none text-app-text dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={REMARK_PLUGINS}
                  rehypePlugins={REHYPE_PLUGINS}
                  components={STATIC_MARKDOWN_COMPONENTS}
                >
                  {preprocessMarkdown(summary)}
                </ReactMarkdown>
              </div>

              {citations.length > 0 && <CitationsList citations={citations} />}
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={isConfirmDeleteOpen}
        onClose={() => dispatch({ type: "closeDeleteConfirm" })}
        role="alertdialog"
        title="Delete artifact?"
        description={`This will permanently remove "${artifact?.title ?? "this artifact"}" and its indexed content. This cannot be undone.`}
        size="sm"
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => dispatch({ type: "closeDeleteConfirm" })}
            disabled={isDeleting}
            data-testid="cancel-delete-btn"
            className="rounded-lg border border-app-border px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            data-testid="confirm-delete-btn"
            className="flex items-center gap-2 rounded-lg bg-app-danger-text px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </SidePanel>
  );
}
