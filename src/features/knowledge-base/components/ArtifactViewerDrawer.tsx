import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import { Sparkles, ArrowLeft, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import ReactMarkdown, { type Options as ReactMarkdownOptions } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Artifact, ArtifactContent, ArtifactSummaryCitation } from '../types';
import { preprocessMarkdown } from '../markdown';
import { knowledgeService } from '../../../services/knowledgeService';
import { Button } from '../../../components/ui/Button';
import { ApiError } from '../../../services/apiClient';
import { SidePanel } from '../../../components/ui/SidePanel';
import { Modal } from '../../../components/ui/Modal';
import { useAuth } from '../../../context/useAuth';
import { CitationsList } from './CitationsList';

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

type ViewMode = 'raw' | 'summary';

interface DrawerState {
    viewMode: ViewMode;
    content: ArtifactContent | null;
    summary: string;
    citations: ArtifactSummaryCitation[];
    isLoading: boolean;
    isFetchingSummary: boolean;
    isIndexing: boolean;
    isDeleting: boolean;
    isConfirmDeleteOpen: boolean;
    deleteError: string | null;
    stageDetail?: string;
    error: string | null;
}

type DrawerAction =
    | { type: 'reset' }
    | { type: 'loadStart' }
    | { type: 'loadSuccess'; content: ArtifactContent }
    | { type: 'loadError'; error: string }
    | { type: 'summarizeStart' }
    | { type: 'summarizeIndexing' }
    | { type: 'summarizeStage'; name: string; detail: string }
    | { type: 'summarizeToken'; chunk: string }
    | { type: 'summarizeCitation'; citation: ArtifactSummaryCitation }
    | { type: 'summarizeDone' }
    | { type: 'summarizeError'; error: string }
    | { type: 'showRaw' }
    | { type: 'deleteStart' }
    | { type: 'deleteSuccess' }
    | { type: 'deleteError'; error: string }
    | { type: 'clearDeleteError' }
    | { type: 'openDeleteConfirm' }
    | { type: 'closeDeleteConfirm' };

const initialState: DrawerState = {
    viewMode: 'raw',
    content: null,
    summary: '',
    citations: [],
    isLoading: false,
    isFetchingSummary: false,
    isIndexing: false,
    isDeleting: false,
    isConfirmDeleteOpen: false,
    deleteError: null,
    stageDetail: undefined,
    error: null,
};

function drawerReducer(state: DrawerState, action: DrawerAction): DrawerState {
    switch (action.type) {
        case 'reset':
            return { ...initialState, isLoading: true };
        case 'loadStart':
            return { ...state, isLoading: true, error: null };
        case 'loadSuccess':
            return { ...state, isLoading: false, content: action.content };
        case 'loadError':
            return { ...state, isLoading: false, error: action.error };
        case 'summarizeStart':
            return { ...state, viewMode: 'summary', summary: '', citations: [], isFetchingSummary: true, isIndexing: false, stageDetail: undefined, error: null };
        case 'summarizeIndexing':
            return { ...state, isFetchingSummary: true, isIndexing: true, stageDetail: undefined };
        case 'summarizeStage':
            return { ...state, isFetchingSummary: true, isIndexing: false, stageDetail: action.detail };
        case 'summarizeToken':
            return { ...state, summary: state.summary + action.chunk };
        case 'summarizeCitation':
            return { ...state, citations: [...state.citations, action.citation] };
        case 'summarizeDone':
            return { ...state, isFetchingSummary: false, isIndexing: false };
        case 'summarizeError':
            return { ...state, isFetchingSummary: false, isIndexing: false, error: action.error };
        case 'showRaw':
            return { ...state, viewMode: 'raw' };
        case 'deleteStart':
            return { ...state, isDeleting: true, deleteError: null };
        case 'deleteSuccess':
            return { ...state, isDeleting: false, deleteError: null };
        case 'deleteError':
            return { ...state, isDeleting: false, deleteError: action.error };
        case 'clearDeleteError':
            return { ...state, deleteError: null };
        case 'openDeleteConfirm':
            return { ...state, isConfirmDeleteOpen: true, deleteError: null };
        case 'closeDeleteConfirm':
            return { ...state, isConfirmDeleteOpen: false };
        default:
            return state;
    }
}

/** ISSUE and PULL_REQUEST artifacts are always rendered as Markdown regardless of mime, since the backend normalizes their bodies to Markdown. */
const shouldRenderAsMarkdown = (content: ArtifactContent, artifact: Artifact | null): boolean => {
    const isMd = artifact?.title?.toLowerCase().endsWith('.md');
    return content.mimeType.startsWith('text/markdown')
        || artifact?.artifactType === 'ISSUE'
        || artifact?.artifactType === 'PULL_REQUEST'
        || isMd === true;
};

// Hoisted to module scope so ReactMarkdown doesn't see a new array on every render
// (otherwise it always re-renders even when the content is unchanged).
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [[rehypeKatex, { strict: 'ignore', errorColor: 'inherit' }]];

const MARKDOWN_COMPONENTS = {
    code({ className, children }: { className?: string; children?: ReactNode }) {
        const match = /language-(\w+)/.exec(className || '');
        if (!match) {
            return (
                <code className={className}>
                    {children}
                </code>
            );
        }
        return (
            <div className="my-4 rounded-lg overflow-hidden border border-app-border text-sm">
                <SyntaxHighlighter
                    language={match[1]}
                    style={vscDarkPlus}
                    showLineNumbers={false}
                    wrapLines={true}
                    customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'var(--color-app-bg)' }}
                >
                    {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
                    {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
            </div>
        );
    },
    pre: ({ children }: { children?: ReactNode }) => <>{children}</>,
} as const;

const getLanguage = (filename?: string | null) => {
    if (!filename) return 'typescript';
    const ext = filename.split('.').pop()?.toLowerCase();
    if (filename.toLowerCase() === 'dockerfile') return 'docker';
    switch (ext) {
        case 'js':
        case 'jsx': return 'javascript';
        case 'ts':
        case 'tsx': return 'typescript';
        case 'py': return 'python';
        case 'kt':
        case 'kts': return 'kotlin';
        case 'java': return 'java';
        case 'md': return 'markdown';
        case 'json': return 'json';
        case 'yml':
        case 'yaml': return 'yaml';
        case 'sh': return 'bash';
        case 'html': return 'markup';
        case 'css': return 'css';
        case 'sql': return 'sql';
        case 'xml': return 'xml';
        case 'csv': return 'csv';
        default: return 'typescript';
    }
};

/**
 * ArtifactViewerDrawer
 *
 * Slide-out panel that displays the raw content of a selected artifact.
 * Allows users to trigger an AI summarization of the content to quickly extract key information
 * without reading massive files or issues. The summary is streamed over Server-Sent Events and
 * rendered incrementally as tokens arrive; citation metadata is rendered as a source list.
 */
export function ArtifactViewerDrawer({ artifact, onClose, projectId, highlightLines, canDelete, onDelete }: ArtifactViewerDrawerProps) {
    const { profile } = useAuth();
    const [state, dispatch] = useReducer(drawerReducer, initialState);

    const abortRef = useRef<AbortController | null>(null);
    // Bumped each time the user switches artifact or unmounts. Long-running
    // summarize loops read this to bail out before dispatching into a stale reducer.
    const summarizeGenerationRef = useRef(0);

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
        dispatch({ type: 'reset' });

        knowledgeService.getArtifactContent(projectId, artifact.id, artifact.sourceSystem)
            .then(data => {
                if (isMounted) dispatch({ type: 'loadSuccess', content: data });
            })
            .catch(err => {
                if (isMounted) dispatch({ type: 'loadError', error: err instanceof Error ? err.message : String(err) });
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

    useEffect(() => {
        if (highlightLines && highlightLines.length > 0 && state.viewMode === 'raw' && !state.isLoading && state.content) {
            // 100ms delay lets SyntaxHighlighter finish rendering line-number DOM nodes
            // before we try to scroll to one.
            const timer = setTimeout(() => {
                const firstLine = Math.min(...highlightLines);
                const lineEl = document.getElementById(`line-${firstLine}`);
                if (lineEl) {
                    lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [highlightLines, state.viewMode, state.isLoading, state.content]);

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
        dispatch({ type: 'summarizeStart' });

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
                        onStage: (name, detail) => dispatch({ type: 'summarizeStage', name, detail }),
                        onToken: (chunk) => dispatch({ type: 'summarizeToken', chunk }),
                        onCitation: (citation) => dispatch({ type: 'summarizeCitation', citation }),
                        onDone: () => dispatch({ type: 'summarizeDone' }),
                    },
                    controller.signal,
                );
                return;
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                const isStillIndexing = err instanceof ApiError && err.status === 503;
                if (!isStillIndexing) {
                    const message = err instanceof Error ? err.message : 'Failed to summarize';
                    dispatch({ type: 'summarizeError', error: message });
                    return;
                }
                dispatch({ type: 'summarizeIndexing' });
                const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
                // Abortable sleep: if the controller aborts (unmount / artifact change /
                // a newer summarize loop), reject immediately instead of waiting out the timer.
                await new Promise<void>((resolve, reject) => {
                    const timer = setTimeout(resolve, delay);
                    controller.signal.addEventListener(
                        'abort',
                        () => {
                            clearTimeout(timer);
                            reject(new DOMException('Aborted', 'AbortError'));
                        },
                        { once: true },
                    );
                }).catch((sleepErr: unknown) => {
                    if (sleepErr instanceof Error && sleepErr.name === 'AbortError') {
                        throw sleepErr;
                    }
                    return undefined;
                });
                attempt++;
            }
        }
    };

    const { viewMode, content, summary, citations, isLoading, isFetchingSummary, isIndexing, isDeleting, isConfirmDeleteOpen, deleteError, stageDetail, error } = state;

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
            dispatch({ type: 'deleteError', error: 'Could not resolve authenticated user id.' });
            return;
        }
        const uploadArtifactId = artifact.sourceId;
        if (!uploadArtifactId) {
            dispatch({ type: 'deleteError', error: 'Cannot resolve the uploaded artifact id for deletion.' });
            return;
        }

        dispatch({ type: 'deleteStart' });
        try {
            await knowledgeService.deleteUpload(projectId, uploadArtifactId, removerId);
            dispatch({ type: 'deleteSuccess' });
            dispatch({ type: 'closeDeleteConfirm' });
            onDelete(artifact.id);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete artifact';
            dispatch({ type: 'deleteError', error: message });
        }
    };

    /** Opens the delete confirmation, clearing any prior delete error. */
    const openDeleteConfirm = () => {
        dispatch({ type: 'openDeleteConfirm' });
    };

    const titleContent = viewMode === 'summary' ? (
        <button
            onClick={() => dispatch({ type: 'showRaw' })}
            className="p-1.5 hover:bg-app-surface border border-transparent hover:border-app-border rounded-md transition-colors flex items-center gap-1 text-sm font-medium text-app-text-muted"
            data-testid="back-to-file-btn"
        >
            <ArrowLeft className="w-4 h-4" />
            Back to File
        </button>
    ) : (
        <div className="font-semibold text-lg text-app-text line-clamp-1">{artifact?.title}</div>
    );

    const canDeleteThisArtifact = canDelete && artifact?.sourceSystem === 'UPLOAD';

    const actionsContent = viewMode === 'raw' && (
        <div className="flex items-center gap-2">
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
                    className="flex items-center gap-2 px-3 py-1.5 bg-app-danger-bg text-app-danger-text border border-app-danger-border rounded-md text-sm font-medium hover:bg-app-danger-text/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                >
                    <Trash2 className="w-4 h-4" />
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
            {error && viewMode === 'raw' ? (
                <div className="p-4 bg-app-danger-bg text-app-danger-text rounded-2xl border border-app-danger-border">
                    <p className="font-medium">Error loading content</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            ) : viewMode === 'raw' ? (
                <div data-testid="raw-content" aria-busy={isLoading}>
                    {isLoading ? (
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-app-border rounded w-3/4"></div>
                            <div className="h-4 bg-app-border rounded w-1/2"></div>
                            <div className="h-4 bg-app-border rounded w-5/6"></div>
                            <div className="h-4 bg-app-border rounded w-2/3"></div>
                        </div>
                    ) : (
                        content && shouldRenderAsMarkdown(content, artifact) ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-app-text">
                                <ReactMarkdown
                                    remarkPlugins={REMARK_PLUGINS}
                                    rehypePlugins={REHYPE_PLUGINS}
                                    components={MARKDOWN_COMPONENTS}
                                >
                                    {preprocessMarkdown(content.content)}
                                </ReactMarkdown>
                            </div>
                        ) : content?.mimeType === 'application/pdf' ? (
                            <div className="w-full h-[calc(100vh-12rem)] min-h-[500px] rounded-lg overflow-hidden border border-app-border">
                                <object data={content.content} type="application/pdf" className="w-full h-full">
                                    <p className="p-4 text-app-text-muted">Unable to display PDF file. <a href={content.content} download={artifact?.title || "document.pdf"} className="text-app-brand hover:underline">Download</a> instead.</p>
                                </object>
                            </div>
                        ) : content?.mimeType.startsWith('image/') ? (
                            <div className="flex justify-center bg-app-bg p-4 rounded-2xl border border-app-border">
                                <img src={content.content} alt={artifact?.title || 'Image'} className="max-w-full rounded shadow-sm" />
                            </div>
                        ) : (
                            <div className="rounded-lg overflow-hidden border border-app-border text-sm">
                                <SyntaxHighlighter
                                    language={getLanguage(artifact?.title)}
                                    style={vscDarkPlus}
                                    showLineNumbers={true}
                                    wrapLines={true}
                                    customStyle={{ margin: 0, padding: '1rem', backgroundColor: 'var(--color-app-bg)' }}
                                    lineProps={(lineNumber) => ({
                                        style: { display: 'block', padding: '0 4px' },
                                        className: highlightLines?.includes(lineNumber) ? 'bg-app-brand/30 border-l-2 border-app-brand' : '',
                                        id: `line-${lineNumber}`
                                    })}
                                >
                                    {content?.content || ''}
                                </SyntaxHighlighter>
                            </div>
                        )
                    )}
                </div>
            ) : (
                <div data-testid="summary-content" className="max-w-none">
                    <div className="flex items-center gap-2 mb-6 text-app-brand font-medium border-b border-app-border pb-4">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-lg">AI Summary</span>
                    </div>

                    {!summary && isFetchingSummary ? (
                        <div className="flex items-center gap-3 text-app-text-muted py-8 justify-center" aria-live="polite">
                            <Loader2 className="w-5 h-5 animate-spin text-app-brand" />
                            <span className="text-base font-medium">
                                {stageDetail ? stageDetail : isIndexing ? 'Preparing summary...' : 'Generating summary...'}
                            </span>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <p className="text-sm text-app-text-muted text-center max-w-sm">{error}</p>
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
                                    onClick={() => dispatch({ type: 'showRaw' })}
                                    className="flex items-center gap-2 px-4 py-2 text-app-text-muted rounded-md text-sm font-medium hover:bg-app-surface-muted transition-colors border border-app-border"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to File
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-app-text">
                                <ReactMarkdown
                                    remarkPlugins={REMARK_PLUGINS}
                                    rehypePlugins={REHYPE_PLUGINS}
                                    components={MARKDOWN_COMPONENTS}
                                >
                                    {preprocessMarkdown(summary)}
                                </ReactMarkdown>
                            </div>

                            {citations.length > 0 && (
                                <CitationsList citations={citations} />
                            )}
                        </>
                    )}
                </div>
            )}

            <Modal
                isOpen={isConfirmDeleteOpen}
                onClose={() => dispatch({ type: 'closeDeleteConfirm' })}
                role="alertdialog"
                title="Delete artifact?"
                description={`This will permanently remove "${artifact?.title ?? 'this artifact'}" and its indexed content. This cannot be undone.`}
                size="sm"
            >
                {deleteError && (
                    <div
                        role="alert"
                        aria-live="assertive"
                        className="mb-4 rounded-lg border border-app-danger-border bg-app-danger-bg p-3 text-sm text-app-danger-text"
                        data-testid="delete-error-banner"
                    >
                        {deleteError}
                    </div>
                )}
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'closeDeleteConfirm' })}
                        disabled={isDeleting}
                        data-testid="cancel-delete-btn"
                        className="px-4 py-2 rounded-lg border border-app-border text-app-text-muted text-sm font-medium hover:bg-app-surface-hover transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleDelete()}
                        disabled={isDeleting}
                        data-testid="confirm-delete-btn"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-app-danger-text text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </Modal>
        </SidePanel>
    );
}
