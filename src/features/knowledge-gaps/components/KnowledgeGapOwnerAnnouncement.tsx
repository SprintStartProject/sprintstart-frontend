import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDialog } from "../../../components/ui/AlertDialog";
import { useAuth } from "../../../context/useAuth";
import { addAnnouncedComponents, readAnnouncedComponents } from "../ownerAnnouncement";
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
 * **Once per component, ever, and closing it acknowledges nothing.** The dialog is the
 * introduction, not the reminder: after it has been shown, the marker on the widget and the
 * one in the sidebar are what carry the news, and they stay until the card is pressed.
 * Neither button here clears them — "Show me" navigates, "Later" closes, and a dialog that
 * Escape can dismiss is not evidence that anybody read it.
 *
 * Mounted app-wide rather than on the dashboard, because being handed work should reach you
 * where you are.
 */
export function KnowledgeGapOwnerAnnouncement() {
  const { profile } = useAuth();

  // Remounted per user, so the dialog below can read what has already been announced once, on
  // mount, against a user id that is certain to be there.
  if (!profile) return null;

  return <OwnerAnnouncementDialog key={profile.id} userId={profile.id} />;
}

function OwnerAnnouncementDialog({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const { unseenComponents } = useMyKnowledgeGaps();

  /*
    Read once, on mount. Re-reading it on every render would only ever tell this component
    about the write it made itself, and would close the dialog in the frame after it opened —
    an assignment that arrives later in the session is simply not in it yet, which is exactly
    when the dialog should still appear.
  */
  const [alreadyAnnounced] = useState(() => readAnnouncedComponents(userId));
  const [isDismissed, setDismissed] = useState(false);

  const newComponents = unseenComponents.filter((component) => !alreadyAnnounced.has(component));
  const newKey = newComponents.join("|");

  const isOpen = !isDismissed && newComponents.length > 0;

  // Records the interruption in storage, which is an external system rather than state:
  // nothing here re-renders on it, because `alreadyAnnounced` was settled on mount.
  useEffect(() => {
    if (isOpen) addAnnouncedComponents(userId, newKey.split("|"));
  }, [isOpen, userId, newKey]);

  const isPlural = newComponents.length !== 1;

  return (
    <AlertDialog
      isOpen={isOpen}
      title={isPlural ? "You own new components now" : "You own a component now"}
      description={
        <>
          <p className="text-sm leading-relaxed text-app-text-muted">
            {describeComponents(newComponents)}{" "}
            {isPlural
              ? "have been put in your name. Their missing documentation is yours to write."
              : "has been put in your name. Its missing documentation is yours to write."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-app-text-muted">
            Your dashboard keeps track of what is still missing, and will keep flagging it until you
            have looked.
          </p>
        </>
      }
      confirmLabel="Show me"
      cancelLabel="Later"
      onConfirm={() => {
        setDismissed(true);
        void navigate("/");
      }}
      onClose={() => setDismissed(true)}
    />
  );
}
