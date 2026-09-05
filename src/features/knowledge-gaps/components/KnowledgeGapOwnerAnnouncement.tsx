import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { useAuth } from "../../../context/useAuth";
import { readAnnouncedComponents, storeAnnouncedComponents } from "../ownerAnnouncement";
import { useMyKnowledgeGaps } from "../useMyKnowledgeGaps";

/** How many component names are spelled out before the rest become a count. */
const NAMED_LIMIT = 3;

/** "a, b and c", or "a, b and 2 more" once the list stops being readable. */
function describeComponents(components: readonly string[]): string {
  const named = components.slice(0, NAMED_LIMIT);
  const hidden = components.length - named.length;
  const parts = hidden > 0 ? [...named, `${hidden} more`] : named;

  if (parts.length === 1) return parts[0];

  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Tells a user, once, that a component has been put in their name.
 *
 * Ownership is assigned by somebody else — a PM on the knowledge-gaps page, or now while
 * connecting the repository in the first place — and until this existed there was nothing
 * anywhere that said so. The gap simply appeared on a dashboard card the user may not even
 * have placed, which is not a way to hand somebody work.
 *
 * Mounted app-wide rather than on the dashboard, because the point is to reach the user
 * wherever they are; "Show me" then takes them to the dashboard, where the card lives. What
 * has already been said is remembered per user, so this is a notification and not a nag —
 * see `ownerAnnouncement.ts` for why that memory is local to the browser.
 */
export function KnowledgeGapOwnerAnnouncement() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { gaps, isLoading, hasFailed } = useMyKnowledgeGaps();

  const userId = profile?.id ?? "";
  const components = gaps.map((gap) => gap.component);
  const componentKey = components.join("|");

  // What this render would announce, or `null` for nothing new. Held in state rather than
  // derived, so the dialog keeps saying the same thing while it is open even if the gaps
  // reload underneath it — and so dismissing it is what closes it, not a changed answer.
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    if (!userId || isLoading || hasFailed || components.length === 0) return;

    const announced = readAnnouncedComponents(userId);
    const unannounced = components.filter((component) => !announced.has(component));

    if (unannounced.length === 0) {
      // Nothing new, but the record still has to follow a component the user has stopped
      // owning out of the set — otherwise getting it back later would say nothing.
      storeAnnouncedComponents(userId, components);
      return;
    }

    setPending(unannounced);
    // `componentKey` is the dependency that matters: the array itself is rebuilt every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isLoading, hasFailed, componentKey]);

  const dismiss = () => {
    storeAnnouncedComponents(userId, components);
    setPending([]);
  };

  const isOpen = pending.length > 0;

  return (
    <AlertDialog
      isOpen={isOpen}
      title={pending.length === 1 ? "You own a component now" : "You own new components now"}
      description={
        <>
          <p className="text-sm leading-relaxed text-app-text-muted">
            {pending.length === 1
              ? `${describeComponents(pending)} has been put in your name. Its missing documentation is yours to write.`
              : `${describeComponents(pending)} have been put in your name. Their missing documentation is yours to write.`}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-app-text-muted">
            Your dashboard keeps track of what is still missing.
          </p>
        </>
      }
      confirmLabel="Show me"
      cancelLabel="Later"
      onConfirm={() => {
        dismiss();
        void navigate("/");
      }}
      onClose={dismiss}
    />
  );
}
