import {
  Award,
  Brain,
  CheckSquare,
  GitPullRequest,
  Link2,
  Network,
  PenLine,
  PlaneLanding,
  Route,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { BoardCardKind } from "../types";

/**
 * The glyph one kind of card wears in its own header.
 *
 * The cards each name their icon at their own call site, which is right — a checklist knowing it is
 * a checklist is not a fact the board has to hold. This is the same answer from the outside, for
 * the places that have to draw a card they are not rendering: the strips of a closed pile name the
 * cards underneath, and a name with the right glyph beside it is recognisable a good deal faster
 * than a name on its own.
 *
 * Kept in step with the card components by hand. A kind that drifts shows the fallback rather than
 * the wrong picture, which is the failure worth having: an unfamiliar glyph reads as "some card",
 * a confident wrong one reads as a different card.
 */
const ICONS: Record<BoardCardKind, LucideIcon> = {
  PATH_TO_FIRST_CONTRIBUTION: Route,
  CURRENT_TASK: Target,
  DIAGRAM: Network,
  ARRIVAL_STEPS: PlaneLanding,
  OPEN_PULL_REQUESTS: GitPullRequest,
  SUGGESTED_TASKS: Sparkles,
  COMPETENCY_PROGRESS: Award,
  MEMORY_RECAP: Brain,
  NOTE: PenLine,
  LINK: Link2,
  CHECKLIST: CheckSquare,
};

export function cardIcon(kind: BoardCardKind): LucideIcon {
  return ICONS[kind] ?? PenLine;
}
