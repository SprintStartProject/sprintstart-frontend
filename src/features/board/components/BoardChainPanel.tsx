import { useMemo } from "react";
import { CheckCircle2, CircleDot, Lock, PauseCircle } from "lucide-react";
import { SidePanel } from "../../../components/ui/SidePanel.tsx";
import { BlueprintGraphCanvas } from "../../blueprints/components/BlueprintGraphCanvas.tsx";
import { BlueprintNodeCard } from "../../blueprints/components/BlueprintNodeCard.tsx";
import { EDGE_TONES, type GraphEdgeTone } from "../../graph-diagram/graphLayout.ts";
import { cardIcon } from "../layout/cardIcons.ts";
import { boardChainNodes, chainAround, type BoardChainNode } from "../layout/boardChain.ts";
import type {
  BoardCardStatus,
  BoardStructure,
  CardState,
  DependencySource,
} from "../layout/boardStructure.ts";
import type { BoardCard } from "../types.ts";

/** What each of the three kinds of arrow is called, and what it means for the person reading it. */
const SOURCE_WORDS: Record<DependencySource, { tone: GraphEdgeTone; label: string }> = {
  TEAM: { tone: "rule", label: "Your team set this one. It stays." },
  BUDDY: { tone: "suggestion", label: "Your buddy suggested this one. You can change it." },
  HIRE: { tone: "own", label: "You arranged this one." },
};

const STATUS_BADGE: Record<
  BoardCardStatus,
  { label: string; variant: "success" | "warning" | "neutral"; icon: typeof CheckCircle2 }
> = {
  DONE: { label: "Done", variant: "success", icon: CheckCircle2 },
  BLOCKED: { label: "Waiting", variant: "warning", icon: PauseCircle },
  OPEN: { label: "Open", variant: "neutral", icon: CircleDot },
};

/**
 * Why one card is closed, drawn rather than listed.
 *
 * The board already says "don't start yet — first finish X". This answers the two questions that
 * sentence raises and cannot hold: how far back the run goes, and which of the locks on it are the
 * hire's to open. Both are things a line of text can only spell out one hop at a time.
 *
 * **Read-only and unsaved.** Nothing here rearranges the board or writes a coordinate; the chain is
 * laid out by prerequisite each time it is opened. A hire's board is a grid, not a diagram — the
 * picture is a way of looking at it, not a second place to keep it.
 *
 * The same canvas the Blueprint editor uses, with its authoring taken away. Which is the point:
 * the run a hire is looking at *is* the shape their PM drew, and seeing it in the same hand is what
 * connects the two.
 */
export function BoardChainPanel({
  cardId,
  cards,
  structure,
  states,
  onClose,
}: {
  /** The card the picture is about, or null when nothing is open. */
  cardId: string | null;
  cards: BoardCard[];
  structure: BoardStructure;
  states: Map<string, CardState>;
  onClose: () => void;
}) {
  const { chain, subject, sources } = useMemo(() => {
    if (!cardId) return { chain: [] as BoardChainNode[], subject: null, sources: [] };

    const drawn = chainAround(boardChainNodes(cards, structure, states), cardId);
    // Only the kinds of arrow actually on this chain get explained. A legend listing three when the
    // picture holds one is a legend about the feature rather than about what is on screen.
    const present = new Set<DependencySource>();
    for (const node of drawn) {
      for (const source of Object.values(node.sourceByBlockerId)) present.add(source);
    }

    return {
      chain: drawn,
      subject: drawn.find((node) => node.id === cardId) ?? null,
      sources: (["TEAM", "BUDDY", "HIRE"] as const).filter((source) => present.has(source)),
    };
  }, [cardId, cards, states, structure]);

  const waitingOn = chain.filter((node) => node.status !== "DONE" && node.id !== cardId).length;

  return (
    <SidePanel
      isOpen={cardId !== null}
      onClose={onClose}
      title={subject ? `What ${subject.title} is waiting on` : "The chain"}
      description={
        subject?.status === "BLOCKED"
          ? `${waitingOn} ${waitingOn === 1 ? "card" : "cards"} in this run ${waitingOn === 1 ? "is" : "are"} still open.`
          : "Everything this card is part of, in the order it has to happen."
      }
      widthClassName="w-[min(46rem,100vw)]"
    >
      <div className="flex h-[32rem] flex-col gap-3">
        <div className="min-h-0 flex-1">
          <BlueprintGraphCanvas<BoardChainNode>
            nodes={chain}
            title=""
            description=""
            libraryTitle=""
            libraryDescription=""
            libraryEmptyMessage=""
            editable={false}
            showLibrary={false}
            ariaLabel={subject ? `What ${subject.title} is waiting on` : "Card chain"}
            emptyTitle="Nothing waits on this one"
            onNodeClick={() => {}}
            onPositionChange={() => Promise.resolve()}
            onRemoveNode={() => Promise.resolve()}
            onAddBlocker={() => Promise.resolve()}
            onRemoveBlocker={() => Promise.resolve()}
            edgeTone={(node, blockerId) =>
              SOURCE_WORDS[node.sourceByBlockerId[blockerId] ?? "HIRE"].tone
            }
            renderNode={(node, cardProps) => {
              const badge = STATUS_BADGE[node.status];
              return (
                <BlueprintNodeCard
                  {...cardProps}
                  title={node.title}
                  kind={{ label: "Card", icon: cardIcon(node.kind) }}
                  status={{ label: badge.label, variant: badge.variant, icon: badge.icon }}
                  highlighted={node.id === cardId}
                />
              );
            }}
          />
        </div>

        {/* The legend is the panel's, not the canvas's: three line styles mean nothing without it,
            and the Blueprint editor has no use for it — there, one author wrote every arrow. */}
        {sources.length > 0 ? (
          <ul className="space-y-1.5 rounded-xl border border-app-border bg-app-surface-muted p-3 text-xs text-app-text-muted">
            {sources.map((source) => (
              <li key={source} className="flex items-center gap-2">
                {/* The same numbers the canvas strokes with, read from the same table. */}
                <svg width="30" height="8" aria-hidden="true" className="shrink-0">
                  <path
                    d="M0,4 C8,4 14,4 28,4"
                    fill="none"
                    className="stroke-app-brand"
                    strokeWidth={EDGE_TONES[SOURCE_WORDS[source].tone].width}
                    strokeDasharray={EDGE_TONES[SOURCE_WORDS[source].tone].dash}
                    strokeLinecap="round"
                  />
                </svg>
                {source === "TEAM" ? (
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                ) : null}
                {SOURCE_WORDS[source].label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SidePanel>
  );
}
