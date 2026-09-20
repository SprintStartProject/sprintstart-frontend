import { AnimatePresence, motion } from "framer-motion";
import { ListPlus, Send, X } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { centralSpringToken } from "../../../styles/tokens";
import type { ChatQueueItem } from "../types";

type QueuedMessagesProps = {
  /** Messages waiting behind the running answer, oldest first. */
  items: ChatQueueItem[];
  /** True when Stop held the queue back — the strip offers to release it. */
  paused: boolean;
  /** Drops a queued message without sending it. */
  onRemove: (id: string) => void;
  /** Takes a queued message back into the composer for editing. */
  onEdit: (id: string) => void;
  /** Releases a queue that Stop paused, starting with the oldest message. */
  onSendQueued: () => void;
};

/**
 * The messages the user submitted while an answer was still being written.
 *
 * This is the visible half of the queue in `ChatProvider`: without it, a
 * follow-up that did not send would look like it had been swallowed — the
 * composer clears on submit, so the text has to be seen somewhere. Each item can
 * be pulled back into the composer or dropped, which is the "review or remove
 * before it is sent" the issue asked for.
 *
 * The order shown is the order they will be sent in, numbered so it is legible
 * rather than implied.
 */
export function QueuedMessages({
  items,
  paused,
  onRemove,
  onEdit,
  onSendQueued,
}: QueuedMessagesProps) {
  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.section
          key="queued"
          aria-label="Queued messages"
          data-testid="chat-queue"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={centralSpringToken}
          className="mb-3 rounded-2xl border border-app-border-muted bg-app-surface-muted p-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-xs font-medium text-app-text-muted">
              <ListPlus size={14} aria-hidden="true" />
              {items.length === 1 ? "1 queued message" : `${items.length} queued messages`}
              <span className="text-app-text-subtle">
                {paused ? "— held by Stop" : "— sent in order once this answer finishes"}
              </span>
            </p>

            {paused && (
              <Button
                size="xs"
                variant="primary"
                icon={<Send size={14} aria-hidden="true" />}
                onClick={onSendQueued}
                data-testid="chat-queue-resume"
              >
                Send queued
              </Button>
            )}
          </div>

          <ol className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {items.map((item, index) => (
                <motion.li
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={centralSpringToken}
                  data-testid="chat-queue-item"
                  className="flex items-center gap-2 rounded-xl border border-app-border-muted bg-app-surface px-3 py-1.5"
                >
                  <Badge variant="neutral" size="sm">
                    {index + 1}
                  </Badge>

                  {/* The row itself is the edit affordance: it hands the text back
                      to the composer, which is where it can be changed. */}
                  <button
                    type="button"
                    onClick={() => onEdit(item.id)}
                    title="Edit this message"
                    aria-label={`Edit queued message ${index + 1}`}
                    className="min-w-0 flex-1 truncate rounded-lg px-1 py-0.5 text-left text-sm text-app-text transition-colors hover:bg-app-surface-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    {item.text}
                  </button>

                  <Button
                    iconOnly
                    size="xs"
                    variant="ghost"
                    aria-label={`Remove queued message ${index + 1}`}
                    onClick={() => onRemove(item.id)}
                    data-testid="chat-queue-remove"
                  >
                    <X size={14} aria-hidden="true" />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
