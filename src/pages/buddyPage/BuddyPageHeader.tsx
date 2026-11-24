import { MessageSquare, Send } from "lucide-react";
import { PageHeader } from "../../components/layout/PageHeader";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { BuddyModeSwitcher } from "../../features/buddy/components/BuddyModeSwitcher";

type BuddyPageHeaderProps = {
  /** Offered to whoever manages a project and to nobody else, so a hire never meets a control with one choice. */
  canSwitchModes: boolean;
  teamProjectId: string | null;
  onSwitchMode: (projectId: string | null) => void;
  switchDisabled: boolean;
  /** Hire-flow only: what came back from the PM answers the hire's own questions. */
  showReplies: boolean;
  unseenReplyCount: number;
  onOpenReplies: () => void;
};

function RepliesButton({ unseenCount, onOpen }: { unseenCount: number; onOpen: () => void }) {
  return (
    <Button
      variant="secondary"
      onClick={onOpen}
      icon={<Send className="h-4 w-4" aria-hidden="true" />}
      aria-label={
        unseenCount > 0 ? `Sent to your PM — ${unseenCount} not looked at yet` : undefined
      }
    >
      Sent to your PM
      {unseenCount > 0 && (
        <Badge variant="brand" size="sm" className="ml-1.5" aria-hidden="true">
          {unseenCount}
        </Badge>
      )}
    </Button>
  );
}

/** The page header: the mode switcher for managers and the button that opens what was sent to the PM. */
export function BuddyPageHeader({
  canSwitchModes,
  teamProjectId,
  onSwitchMode,
  switchDisabled,
  showReplies,
  unseenReplyCount,
  onOpenReplies,
}: BuddyPageHeaderProps) {
  return (
    <header className="shrink-0 border-b border-app-border bg-app-bg">
      <div className="app-page-frame py-6">
        <PageHeader
          icon={MessageSquare}
          title="Buddy"
          subtitle="Your onboarding mentor — here whenever you're stuck."
          // The subtitle is the line with the least to say on a phone, so it is the one that makes
          // room rather than pushing the conversation further down.
          hideSubtitleBelow="md"
          actions={
            canSwitchModes || showReplies ? (
              <>
                {canSwitchModes && (
                  <BuddyModeSwitcher
                    teamProjectId={teamProjectId}
                    onSwitch={onSwitchMode}
                    disabled={switchDisabled}
                    className="w-full sm:w-56"
                  />
                )}
                {showReplies && (
                  <RepliesButton unseenCount={unseenReplyCount} onOpen={onOpenReplies} />
                )}
              </>
            ) : undefined
          }
        />
      </div>
    </header>
  );
}
