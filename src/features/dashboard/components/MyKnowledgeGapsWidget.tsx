import { useMemo, useState } from "react";
import { FileWarning } from "lucide-react";
import { canAccessRoute } from "../../../auth/accessPolicy";
import { useAuth } from "../../../context/useAuth";
import { useQueryFetch } from "../../../hooks/useQueryFetch";
import { knowledgeGapService } from "../../../services/knowledgeGapService";
import { queryKeys } from "../../../services/queryKeys";
import { PanelPresence } from "../../../components/ui/PanelPresence";
import { MyKnowledgeGapsDrawer } from "../../knowledge-gaps/components/MyKnowledgeGapsDrawer";
import { useMyKnowledgeGaps } from "../../knowledge-gaps/useMyKnowledgeGaps";
import { useProjectContext } from "../../projects/useProjectContext";
import type { DashboardWidgetSize } from "../layout/types";
import { GapsBody } from "./gaps/GapsBody";
import { NewOwnershipPill } from "./gaps/gapParts";
import { openGaps, pressLabels } from "./gaps/gapRules";
import { WidgetShell } from "./WidgetShell";

/**
 * The components you own that are missing documentation.
 *
 * The counterpart to the manager's `team-insights` card: same analysis, filtered to the
 * caller. Where a PM needs to see which parts of the project are undocumented, a member only
 * needs to know which of them is theirs to write — so this reads `/knowledge-gaps/mine`,
 * which is scoped by component ownership rather than by role and is therefore open to
 * everyone in the project. Available to every user for that reason, and offered in the
 * picker rather than placed by default: most people own nothing and would get an empty card
 * they never asked for.
 *
 * Built for more than one gap throughout even though one is the normal case — ownership is a
 * list on the backend, and a card that only worked for a single row would break the first
 * time somebody took on a second component.
 *
 * Pressing it opens a drawer with the whole of what is in your name, for every role -- built
 * from the response this card already has, so a member finally has somewhere to read it in
 * full. A manager gets the way through to the knowledge-gaps page from inside that drawer,
 * which is where the things only they can do live; sending everybody else there directly would
 * have been a click that lands on a redirect.
 */
export function MyKnowledgeGapsWidget({ size }: { size: DashboardWidgetSize }) {
  const { profile } = useAuth();
  const { hasSelectedProject, selectedProjectId, canManageSelected } = useProjectContext();
  // Only the unread flag comes from the shared provider; the figures below stay this widget's
  // own request, so the card still works wherever it is rendered.
  const { unseenComponents, markAllSeen } = useMyKnowledgeGaps();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  /*
    The request waits for a confirmed project, the same gate the shared provider uses. The
    project context starts empty and only fills in once the project list has loaded — and it
    stays empty for a user who belongs to no project at all. Asking before a project is
    confirmed either sends an empty `projectId` (a guaranteed 400) or, with a `?projectId=`
    deep link, asks about a project no loaded list has called reachable.
  */
  const { data, loading, error } = useQueryFetch(
    queryKeys.knowledgeGaps.mine(selectedProjectId),
    () => knowledgeGapService.fetchMyKnowledgeGaps(selectedProjectId),
    { enabled: hasSelectedProject },
  );

  // Memoised because `PanelPresence` below compares this by identity to decide when the drawer
  // has finished closing; a fresh array every render would keep resetting that.
  const gaps = useMemo(() => openGaps(data?.gaps ?? []), [data]);

  /*
    Something has been assigned that the user has not acknowledged. The card then always
    accepts a press, even for a member who cannot open the knowledge-gaps page: the press is
    what puts the flag down, here and in the sidebar.

    The card opens the drawer for everybody, rather than the knowledge-gaps page for the two
    roles that may enter it. Pressing is also what acknowledges the "New" marker, so a member
    for whom the drawer is the end of the road still has a reason to have pressed.

    An unacknowledged marker makes the card pressable on its own, even when this widget's own
    request failed and there is nothing to open. The marker and the figures come from two
    different requests -- the shared provider and the one above -- and pressing is the only
    thing that puts the marker down, here and in the sidebar. Tying it to the figures alone
    left a card wearing "New" that could not be pressed, with the sidebar flag stuck behind it.
  */
  const hasUnseen = unseenComponents.length > 0;
  const canOpenDrawer = gaps.length > 0;
  const isPressable = (canOpenDrawer || hasUnseen) && !loading;
  const { actionLabel, actionText } = pressLabels({
    isPressable,
    canOpenDrawer,
    unseenCount: unseenComponents.length,
  });

  const openDetails = () => {
    markAllSeen();
    if (canOpenDrawer) setDrawerOpen(true);
  };

  return (
    <>
      <WidgetShell
        icon={FileWarning}
        title="Your knowledge gaps"
        actionLabel={actionLabel}
        // The count lives in the "New" pill beside it; repeating it here squeezed the title.
        actionText={actionText}
        onActivate={isPressable ? openDetails : undefined}
        notice={hasUnseen ? <NewOwnershipPill /> : undefined}
        isLoading={loading}
        // Only a failed request may say this. Owning nothing is a normal, successful answer and
        // gets the empty state — the two must never be told apart by guesswork.
        errorMessage={error ? "Could not load your knowledge gaps." : null}
      >
        <GapsBody
          hasSelectedProject={hasSelectedProject}
          gaps={gaps}
          size={size}
          currentUserId={profile?.id ?? null}
        />
      </WidgetShell>

      {/* Mounted only while it is open, and kept for the length of its slide-out -- the drawer
          lists every component in full, and a closed copy of that sitting in the DOM behind a
          dashboard card is a duplicate of everything the card itself says. */}
      <PanelPresence value={isDrawerOpen ? gaps : null}>
        {(openGapList) => (
          <MyKnowledgeGapsDrawer
            isOpen
            onClose={() => setDrawerOpen(false)}
            gaps={openGapList}
            currentUserId={profile?.id ?? null}
            canOpenFullPage={canAccessRoute(profile, "/insights/knowledge-gaps", canManageSelected)}
          />
        )}
      </PanelPresence>
    </>
  );
}
