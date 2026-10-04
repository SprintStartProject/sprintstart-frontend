import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { Link } from "react-router-dom";
import { queryKeys } from "../../../services/queryKeys";
import { useProjectContext } from "../../projects/useProjectContext";
import type { OnboardingPathEndpoint } from "../../onboarding/types";
import { loadBoard } from "../hooks/useBoard";
import { readCardOrigins } from "../layout/cardOrigins";
import { isCardAt, pathPhases } from "../layout/pathStages";

type KeptOnBoardProps = {
  /** The step or phase whose cards to count. */
  place: { kind: "step" | "phase"; id: string };
  /** The hire's path, so a phase can count what was kept from any of its steps. */
  path: OnboardingPathEndpoint | null;
  className?: string;
};

/**
 * "3 cards on your board from this step" — the way back from the path to what was kept along it.
 *
 * The board already points at the path (the strip, the step card, Now and Later). This is the other
 * direction: somebody working through a step should not have to remember that they kept notes on
 * it last week, or go and find them. The link opens the board narrowed to exactly those cards.
 *
 * Silent at zero. Every step saying "nothing on your board" would be a line of furniture on forty
 * rows, and it would read as a nudge to go and file something.
 *
 * The live step card is not counted: it is the step itself showing on the board, not something
 * kept from it.
 */
export function KeptOnBoard({ place, path, className = "" }: KeptOnBoardProps) {
  const { selectedProjectId } = useProjectContext();
  // The same query the board page reads, so a board already loaded is not fetched again — and a
  // card kept from here, which invalidates it, shows up in the count straight away.
  const { data: board } = useQuery({
    queryKey: queryKeys.board.byProject(selectedProjectId),
    queryFn: () => loadBoard(selectedProjectId),
    enabled: Boolean(selectedProjectId),
  });
  const phases = useMemo(() => (path ? pathPhases(path) : null), [path]);

  if (!board || !selectedProjectId) return null;

  // Read per render rather than held: cheap, and a save from the dock writes it without this
  // component hearing about it — the board query refetching is what re-renders it.
  const origins = readCardOrigins(selectedProjectId);
  const count = board.cards.filter(
    (card) => card.content.kind !== "PATH_STEP" && isCardAt(card, place, phases, origins),
  ).length;

  if (count === 0) return null;

  return (
    <Link
      to={`/board?${place.kind}=${encodeURIComponent(place.id)}`}
      className={`inline-flex items-center gap-1.5 rounded-lg text-xs font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none ${className}`}
    >
      <LayoutDashboard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {count === 1 ? "1 card" : `${count} cards`} on your board from this {place.kind}
    </Link>
  );
}
