import { MessagesSquare } from "lucide-react";
import { ConversationRail, RailToggle } from "../../components/layout/ConversationRail";
import { NEW_CONVERSATION_CHORD } from "../../hooks/useNewConversationShortcut";
import { BuddyConversationList } from "../../features/buddy/components/BuddyConversationList";
import { BuddyNewConversationButton } from "../../features/buddy/components/BuddyNewConversationButton";
import type { BuddySession } from "./buddyPageTypes";
import { RAIL_ID, RAIL_LABEL } from "./railPreference";

type BuddyRailProps = {
  session: BuddySession;
  isHireMode: boolean;
  isOpen: boolean;
  onSetOpen: (open: boolean) => void;
  canStart: boolean;
  onStart: () => void;
  onSelect: (id: string) => void;
};

/**
 * The hire's conversations. Always mounted, open or not: a rail that unmounted would lose its
 * scroll position every time it was put away, and the control that brings it back has to be there
 * from the first conversation on.
 */
export function BuddyRail({
  session,
  isHireMode,
  isOpen,
  onSetOpen,
  canStart,
  onStart,
  onSelect,
}: BuddyRailProps) {
  const { isOpening, isGreeting, isDeciding } = session;

  return (
    <ConversationRail
      id={RAIL_ID}
      isOpen={isOpen}
      label={RAIL_LABEL}
      onDismiss={() => onSetOpen(false)}
      dismissLabel="Close your conversations"
    >
      <div className="flex h-full min-h-0 flex-col">
        <BuddyConversationList
          sessions={session.sessions}
          currentSessionId={session.currentSessionId}
          // A team-mode conversation is not one of the hire's own, so the list is there to look at
          // but not to switch away with.
          disabled={!isHireMode || isOpening || isGreeting || isDeciding}
          onSelect={onSelect}
          // Binning needs the awaited promise (the dialog shows its spinner on it), so this one is
          // not wrapped in `void` like the selection.
          onBin={session.binSession}
          // The new-conversation button lives with the conversations it adds to. The floating one
          // only stands in while this rail is shut.
          onNew={onStart}
          newDisabled={!canStart}
          newShortcut={NEW_CONVERSATION_CHORD}
          // The rail's one cross, at its top: a mid-rail cross would read as closing one section.
          onClose={() => onSetOpen(false)}
          className="min-h-0 flex-1"
        />
      </div>
    </ConversationRail>
  );
}

/** The rail's way back, whenever it is shut — in either mode and with any number of conversations. */
export function BuddyRailToggle({ isOpen, onOpen }: { isOpen: boolean; onOpen: () => void }) {
  if (isOpen) return null;
  return (
    <RailToggle
      label={RAIL_LABEL}
      controls={RAIL_ID}
      icon={<MessagesSquare className="h-4 w-4" aria-hidden="true" />}
      onClick={onOpen}
    />
  );
}

/**
 * Only while the rail is shut: open, the same button is at the top of its list, and two of them on
 * one screen would read as two different things.
 */
export function BuddyFloatingNewButton({
  isOpen,
  canStart,
  onStart,
}: {
  isOpen: boolean;
  canStart: boolean;
  onStart: () => void;
}) {
  if (isOpen) return null;
  return (
    <BuddyNewConversationButton
      onClick={onStart}
      shortcut={NEW_CONVERSATION_CHORD}
      disabled={!canStart}
    />
  );
}
