import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { preprocessMarkdown } from "../markdown";
import type { ArtifactSummaryCitation } from "../types";
import { CitationsList } from "./CitationsList";
import { REHYPE_PLUGINS, REMARK_PLUGINS, staticMarkdownComponents } from "./markdownComponents";

interface SummaryViewProps {
  summary: string;
  citations: ArtifactSummaryCitation[];
  error: string | null;
  isFetchingSummary: boolean;
  isIndexing: boolean;
  stageDetail: string | undefined;
  /** The invitation to the waiting game, when one is on offer. */
  gameHint?: ReactNode;
  /** The waiting game itself, while it is being played. */
  gameBox?: ReactNode;
  onRetry: () => void;
  onBack: () => void;
}

function waitingMessage(stageDetail: string | undefined, isIndexing: boolean): string {
  if (stageDetail) return stageDetail;
  return isIndexing ? "Preparing summary..." : "Generating summary...";
}

function SummaryWaiting({ message }: { message: string }) {
  return (
    <div
      className="flex items-center justify-center gap-3 py-8 text-app-text-muted"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-app-brand" />
      <span className="text-base font-medium">{message}</span>
    </div>
  );
}

function SummaryFailure({
  error,
  onRetry,
  onBack,
}: {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <p className="max-w-sm text-center text-sm text-app-text-muted">{error}</p>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={onRetry}
          data-testid="retry-summary-btn"
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Retry
        </Button>
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-md border border-app-border px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to File
        </button>
      </div>
    </div>
  );
}

function SummaryText({
  summary,
  citations,
}: {
  summary: string;
  citations: ArtifactSummaryCitation[];
}) {
  return (
    <>
      <div className="prose prose-sm max-w-none break-words text-app-text dark:prose-invert">
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={staticMarkdownComponents()}
        >
          {preprocessMarkdown(summary)}
        </ReactMarkdown>
      </div>

      {citations.length > 0 && <CitationsList citations={citations} />}
    </>
  );
}

function SummaryBody(props: SummaryViewProps) {
  const { summary, citations, error, isFetchingSummary, isIndexing, stageDetail } = props;
  if (!summary && isFetchingSummary) {
    return <SummaryWaiting message={waitingMessage(stageDetail, isIndexing)} />;
  }
  if (error) return <SummaryFailure error={error} onRetry={props.onRetry} onBack={props.onBack} />;
  return <SummaryText summary={summary} citations={citations} />;
}

/** The AI summary of the artifact: waiting, failed, or streamed text with its sources. */
export function SummaryView(props: SummaryViewProps) {
  return (
    <div data-testid="summary-content" className="max-w-none">
      <div className="mb-6 flex items-center gap-2 border-b border-app-border pb-4 font-medium text-app-brand">
        <Sparkles className="h-5 w-5" />
        <span className="text-lg">AI Summary</span>
      </div>

      {props.gameHint}
      {props.gameBox}

      <SummaryBody {...props} />
    </div>
  );
}
