import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Compass, LifeBuoy } from "lucide-react";
import type { BuddySuggestion } from "../../../services/buddyService";
import { FlagToPmButton } from "../../knowledge-request/components/FlagToPmButton";
import { MyEscalations } from "../../knowledge-request/components/MyEscalations";

type BuddySidePanelProps = {
  suggestions: BuddySuggestion[];
  /** Puts a suggestion's question in the composer. Never sends it. */
  onPick: (question: string) => void;
  /** The hire's last question, pre-filling the escalation form so flagging is one edit. */
  lastQuestion: string;
};

/**
 * The rail beside the conversation.
 *
 * It exists because everything on this page that is *not* the conversation used to be stacked
 * on top of it — the escalation record, the things worth asking, the way out when the buddy
 * cannot help — each one a full-width strip pushing the thread further down. On a desktop page
 * they are a column, which is where the rest of the app already puts its secondary content.
 *
 * Nothing in here sends anything. A card fills the composer or opens a form; the hire is the
 * one who presses send, which is the same rule the chips have always followed.
 */
export function BuddySidePanel({ suggestions, onPick, lastQuestion }: BuddySidePanelProps) {
  const prefersReducedMotion = useReducedMotion();

  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <aside
      aria-label="Alongside the conversation"
      className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto xl:pb-1"
    >
      {/* First, and not gated on the hire having spoken: an answer that came back from a
                person is the one thing here somebody may be blocked on. Renders nothing at all
                until they have escalated something. */}
      <MyEscalations />

      {suggestions.length > 0 && (
        <motion.div {...rise(0)}>
          <RailCard
            icon={Compass}
            title="Ask about"
            hint="Picking one writes it into the box — edit it before you send."
          >
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((suggestion) => (
                <li key={suggestion.label}>
                  <button
                    type="button"
                    onClick={() => onPick(suggestion.question)}
                    className="group flex w-full items-center gap-2 rounded-xl border border-app-border-muted bg-app-bg px-3 py-2.5 text-left text-sm text-app-text-muted transition-colors hover:border-app-brand-border hover:bg-app-surface-hover hover:text-app-text focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">{suggestion.label}</span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-app-text-disabled transition-colors group-hover:text-app-brand-text"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </RailCard>
        </motion.div>
      )}

      {/* Offered from the first minute rather than after the hire has asked something. It used
                to appear only once they had, which meant the one person most likely to need a way
                out — somebody stuck before they even knew what to ask — was the one person not
                shown it. */}
      <motion.div {...rise(0.06)}>
        <RailCard
          icon={LifeBuoy}
          title="Not getting anywhere?"
          hint="Your PM's answer comes back here, and the buddy keeps it for the next person."
        >
          <FlagToPmButton defaultQuestion={lastQuestion} />
        </RailCard>
      </motion.div>
    </aside>
  );
}

/**
 * One box in the rail, in the app's ordinary card clothes — the same radius, border and
 * surface the Starter Work KPIs and the Data Ingestion tiles wear, so this column reads as
 * part of the page rather than as chat furniture.
 */
function RailCard({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-app-border bg-app-surface p-4 shadow-sm sm:p-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-app-brand-soft text-app-brand-text">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 text-sm font-semibold text-app-text">{title}</h2>
      </div>

      {hint && <p className="mt-2.5 text-xs leading-relaxed text-app-text-subtle">{hint}</p>}

      <div className="mt-3.5">{children}</div>
    </section>
  );
}
