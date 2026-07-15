import type { KeyboardEvent, ReactNode } from "react";

type ClickableCardProps = {
    /** Invoked when the card itself (not a nested interactive element) is activated. */
    onClick: () => void;
    className?: string;
    children: ReactNode;
    "aria-label"?: string;
    /**
     * Whether the card itself should be a keyboard-operable `role="button"`
     * region. Must be `false` when the card contains nested interactive
     * descendants (links/buttons) - ARIA (and axe-core's "nested-interactive"
     * rule) forbids an interactive control from containing another one.
     * In that case, provide a separate real link/button inside the card
     * (e.g. a "See all" action) as the keyboard-accessible entry point;
     * `onClick` still fires for mouse users clicking the card background.
     */
    interactive?: boolean;
};

/**
 * Makes an entire dashboard widget card clickable (and, when `interactive`
 * is true, keyboard-activatable via Enter/Space) instead of requiring a
 * separate "See all" affordance.
 *
 * Nested interactive elements (links, buttons for individual list items)
 * must call `event.stopPropagation()` in their own click handler — otherwise
 * clicking them would also trigger this card's `onClick` and navigate away
 * from the intended target.
 */
export function ClickableCard({
    onClick,
    className,
    children,
    interactive = true,
    ...rest
}: ClickableCardProps) {
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
        }
    };

    if (!interactive) {
        return (
            // Deliberately not a keyboard/AT-operable region here: the card
            // contains its own nested interactive elements (e.g. a "See all"
            // button), which are the real, non-nested keyboard entry points.
            // This `onClick` is a mouse-only convenience for clicking the
            // card background.
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <div onClick={onClick} className={className} {...rest}>
                {children}
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={handleKeyDown}
            className={className}
            {...rest}
        >
            {children}
        </div>
    );
}
