import { MessageSquarePlus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { useBuddySession } from "../buddySessionContext";

/**
 * "New chat" for the buddy, as a page-level action in the assistant's header.
 *
 * It sits beside the switch, where the dashboard puts "Edit dashboard" and the knowledge base
 * puts its upload — because that is what it is: the one thing you can do *to* this page. It
 * spent a moment in a control row of its own above the conversation, and a lone button in an
 * otherwise empty strip reads as something that was left behind rather than offered.
 *
 * Its own component, mounted only while the buddy is the open surface, rather than the shell
 * reading the session directly. `useBuddySession` subscribes to a conversation that streams —
 * from the corner dock, on every page — and a shell that consumed it would re-render the chat
 * transcript on every token of a conversation happening somewhere else entirely.
 *
 * Not a delete. The transcript stays on the server and the buddy's durable memory note is
 * untouched — it is what the next greeting is written from, which is why starting fresh does
 * not mean starting over. Only the scrollback moves on. Offered only once there is something
 * to leave behind: on an untouched thread it would open the visit already on screen.
 */
export function BuddyNewChatAction() {
  const { messages, startFreshVisit } = useBuddySession();

  if (!messages.some((message) => message.role === "USER")) return null;

  return (
    <Button
      variant="secondary"
      onClick={() => void startFreshVisit()}
      title="Start a new conversation — your buddy keeps what it has learned about you"
      icon={<MessageSquarePlus className="h-4 w-4" aria-hidden="true" />}
    >
      New chat
    </Button>
  );
}
