import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileWarning } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Modal } from "../../../components/ui/Modal";
import { useAuth } from "../../../context/useAuth";
import { SEVERITY_ORDER } from "../severity";
import { addAnnouncedComponents, readAnnouncedComponents } from "../ownerAnnouncement";
import { useMyKnowledgeGaps } from "../useMyKnowledgeGaps";
import { GapTypeChips, SeverityBar, SeverityPill } from "./SeverityIndicators";
import type { KnowledgeGap } from "../types";

/** Missing types spelled out on a row before the rest collapse into a `+n`. */
const VISIBLE_TYPE_COUNT = 4;

/**
 * Rows shown before the rest become a count.
 *
 * The body scrolls, so nothing would be lost without this -- but a notification you have to
 * scroll has stopped being a notification, and the drawer behind "Show me" is where the full
 * list belongs. Five is about what fits without one.
 */
const VISIBLE_ROW_COUNT = 5;

/**
 * One newly assigned component, as a row.
 *
 * The whole point of the dialog is *which* components these are, so each one is its own object
 * on the screen rather than a name inside a sentence: two repositories connected in one pass
 * read as two rows, with the severity that decides which to start on and the document types
 * that say what to actually write.
 */
function NewComponentRow({ gap }: { gap: KnowledgeGap }) {
  return (
    <li className="flex items-stretch gap-3 rounded-xl border border-app-border bg-app-surface p-3">
      <SeverityBar severity={gap.severity} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-sm leading-tight font-semibold break-words text-app-text">
            {gap.component}
          </p>
          <SeverityPill severity={gap.severity} />
        </div>

        <p className="mt-1 text-xs text-app-text-muted">
          {gap.missingTypes.length === 1
            ? "1 document missing"
            : `${gap.missingTypes.length} documents missing`}
        </p>

        <GapTypeChips types={gap.missingTypes} limit={VISIBLE_TYPE_COUNT} className="mt-2" />
      </div>
    </li>
  );
}

/**
 * Tells a user, once, that components have been put in their name.
 *
 * Ownership is assigned by somebody else — a PM on the knowledge-gaps page, or now while
 * connecting the repository in the first place — and until this existed there was nothing
 * anywhere that said so. The gap simply appeared on a dashboard card the user may not even
 * have placed, which is not a way to hand somebody work.
 *
 * **Once per component, ever, and closing it acknowledges nothing.** The dialog is the
 * introduction, not the reminder: after it has been shown, the marker on the widget and the
 * one in the sidebar are what carry the news, and they stay until the card is pressed. Neither
 * button here clears them — "Show me" navigates, "Later" closes, and a dialog that Escape can
 * dismiss is not evidence that anybody read it.
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
  const { gaps, unseenComponents } = useMyKnowledgeGaps();

  /*
    Read once, on mount. Re-reading it on every render would only ever tell this component
    about the write it made itself, and would close the dialog in the frame after it opened —
    an assignment that arrives later in the session is simply not in it yet, which is exactly
    when the dialog should still appear.
  */
  const [alreadyAnnounced] = useState(() => readAnnouncedComponents(userId));
  const [isDismissed, setDismissed] = useState(false);

  const unseen = new Set(unseenComponents);
  const newGaps = gaps
    .filter((gap) => unseen.has(gap.component) && !alreadyAnnounced.has(gap.component))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.component.localeCompare(b.component),
    );

  const visibleGaps = newGaps.slice(0, VISIBLE_ROW_COUNT);
  const hiddenCount = newGaps.length - visibleGaps.length;

  const newComponents = newGaps.map((gap) => gap.component);
  // Only ever a dependency. Splitting it back apart would have made a component name
  // containing a "|" into two, and `owner/name` is not a format that forbids one.
  const newKey = newComponents.join("|");

  const isOpen = !isDismissed && newGaps.length > 0;

  // Records the interruption in storage, which is an external system rather than state:
  // nothing here re-renders on it, because `alreadyAnnounced` was settled on mount.
  useEffect(() => {
    if (isOpen) addAnnouncedComponents(userId, newComponents);
    // `newComponents` is rebuilt every render; `newKey` is what actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId, newKey]);

  const close = () => setDismissed(true);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      size="md"
      title={
        newGaps.length === 1
          ? "A component is now yours"
          : `${newGaps.length} components are now yours`
      }
      closeLabel="Close"
      testId="knowledge-gap-owner-announcement"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Later
          </Button>

          <Button
            variant="primary"
            onClick={() => {
              close();
              void navigate("/");
            }}
          >
            Show me
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand">
            <FileWarning aria-hidden="true" className="h-5 w-5" />
          </span>

          <p className="text-sm leading-relaxed text-app-text-muted">
            {newGaps.length === 1
              ? "Its missing documentation is yours to write."
              : "Their missing documentation is yours to write."}{" "}
            Your dashboard keeps track of what is still missing, and will keep flagging it until you
            have looked.
          </p>
        </div>

        <ul className="space-y-2">
          {visibleGaps.map((gap) => (
            <NewComponentRow key={gap.id} gap={gap} />
          ))}
        </ul>

        {hiddenCount > 0 && (
          <p className="text-xs text-app-text-muted">and {hiddenCount} more assigned to you</p>
        )}
      </div>
    </Modal>
  );
}
