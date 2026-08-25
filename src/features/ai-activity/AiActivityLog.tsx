import { useEffect, useRef } from "react";
import { AlertTriangle, Check, Loader2, Search, Sparkles } from "lucide-react";
import type { AiActivityEntry, AiStreamPhase } from "./useAiStream";

type AiActivityLogProps = {
  phase: AiStreamPhase;
  entries: AiActivityEntry[];
  /** A short line naming what is being generated, e.g. "Assembling your orientation". */
  title: string;
};

function EntryIcon({ kind }: { kind: AiActivityEntry["kind"] }) {
  if (kind === "item") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-app-success-solid" aria-hidden="true" />;
  }
  if (kind === "warning") {
    return (
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-app-warning-text" aria-hidden="true" />
    );
  }
  return <Search className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />;
}

/**
 * A live log of what the AI is doing, standing in for a spinner while a generation streams.
 *
 * Shows each stage as it starts and each validated item as it lands — an `item` line is a promise
 * the element cleared its grounding gate, so the reader is watching real, checked output take shape,
 * not tokens. `prefers-reduced-motion` is honoured by CSS (the only motion is the spinner and the
 * default list reflow); the log itself reads fine static, and the settled artifact still renders
 * from the caller's normal read once the stream ends.
 */
export function AiActivityLog({ phase, entries, title }: AiActivityLogProps) {
  const endRef = useRef<HTMLLIElement | null>(null);

  // Keep the latest line in view as items land, without animating the whole list.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [entries.length]);

  return (
    <div
      data-testid="ai-activity-log"
      aria-live="polite"
      className="rounded-xl border border-app-border bg-app-surface-muted p-4"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-app-text">
        {phase === "streaming" ? (
          <Loader2 className="h-4 w-4 animate-spin text-app-brand" aria-hidden="true" />
        ) : (
          <Sparkles className="h-4 w-4 text-app-brand" aria-hidden="true" />
        )}
        {title}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-app-text-muted">Getting started…</p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2 text-xs text-app-text-muted">
              <EntryIcon kind={entry.kind} />
              <span className={entry.kind === "item" ? "text-app-text" : undefined}>
                {entry.label}
              </span>
            </li>
          ))}
          <li ref={endRef} aria-hidden="true" />
        </ul>
      )}
    </div>
  );
}
