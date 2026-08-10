import { Loader2 } from "lucide-react";

/** Matches `ButtonSize` and `FieldSize`, so a spinner never dwarfs its neighbour. */
export type SpinnerSize = "sm" | "md" | "lg";

export type SpinnerProps = {
    size?: SpinnerSize;
    /**
     * What is being waited for, announced to screen readers. Keep it specific —
     * "Loading projects" tells someone more than "Loading".
     */
    label?: string;
    /**
     * Set when the surrounding element already says "loading" out loud (a
     * `Button` with `aria-busy`, an `EmptyState` with its own title). Two
     * announcements for one wait is worse than none.
     */
    silent?: boolean;
    className?: string;
};

const sizeClasses: Record<SpinnerSize, string> = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-6 w-6",
};

/**
 * The app's loading glyph.
 *
 * There were 47 hand-written `animate-spin` icons before this existed, in four
 * sizes and with no accessible announcement anywhere: a screen reader user got
 * silence while the page waited. `role="status"` fixes that once.
 *
 * For a button, do not reach for this — `Button`'s `loading` prop already
 * renders it in the right size and wires up `aria-busy`.
 */
export function Spinner({
    size = "md",
    label = "Loading",
    silent = false,
    className = "",
}: SpinnerProps) {
    return (
        <span
            role={silent ? undefined : "status"}
            className={`inline-flex items-center justify-center ${className}`.trim()}
        >
            <Loader2
                className={`${sizeClasses[size]} animate-spin text-app-brand`}
                aria-hidden="true"
            />
            {!silent && <span className="sr-only">{label}</span>}
        </span>
    );
}
