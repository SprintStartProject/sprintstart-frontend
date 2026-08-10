import { forwardRef, useCallback, useContext, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { FieldContext } from "./fieldContext";
import { textareaClasses } from "./fieldStyles";
import { useAutoResize } from "./useAutoResize";

type TextareaOwnProps = {
    /**
     * Marks the field as failing validation. Inside a `Field` this is inherited
     * from the error prop and does not need to be passed.
     */
    invalid?: boolean;
    /**
     * Height in lines before the field has any content, and the ceiling it may
     * grow to. Past `maxRows` it scrolls internally instead of pushing the rest
     * of the dialog off screen.
     */
    minRows?: number;
    maxRows?: number;
    /**
     * Turns off growing and gives the user a drag handle instead. Only for the
     * rare field whose height must stay put — one whose container is measured,
     * or one sitting next to something that must not move.
     */
    autoResize?: boolean;
};

export type TextareaProps = TextareaOwnProps &
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows">;

/**
 * The app's multi-line text control. Shares border, radius, focus ring,
 * placeholder color and disabled treatment with `Input`, so a form mixing the
 * two reads as one set of controls rather than two.
 *
 * **It grows as you type.** That is the default and, in almost every case, the
 * right answer: the alternative is a box that hides the beginning of what the
 * user just wrote behind an internal scrollbar. The app used to have both
 * behaviours — a hand-rolled auto-growing textarea in one dialog and a fixed
 * box with a drag handle everywhere else — which was only tolerable while the
 * two also looked different. Once they shared a border, the split read as a
 * bug: same control, same styling, different behaviour depending on the screen.
 *
 * Growth is bounded by `maxRows`, so a pasted wall of text cannot push a dialog
 * footer off screen; beyond that it scrolls.
 *
 * ```tsx
 * <Field label="Description">
 *     <Textarea
 *         value={description}
 *         onChange={(event) => setDescription(event.target.value)}
 *         minRows={3}
 *         maxRows={10}
 *     />
 * </Field>
 * ```
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    function Textarea(
        {
            invalid,
            minRows = 3,
            maxRows = 10,
            autoResize = true,
            className = "",
            id,
            disabled,
            value,
            "aria-describedby": ariaDescribedBy,
            ...rest
        },
        forwardedRef,
    ) {
        const field = useContext(FieldContext);
        const isInvalid = invalid ?? field?.invalid ?? false;

        const innerRef = useRef<HTMLTextAreaElement | null>(null);

        /**
         * Keeps the caller's ref working while the component holds its own —
         * the measuring needs the element, and `forwardRef` alone would hand it
         * away.
         */
        const setRef = useCallback(
            (element: HTMLTextAreaElement | null) => {
                innerRef.current = element;

                if (typeof forwardedRef === "function") forwardedRef(element);
                else if (forwardedRef) forwardedRef.current = element;
            },
            [forwardedRef],
        );

        useAutoResize({
            ref: innerRef,
            value: typeof value === "string" ? value : "",
            minRows,
            maxRows,
            enabled: autoResize,
        });

        return (
            <textarea
                ref={setRef}
                id={id ?? field?.controlId}
                rows={minRows}
                value={value}
                disabled={disabled ?? field?.disabled ?? false}
                aria-invalid={isInvalid || undefined}
                aria-describedby={ariaDescribedBy ?? field?.describedBy}
                className={textareaClasses({
                    invalid: isInvalid,
                    className: `${
                        autoResize ? "resize-none overflow-hidden" : "resize-y"
                    } ${className}`.trim(),
                })}
                {...rest}
            />
        );
    },
);
