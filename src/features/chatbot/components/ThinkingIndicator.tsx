import { BotGlyph } from "./BotGlyph";
import { DinoGame } from "./DinoGame";
import { THINKING_LABELS, type ThinkingState } from "../constants";

type ThinkingIndicatorProps = {
    /** True while the assistant is working (before the first token arrives). */
    isThinking: boolean;
    /** Whether the dino easter-egg game is active (shown instead of the dots). */
    gameActive: boolean;
    /** The tool the backend currently reports it's running, if any. */
    thinkingState: string | null;
    /** Called when the user exits the dino game. */
    onGameExit: () => void;
};

/**
 * Status indicator shown while the assistant is thinking. Two variants share
 * the same status label row: a tiny endless-runner easter egg, or the classic
 * three bouncing dots. The status copy is centralized in
 * {@link THINKING_LABELS} so the two variants never drift apart (D2).
 */
export function ThinkingIndicator({
    isThinking,
    gameActive,
    thinkingState,
    onGameExit,
}: ThinkingIndicatorProps) {
    if (!isThinking) return null;

    // Resolve the status label; unknown tool names fall back to no label.
    const state = thinkingState as ThinkingState | null;
    const label = state && state in THINKING_LABELS ? THINKING_LABELS[state] : null;

    const StatusDots = (
        <>
            <span className="size-2 animate-bounce rounded-full bg-app-brand" aria-hidden="true" />
            <span
                className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:150ms]"
                aria-hidden="true"
            />
            <span
                className="size-2 animate-bounce rounded-full bg-app-brand [animation-delay:300ms]"
                aria-hidden="true"
            />
            {label && <span className="italic pl-2 animate-pulse text-sm">{label}</span>}
        </>
    );

    if (gameActive) {
        return (
            <div className="flex w-full gap-3" role="status">
                <div className="flex size-8 shrink-0 items-center justify-center">
                    <BotGlyph size={30} stage="awake" className="text-app-brand-text" />
                </div>

                <div className="min-w-0 flex-1">
                    <DinoGame onExit={onGameExit} />

                    <div className="mt-2 px-4 py-2.5 rounded-2xl bg-app-surface-muted text-app-text flex items-center gap-1 w-max border border-app-border-muted">
                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce" aria-hidden="true" />
                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:150ms]" aria-hidden="true" />
                        <span className="w-2 h-2 rounded-full bg-app-brand animate-bounce [animation-delay:300ms]" aria-hidden="true" />
                        {label && <span className="italic pl-2 animate-pulse text-sm">{label}</span>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex w-full gap-3" role="status">
            <div className="flex size-8 shrink-0 items-center justify-center">
                <BotGlyph size={30} stage="awake" className="text-app-brand-text" />
            </div>

            <div className="flex flex-col items-start max-w-[85%]">
                <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm border border-app-border-muted bg-app-surface-muted text-app-text">
                    <div className="flex gap-1 items-center">{StatusDots}</div>
                </div>
            </div>
        </div>
    );
}
