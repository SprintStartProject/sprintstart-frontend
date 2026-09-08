import { CloudOff } from "lucide-react";

type BoardLocalOnlyNoticeProps = {
  /** Whether the last exchange with the server showed the arrangement is only in this browser. */
  localOnly: boolean;
};

/**
 * One line saying where this board's arrangement is being kept, when the answer is "here".
 *
 * The cards themselves come from the server and are not in question; what this is about is the
 * layer over them — the stages, the areas, what is folded, what is pinned, the highlights. That
 * layer is written to this browser first and sent up afterwards, so a board whose sync is failing
 * looks exactly like a board whose sync is working, right up until the hire opens it somewhere else
 * and finds a board they do not recognise.
 *
 * **Not an error, and no retry.** Nothing has gone wrong for them: everything they arranged is on
 * the screen and will still be there tomorrow on this machine. The next change tries again by
 * itself, so a button here would only offer to do sooner what is already going to happen. The line
 * is one fact, in the voice the rest of the board uses for facts about the view.
 */
export function BoardLocalOnlyNotice({ localOnly }: BoardLocalOnlyNoticeProps) {
  if (!localOnly) return null;

  return (
    <p className="flex items-center gap-2 px-1 text-xs text-app-text-muted">
      <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      How you have arranged this board is saved on this device for now — it couldn&apos;t reach the
      server. Nothing is lost, and it will go up with your next change.
    </p>
  );
}
