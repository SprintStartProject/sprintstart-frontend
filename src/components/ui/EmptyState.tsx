import type { ReactNode } from "react";

export type EmptyStateProps = {
    /**
     * Illustrative glyph above the title — a lucide icon, or a `Spinner` when
     * the emptiness is temporary and something is being fetched.
     */
    icon?: ReactNode;
    /**
     * Headline. Leave it out for the one-line form: a bare sentence in a dashed
     * box, which is right for a small slot inside a card where a headline would
     * be more chrome than content.
     */
    title?: ReactNode;
    /** The sentence itself — what is missing, and what would fill it. */
    children: ReactNode;
    /** A single call to action. Anything more belongs on the page, not in here. */
    action?: ReactNode;
    /** `sm` for a slot inside a card, `md` for a whole panel or page section. */
    size?: "sm" | "md";
    className?: string;
};

/**
 * The "there is nothing here" block: a dashed box saying what is missing and,
 * where there is something to do about it, offering the one action that helps.
 *
 * It replaces 26 hand-written variants that agreed on the dashed border and on
 * nothing else — padding ran from `px-4 py-3` to `p-8`, some centred their text
 * and some did not, and two of them were loading states wearing the same
 * clothes. That last case is why `icon` accepts a `Spinner`: an empty list and
 * a list that has not arrived yet look nearly alike, and the difference should
 * come from the words rather than from a different box.
 *
 * ```tsx
 * <EmptyState
 *     icon={<Database className="h-8 w-8 text-app-text-disabled" />}
 *     title="No sources connected"
 *     action={<Button variant="primary" onClick={add}>Add sources</Button>}
 * >
 *     Connect a GitHub repository to start ingesting artifacts.
 * </EmptyState>
 *
 * <EmptyState size="sm">This phase has no steps yet.</EmptyState>
 * ```
 */
export function EmptyState({
    icon,
    title,
    children,
    action,
    size = "md",
    className = "",
}: EmptyStateProps) {
    const isCompact = size === "sm";

    return (
        <div
            className={`rounded-2xl border border-dashed border-app-border bg-app-surface-muted text-center ${
                isCompact ? "px-4 py-4" : "px-6 py-8"
            } ${className}`.trim()}
        >
            {icon && (
                <div className="mb-3 flex justify-center text-app-text-disabled">
                    {icon}
                </div>
            )}

            {title && (
                <p
                    className={`font-semibold text-app-text ${
                        isCompact ? "text-sm" : "text-lg"
                    }`}
                >
                    {title}
                </p>
            )}

            <p
                className={`text-sm text-app-text-muted ${title ? "mt-1" : ""} ${
                    isCompact ? "" : "mx-auto max-w-md"
                }`.trim()}
            >
                {children}
            </p>

            {action && <div className="mt-5 flex justify-center">{action}</div>}
        </div>
    );
}
