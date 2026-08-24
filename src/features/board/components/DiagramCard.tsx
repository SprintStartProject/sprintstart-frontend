import { useEffect, useMemo, useState } from "react";
import { List, Network, RefreshCw } from "lucide-react";
import { boardService } from "../../../services/boardService";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { type GraphShape } from "../../competency-graph/layout";
import { DiagramCanvas, type DiagramCanvasEdge } from "../../graph-diagram/DiagramCanvas";
import { AskTheBuddy } from "../../buddy/components/AskTheBuddy";
import { BoardCardFrame } from "./BoardCardFrame";
import { DiagramCardNode } from "./DiagramCardNode";
import { EDGE_KIND_WORDS, ariaLabelFor, isSoftEdge } from "../diagramWords";
import type { BoardCard, DiagramContent } from "../types";

type DiagramCardProps = {
  content: DiagramContent;
  card: Pick<BoardCard, "id" | "owner" | "placedAt">;
  onDismiss?: (cardId: string) => void;
  dismissing?: boolean;
  onMove?: (cardId: string, direction: "up" | "down") => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

const nodeTypes = { diagramPart: DiagramCardNode };

/**
 * A picture of how some part of the project fits together, drawn from the project's own material.
 *
 * Every box carries the source proving it; an ungrounded box was dropped before reaching here. The
 * one thing the buddy chose is the question, shown as the subtitle so the hire sees what was
 * asked.
 *
 * The list is not a fallback for the canvas — it is the text equivalent, and a diagram whose
 * only form is a canvas is one some people cannot read at all. It also shows each box's sources as
 * openable links, which the canvas cannot do without a hover.
 *
 * It revalidates itself once after rendering, because the board serves the picture last
 * drawn rather than waiting on a generation. The date is shown either way: a picture is a claim
 * about code as it was at a moment.
 */
export function DiagramCard({
  content,
  card,
  onDismiss,
  dismissing,
  onMove,
  canMoveUp,
  canMoveDown,
}: DiagramCardProps) {
  // Only what a revalidation produced. Derived rather than synced from the prop, so a fresh board
  // read cannot be silently overwritten by a stale confirmation of the previous one.
  const [redrawn, setRedrawn] = useState<DiagramContent | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [asList, setAsList] = useState(false);

  const current = redrawn ?? content;

  useEffect(() => {
    let cancelled = false;
    // Deferred to a microtask: React 19's lint rejects a synchronous first setState in an
    // effect body, and this is the pattern the repo already passes with.
    void (async () => {
      if (cancelled) return;
      setChecking(true);
      try {
        const fresh = await boardService.refreshDiagram(card.id);
        if (!cancelled) setRedrawn(fresh);
      } catch {
        // The board already handed us the last picture drawn, and it is dated. Failing to
        // confirm it is current is not a reason to take it away.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.id]);

  const shape = useMemo<GraphShape>(() => {
    const known = new Set(current.nodes.map((node) => node.id));
    return {
      nodes: current.nodes.map((node) => ({ key: node.id })),
      edges: current.edges
        .filter((edge) => known.has(edge.fromId) && known.has(edge.toId))
        .map((edge) => ({ from: edge.fromId, to: edge.toId })),
    };
  }, [current.nodes, current.edges]);

  const nodes = useMemo(
    () =>
      current.nodes.map((node) => ({
        id: node.id,
        data: { node, selected: node.id === selectedId },
        ariaLabel: ariaLabelFor(node),
      })),
    [current.nodes, selectedId],
  );

  const edges = useMemo<DiagramCanvasEdge[]>(
    () =>
      current.edges.map((edge) => ({
        id: `${edge.fromId}->${edge.toId}->${edge.kind}`,
        from: edge.fromId,
        to: edge.toId,
        dashed: isSoftEdge(edge.kind),
      })),
    [current.edges],
  );

  const labelById = useMemo(
    () => new Map(current.nodes.map((node) => [node.id, node.label])),
    [current.nodes],
  );

  const drawn = current.assembledAt ? new Date(current.assembledAt) : null;
  const hasPicture = current.nodes.length > 0;

  return (
    <BoardCardFrame
      title="How this fits together"
      card={card}
      subtitle={current.subject}
      onDismiss={onDismiss}
      dismissing={dismissing}
      onMove={onMove}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      action={
        hasPicture ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setAsList((shown) => !shown)}
            aria-pressed={asList}
            title={asList ? "Show the diagram" : "Read it as a list"}
            aria-label={asList ? "Show the diagram" : "Read it as a list"}
          >
            {asList ? (
              <Network className="h-4 w-4" aria-hidden="true" />
            ) : (
              <List className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        ) : undefined
      }
    >
      {current.summary && <p className="mb-3 text-sm text-app-text-muted">{current.summary}</p>}

      {hasPicture ? (
        asList ? (
          <DiagramList content={current} labelById={labelById} data-testid="diagram-list" />
        ) : (
          <div className="h-72 overflow-hidden rounded-xl border border-app-border">
            <DiagramCanvas
              shape={shape}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              nodeType="diagramPart"
              selectedId={selectedId}
              onSelect={setSelectedId}
              ariaLabel={`Diagram: ${current.subject}`}
              testId="diagram-card-canvas"
            />
          </div>
        )
      ) : (
        <EmptyState size="sm">
          {current.reason ?? "There is nothing in this project’s material to draw this from yet."}
        </EmptyState>
      )}

      <p className="mt-2 flex items-center gap-1.5 text-xs text-app-text-muted">
        {checking && <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />}
        {checking
          ? "Checking this is still up to date…"
          : drawn
            ? `Drawn from this project’s material on ${drawn.toLocaleDateString()}`
            : "Not drawn yet"}
      </p>

      <AskTheBuddy
        question={`Can you walk me through ${current.subject}?`}
        label="Ask about this diagram"
      />
    </BoardCardFrame>
  );
}

/**
 * The same diagram in sentences, with every source openable.
 *
 * Not a degraded fallback — it carries something the canvas cannot: each box's sources as links you
 * can follow, rather than a hover you have to discover. An arrow pointing at a box that is not in
 * the diagram is skipped here for the same reason the canvas filters it out.
 */
function DiagramList({
  content,
  labelById,
}: {
  content: DiagramContent;
  labelById: Map<string, string>;
  "data-testid"?: string;
}) {
  return (
    <div data-testid="diagram-list" className="space-y-3">
      <ul className="space-y-2">
        {content.nodes.map((node) => (
          <li key={node.id} className="text-sm">
            <span className="font-medium text-app-text">{node.label}</span>
            {node.summary && <span className="text-app-text-muted"> — {node.summary}</span>}
            <span className="ml-1 text-xs text-app-text-subtle">
              (
              {node.citations.map((citation, index) => (
                <span key={`${citation.filename}-${index}`}>
                  {index > 0 && ", "}
                  {citation.sourceUrl ? (
                    <a
                      href={citation.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-app-text"
                    >
                      {citation.filename}
                    </a>
                  ) : (
                    // Named even when it cannot be opened: unopenable beats
                    // unattributed.
                    citation.filename
                  )}
                </span>
              ))}
              )
            </span>
          </li>
        ))}
      </ul>

      {content.edges.length > 0 && (
        <ul className="space-y-1 border-t border-app-border pt-2">
          {content.edges
            .filter((edge) => labelById.has(edge.fromId) && labelById.has(edge.toId))
            .map((edge) => (
              <li
                key={`${edge.fromId}->${edge.toId}->${edge.kind}`}
                className="text-xs text-app-text-muted"
              >
                {labelById.get(edge.fromId)} {EDGE_KIND_WORDS[edge.kind]} {labelById.get(edge.toId)}
                {edge.label && ` — ${edge.label}`}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
