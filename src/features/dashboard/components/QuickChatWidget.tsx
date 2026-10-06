import { useCallback, useState, type RefCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { useBuddyDraftActions } from "../../buddy/buddyDraftContext";
import { SleepyBot } from "../../buddy/components/SleepyBot";
import { withSeed } from "../../buddy/hooks/useBuddy";
import { centralSpringToken } from "../../../styles/tokens";
import type { DashboardWidgetSize } from "../layout/types";

/**
 * The pool the chips are drawn from, best first. Nothing shows all four — see the slices
 * below for why the wide band stops at three.
 */
const SUGGESTIONS = [
  "What should I work on next?",
  "How do I set up the project locally?",
  "Who owns this part of the codebase?",
  "Explain the onboarding flow",
];

/**
 * How many of a wrapping row's children sit on its first line, kept current as the row resizes.
 *
 * The band has one line for suggestions. Letting them wrap ran the band past its bottom edge,
 * and a sideways scroller hid the rest behind a scroll nobody expects. This lets the row wrap
 * out of sight and reports where the first line ends, so the chips past it can be taken out of
 * the tab order and the accessibility tree rather than merely clipped. `null` until measured.
 */
function useFirstLineCount(): [RefCallback<HTMLDivElement>, number | null] {
  const [count, setCount] = useState<number | null>(null);

  const ref = useCallback<RefCallback<HTMLDivElement>>((row) => {
    if (!row) return;

    const measure = () => {
      const items = [...row.children] as HTMLElement[];
      const firstTop = items[0]?.offsetTop ?? 0;
      const wrapped = items.findIndex((item) => item.offsetTop > firstTop);
      setCount(wrapped === -1 ? items.length : wrapped);
    };

    measure();
    // The chips as well as the row: a chip can change width while the row does not — most often
    // when the web font arrives after the first measurement — and the count would then be one off.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const chip of row.children) observer.observe(chip);

    return () => observer.disconnect();
  }, []);

  return [ref, count];
}

/**
 * Lets the user start a question straight from the dashboard.
 *
 * The text is seeded into the buddy's composer and the user is routed to `/buddy` with it
 * prefilled but *not* submitted, so they can still edit before sending — the same contract
 * the buddy's suggestion chips and the selection toolbar use.
 *
 * Seeded through the draft context directly rather than through the session's own helpers:
 * those are bound to the open conversation, and typing on the dashboard is not sending —
 * the words should wait in the composer, not open or move anything.
 */
export function QuickChatWidget({ size }: { size: DashboardWidgetSize }) {
  // Only a whole row is wide enough to put the bot beside the composer. At half a row the
  // two would fight for it, so the card stacks and everything below the composer centres
  // under it — a left-aligned row of chips under a centred bot reads as a mistake.
  const isWide = size === "wide";

  // Two chips at half a row. Across the band, as many as fit on its one line — all four on a
  // wide monitor, fewer on a laptop — measured rather than guessed (`useFirstLineCount`): a fixed
  // count either wasted the room or, a few pixels short, wrapped below the 136px cell's edge.
  const suggestions = isWide ? SUGGESTIONS : SUGGESTIONS.slice(0, 2);
  const navigate = useNavigate();
  const { setDraft } = useBuddyDraftActions();
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState(false);
  const [chipRowRef, fittingChips] = useFirstLineCount();

  function openInChat(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Seeded into the buddy's own composer and left unsent, so the hire can still edit
    // before sending — the same contract the buddy's suggestion chips use. The words land
    // in whichever box the buddy is showing: the page's after the route change below.
    setDraft((current) => withSeed(current, trimmed));
    void navigate("/buddy");
  }

  return (
    <div
      className={`@container relative flex h-full flex-col justify-center rounded-2xl ${isWide ? "px-6 py-3.5" : "p-6"}`}
    >
      {/* The clip lives on this layer rather than on the card itself, so
          the glow blobs stay inside the rounded edge while the content
          above is free to leave it — which is how the bot's Z's get to
          drift off the widget. Radius tracks the card's. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div
          className="absolute -bottom-24 -left-16 h-56 w-56 rounded-full opacity-15 blur-3xl"
          style={{ background: "var(--progress-fill-end)" }}
        />
        <div className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-app-brand/12 blur-3xl" />
      </div>

      <div
        // The wide form is always a row. It only renders on a board of two columns or more (see
        // `dashboardRenderSize`), where its cell is the 136px band -- and stacked, the bot, the
        // input and the suggestions need twice that. It used to switch on the *window* (`lg`),
        // so a band narrower than the window implied was stacked into a box it could not fit.
        className={`relative flex gap-5 ${isWide ? "flex-row items-center" : "flex-col"}`}
      >
        {/* Stacked and centred rather than a row: at this size the bot
            is the subject of the widget, not a bullet point in front of
            a label, and a 76px character with text beside it drags the
            baseline off-centre. */}
        <div
          className={`flex flex-col items-center text-center ${
            isWide ? "w-40 shrink-0 @3xl:w-56" : ""
          }`}
        >
          {/* The same assistant as in the buddy dock, idle timer and all —
              so the character is one creature that follows you around
              rather than a different mascot per screen.
              Negative margin rather than the parent's `gap`, which
              cannot go below zero: the SVG's own viewBox leaves
              empty space below the drawn glyph, plus a little more
              from the inline element's own baseline slack, and only
              pulling the label up into that dead space actually
              closes the gap — a small positive one just stacks on
              top of it. Matches the same pull used in the buddy's
              other homes, so the character sits the same distance
              from whatever it introduces everywhere it appears. */}
          <span className="-mb-2 text-app-brand-text">
            <SleepyBot size={isWide ? 56 : 76} tracksPointer />
          </span>

          <div className="min-w-0">
            {/* One line in the band: below `@3xl` the column is 160px, and wrapped at the base size
                the label made the band 4px taller than its 136px cell. */}
            <p
              className={`font-semibold text-app-text ${isWide ? "text-sm whitespace-nowrap @3xl:text-base" : ""}`}
            >
              Ask the AI assistant
            </p>
            {/* A single grid row has no line to spare for a subtitle the arrow already implies. */}
            {!isWide && <p className="text-xs text-app-text-muted">Continue with your buddy</p>}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {/* Gradient hairline that lights up on focus: a 1px gradient
                        backdrop with the real input inset on top of it. */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              openInChat(question);
            }}
            className={`rounded-2xl bg-gradient-to-r from-app-progress-fill to-app-progress-fill-end p-px transition-opacity ${
              focused ? "opacity-100" : "opacity-40"
            }`}
          >
            <div className="flex items-center gap-2 rounded-[15px] bg-app-surface px-3.5 py-2.5">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                aria-label="Ask the AI assistant a question"
                placeholder="Ask anything about your project…"
                className="min-w-0 flex-1 bg-transparent text-sm text-app-text outline-hidden placeholder:text-app-text-muted"
              />

              <button
                type="submit"
                disabled={!question.trim()}
                aria-label="Continue with your buddy"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
          </form>

          {/* One line in the band, holding only the suggestions that fit on it whole: the row
              wraps, the clip hides the second line, and `useFirstLineCount` takes the hidden chips
              out of reach too. A second visible line ran the band past its bottom edge; a sideways
              scroller kept them all but made you scroll a dashboard card to read them. `pt-1`
              rather than a margin, because the clip cuts upwards as well and the chips lift 2px
              on hover. */}
          <div
            ref={isWide ? chipRowRef : undefined}
            className={`flex flex-wrap gap-2 ${
              isWide ? "relative mt-2 max-h-[2.125rem] overflow-hidden pt-1" : "mt-3 justify-center"
            }`}
          >
            {suggestions.map((suggestion, index) => {
              const isOffLine = isWide && fittingChips !== null && index >= fittingChips;

              return (
                <motion.button
                  aria-hidden={isOffLine || undefined}
                  tabIndex={isOffLine ? -1 : undefined}
                  key={suggestion}
                  type="button"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...centralSpringToken,
                    delay: 0.05 * index,
                  }}
                  whileHover={{ y: -2 }}
                  onClick={() => openInChat(suggestion)}
                  className={`rounded-full border border-app-border-muted bg-app-surface-muted px-3 py-1.5 text-xs whitespace-nowrap text-app-text-muted transition-colors hover:border-app-brand-border hover:text-app-brand-text ${isOffLine ? "invisible" : ""}`}
                >
                  {suggestion}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
