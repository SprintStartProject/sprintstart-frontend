/**
 * The look of every text control in the app — input, textarea and the
 * auto-growing chat composer — in one place.
 *
 * Before this existed, 62 text controls carried their own spelling of the same
 * idea: six different focus treatments, four heights, and 34 of them with no
 * `placeholder:` color at all. The most common focus ring was
 * `ring-app-brand-glow`, a 10%-opacity blue that is very nearly invisible —
 * which is why focus is now drawn by the global `:focus-visible` outline
 * (`--app-focus`, see `index.css`), the same one `Button` gets.
 */

/** Matches `ButtonSize`, so a control and a button in one row line up exactly. */
export type FieldSize = "sm" | "md" | "lg";

/**
 * The outline comes from the global `:focus-visible` rule, which browsers also
 * apply to a text field that is clicked, so the field shows focus for mouse and
 * keyboard alike. Only the border color is set here.
 */
const baseFieldClasses =
  "w-full border bg-app-surface text-app-text transition-colors " +
  "placeholder:text-app-text-disabled " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const normalBorderClasses = "border-app-border focus:border-app-brand-border-strong";

/**
 * An invalid control is outlined in red *and* keeps its error text below it, so
 * the state is never carried by color alone (FRONTEND_CODING_STANDARDS.md §5).
 */
const invalidBorderClasses = "border-app-danger-border focus:border-app-danger-solid";

const sizeClasses: Record<FieldSize, string> = {
  sm: "h-9 rounded-lg px-3 text-base sm:text-sm pointer-coarse:text-base",
  md: "h-11 rounded-xl px-3 text-base sm:text-sm pointer-coarse:text-base",
  lg: "h-12 rounded-xl px-4 text-base sm:text-sm pointer-coarse:text-base",
};

/** Left padding that clears a leading icon, per size. */
const leadingIconPadding: Record<FieldSize, string> = {
  sm: "pl-9",
  md: "pl-10",
  lg: "pl-11",
};

/**
 * Right padding that clears a trailing element, per size.
 *
 * Sized for a `Button`, not for a bare icon: `trailing` is the clickable slot
 * (refresh, password toggle), so what sits there is at least an `iconOnly`
 * button — 36px wide — offset by {@link trailingPosition}. Padding that only
 * cleared a 16px icon would let the text run underneath it.
 */
const trailingPadding: Record<FieldSize, string> = {
  sm: "pr-11",
  md: "pr-12",
  lg: "pr-14",
};

/** Where the leading icon sits, per size. */
export const leadingIconPosition: Record<FieldSize, string> = {
  sm: "left-2.5",
  md: "left-3",
  lg: "left-3.5",
};

/** Where a trailing element sits, per size. */
export const trailingPosition: Record<FieldSize, string> = {
  sm: "right-1",
  md: "right-1.5",
  lg: "right-2",
};

type FieldClassOptions = {
  size: FieldSize;
  invalid: boolean;
  hasLeadingIcon: boolean;
  hasTrailing: boolean;
  className: string;
};

/** Builds the class list for a single-line control (`input`, `select`). */
export function fieldClasses({
  size,
  invalid,
  hasLeadingIcon,
  hasTrailing,
  className,
}: FieldClassOptions): string {
  return [
    baseFieldClasses,
    invalid ? invalidBorderClasses : normalBorderClasses,
    sizeClasses[size],
    hasLeadingIcon ? leadingIconPadding[size] : "",
    hasTrailing ? trailingPadding[size] : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Builds the class list for a multi-line control.
 *
 * A textarea cannot use a fixed `h-*` — its whole point is to grow — so the
 * height classes are replaced by vertical padding and a `min-h`, while radius,
 * border, focus and placeholder stay identical to the single-line control.
 */
export function textareaClasses({
  invalid,
  className,
}: {
  invalid: boolean;
  className: string;
}): string {
  return [
    baseFieldClasses,
    invalid ? invalidBorderClasses : normalBorderClasses,
    "rounded-xl px-3 py-2 text-sm leading-relaxed",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}
