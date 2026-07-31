import { useEffect, useState, type ReactNode } from "react";
import { PanelPresenceContext } from "./panelPresenceContext";
import { SIDE_PANEL_SLIDE_MS } from "../../styles/tokens";

/**
 * How long a closing panel is kept mounted. A small margin on top of the slide
 * itself, so the panel is never torn out on the last frame of its animation.
 */
const RETAIN_WHILE_CLOSING_MS = SIDE_PANEL_SLIDE_MS + 30;

type PanelPresenceProps<T> = {
    /** The entity the panel is showing, or `null`/`undefined` when it should close. */
    value: T | null | undefined;
    children: (value: T) => ReactNode;
};

/**
 * Keeps a detail panel mounted long enough to animate itself out.
 *
 * Detail panels are usually rendered as `{selected && <Panel item={selected} />}`.
 * That pattern makes an exit animation impossible: the moment the selection is
 * cleared React rips the panel out of the tree, so there is nothing left to
 * animate and the panel appears to vanish instantly.
 *
 * This component holds on to the last non-null value after the selection is
 * cleared, flips the surrounding context to "closing" so the panel slides away,
 * and only then drops the retained value.
 *
 * ```tsx
 * <PanelPresence value={selectedSource}>
 *   {(source) => <SourceDetailsPanel source={source} onClose={close} />}
 * </PanelPresence>
 * ```
 */
export function PanelPresence<T>({ value, children }: PanelPresenceProps<T>) {
    const isOpen = value !== null && value !== undefined;
    const [retained, setRetained] = useState<T | null>(value ?? null);

    // Deriving state from props during render is the supported pattern here:
    // React discards this render and immediately re-runs it, so no extra
    // commit is ever painted.
    if (isOpen && value !== retained) {
        setRetained(value);
    }

    useEffect(() => {
        if (isOpen) return;

        const timeoutId = window.setTimeout(() => {
            setRetained(null);
        }, RETAIN_WHILE_CLOSING_MS);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [isOpen]);

    if (retained === null) {
        return null;
    }

    return (
        <PanelPresenceContext.Provider value={{ isOpen }}>
            {children(retained)}
        </PanelPresenceContext.Provider>
    );
}
