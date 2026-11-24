import { MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";

type MarkdownViewMode = "rendered" | "source";

const VIEW_BUTTON_BASE = "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors";
const VIEW_BUTTON_ACTIVE = "bg-app-surface text-app-brand-text shadow-xs";
const VIEW_BUTTON_IDLE = "text-app-text-muted hover:text-app-text";

function MarkdownViewSwitch({
  mode,
  onChange,
}: {
  mode: MarkdownViewMode;
  onChange: (mode: MarkdownViewMode) => void;
}) {
  const classFor = (own: MarkdownViewMode) =>
    `${VIEW_BUTTON_BASE} ${mode === own ? VIEW_BUTTON_ACTIVE : VIEW_BUTTON_IDLE}`;
  return (
    <div className="flex items-center rounded-lg border border-app-border bg-app-bg p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange("rendered")}
        className={classFor("rendered")}
        data-testid="view-rendered-btn"
      >
        Formatted
      </button>
      <button
        type="button"
        onClick={() => onChange("source")}
        className={classFor("source")}
        data-testid="view-source-btn"
      >
        Source
      </button>
    </div>
  );
}

interface DrawerActionsProps {
  /** Shows the Formatted/Source switch; only markdown artifacts with content have one. */
  showMarkdownSwitch: boolean;
  markdownViewMode: MarkdownViewMode;
  onMarkdownViewMode: (mode: MarkdownViewMode) => void;
  /** Whether the reader has text selected, which the AI button then quotes. */
  hasSelection: boolean;
  onAsk: () => void;
  /** Why summarising is unavailable, or null when it is offered. */
  summariseBlockedReason: string | null;
  onSummarize: () => void;
  canDelete: boolean;
  isDeleting: boolean;
  onDelete: () => void;
}

/** The buttons in the drawer's header while a file is shown. */
export function DrawerActions({
  showMarkdownSwitch,
  markdownViewMode,
  onMarkdownViewMode,
  hasSelection,
  onAsk,
  summariseBlockedReason,
  onSummarize,
  canDelete,
  isDeleting,
  onDelete,
}: DrawerActionsProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {showMarkdownSwitch && (
        <MarkdownViewSwitch mode={markdownViewMode} onChange={onMarkdownViewMode} />
      )}
      <Button
        variant="secondary"
        size="sm"
        onClick={onAsk}
        data-testid="ask-ai-btn"
        icon={<MessageSquare className="h-4 w-4" />}
      >
        {hasSelection ? "Ask AI about this" : "Ask AI"}
      </Button>
      {/* The wrapper carries the reason, not the button: a disabled control
          receives no pointer events, so its own title would never be shown. */}
      <span title={summariseBlockedReason ?? undefined}>
        <Button
          variant="primary"
          size="sm"
          onClick={onSummarize}
          disabled={summariseBlockedReason !== null}
          // Keeps the reason reachable without sight; the accessible name still
          // begins with the visible label.
          aria-label={
            summariseBlockedReason
              ? `Summarise (unavailable: ${summariseBlockedReason})`
              : undefined
          }
          data-testid="summarise-btn"
          icon={<Sparkles className="h-4 w-4" />}
        >
          Summarise
        </Button>
      </span>
      {canDelete && (
        <button
          onClick={onDelete}
          data-testid="delete-artifact-btn"
          disabled={isDeleting}
          className="flex items-center gap-2 rounded-md border border-app-danger-border bg-app-danger-bg px-3 py-1.5 text-sm font-medium text-app-danger-text transition-colors hover:bg-app-danger-text/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      )}
    </div>
  );
}
