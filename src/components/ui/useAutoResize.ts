import { useCallback, useLayoutEffect } from "react";
import type { RefObject } from "react";

type UseAutoResizeOptions = {
    /** The element to measure and size. */
    ref: RefObject<HTMLTextAreaElement | null>;
    /**
     * Current text. The field is re-measured whenever this changes, which is
     * what makes it shrink again after a reset — the bug every hand-rolled
     * version of this has, because resizing inside `onChange` only ever runs
     * while the *user* types.
     */
    value: string;
    /** Height floor and ceiling, in lines. Past the ceiling it scrolls. */
    minRows: number;
    maxRows: number;
    /** Set to false to leave the height alone. */
    enabled?: boolean;
};

/**
 * Sizes a textarea to its content, between a floor and a ceiling.
 *
 * Shared by `Textarea` and by the chat composer, which cannot use `Textarea`
 * itself: it is borderless and sits inside the composer's own box, so it needs
 * the behaviour without the styling.
 */
export function useAutoResize({
    ref,
    value,
    minRows,
    maxRows,
    enabled = true,
}: UseAutoResizeOptions) {
    const resize = useCallback(() => {
        const element = ref.current;
        if (!element || !enabled) return;

        const computed = window.getComputedStyle(element);
        const lineHeight = parseFloat(computed.lineHeight) || 20;
        const chrome =
            (parseFloat(computed.paddingTop) || 0) +
            (parseFloat(computed.paddingBottom) || 0) +
            (parseFloat(computed.borderTopWidth) || 0) +
            (parseFloat(computed.borderBottomWidth) || 0);

        // Reset first: `scrollHeight` reports the larger of content and current
        // height, so measuring without this makes the field grow and never
        // shrink.
        element.style.height = "auto";
        element.style.height = `${Math.min(
            Math.max(element.scrollHeight, minRows * lineHeight + chrome),
            maxRows * lineHeight + chrome,
        )}px`;
    }, [enabled, maxRows, minRows, ref]);

    // Before paint, so the field is never briefly the wrong height.
    useLayoutEffect(() => {
        resize();
    }, [resize, value]);

    useLayoutEffect(() => {
        if (!enabled) return;

        // A width change re-wraps the text, which changes the height needed.
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [enabled, resize]);

    return resize;
}
