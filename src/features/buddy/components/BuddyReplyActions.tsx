import { BookmarkPlus } from "lucide-react";
import { CopyButton } from "../../chatbot/components/CopyButton";
import { SaveToBoard } from "../../board/save/SaveToBoard";
import { buddyReplyNote } from "../../board/generation/chatToCard";
import { SaveReplyToBoard } from "./SaveReplyToBoard";

/**
 * The quiet row under one of the buddy's replies: copy it, keep it as a checklist, keep it as a
 * note.
 *
 * One component for the dock and the page, because the two had drifted into different controls —
 * an icon-only square in the dock, a worded `sm` button on the page — for the same action on the
 * same reply. It is also the same row, in the same order and at the same `xs` size, that sits under
 * an answer in the chat, so "what can I do with this answer" has one answer across the app.
 *
 * Pulled left by the buttons' own padding so the first icon lines up with the bubble's edge rather
 * than floating a few pixels inside it.
 */
export function BuddyReplyActions({ reply }: { reply: string }) {
  return (
    <div className="-ml-2 flex flex-wrap items-center gap-0.5">
      <CopyButton text={reply} />

      {/* Draws nothing when the reply holds no list, so most replies show two actions. When it does,
          it comes first: a checklist you can tick is the better thing to keep. */}
      <SaveReplyToBoard content={reply} />

      <SaveToBoard
        request={() => buddyReplyNote(reply)}
        label="Keep on my board"
        savedLabel="On your board"
        description="The reply, frozen as a note."
        icon={<BookmarkPlus className="h-3.5 w-3.5" aria-hidden="true" />}
        size="xs"
      />
    </div>
  );
}
