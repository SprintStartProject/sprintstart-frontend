import { Loader2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buttonHoverMotion, buttonHoverMotionDisabled } from "../../styles/tokens";

/**
 * Semantic intent of a button. Pick by *meaning*, never by how it should look:
 *
 * - `primary` — the one action the screen wants you to take. At most one per
 *   view or per dialog footer.
 * - `secondary` — a real alternative that sits next to a primary ("Cancel",
 *   "Back", toolbar actions). The default.
 * - `ghost` — low-weight action that must not compete with surrounding content
 *   (icon buttons in rows and headers, "show more", close affordances).
 * - `danger` — destructive and confirmed, i.e. the button that actually
 *   deletes. Solid red so it reads as a point of no return.
 * - `dangerSoft` — destructive but still one step away from the deletion, e.g.
 *   "Remove" inside a row that then opens a confirm dialog.
 * - `dangerGhost` — destructive action that has to stay visually quiet, e.g. a
 *   trash icon in a dense list.
 */
export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "dangerSoft" | "dangerGhost";

/**
 * Size scale. `md` is the default and the only size that is guaranteed to meet
 * the 44px touch target, so `sm` is reserved for dense desktop surfaces
 * (table rows, filter bars) where a pointer is a given.
 */
export type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Renders a square button sized to `size`, with no horizontal padding.
   * Requires `aria-label` — an icon button has no accessible name otherwise.
   */
  iconOnly?: boolean;
  /** Stretches the button to the width of its container. */
  fullWidth?: boolean;
  /**
   * Shows a spinner in place of `icon` and disables the button. Also sets
   * `aria-busy`, so the state is announced rather than only drawn.
   */
  loading?: boolean;
  /**
   * Leading icon. Pass the element, not the component:
   * `icon={<Plus className="h-4 w-4" />}`. Swapped for the spinner while
   * `loading`. Sized by the caller so a 16px and a 14px icon can coexist.
   */
  icon?: ReactNode;
  /** Trailing icon, e.g. a chevron. Never replaced by the spinner. */
  trailingIcon?: ReactNode;
  children?: ReactNode;
};

/**
 * `motion.button` and a plain `<button>` disagree about the drag and animation
 * event handlers, so those are dropped rather than forwarded — a button has no
 * business being dragged.
 */
type ForwardedButtonAttributes = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragExit"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "style"
>;

export type ButtonProps = ButtonOwnProps & ForwardedButtonAttributes;

/**
 * Classes every button shares, regardless of variant or size.
 *
 * The transparent border on the variants that have no visible outline is
 * deliberate: `border-box` sizing means a bordered and a borderless button of
 * the same `h-*` would otherwise disagree about their inner height by 2px, and
 * a "Cancel"/"Save" pair sitting side by side would not line up.
 */
const baseClasses =
  "inline-flex select-none items-center justify-center whitespace-nowrap border font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Only `primary` casts the brand-colored lift shadow on hover. It is the badge
 * of "this is the action this screen wants"; if every variant glowed, the cue
 * would carry no information.
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-app-brand text-white hover:bg-app-brand-hover hover:shadow-app-brand-lift",
  secondary: "border-app-border bg-app-surface text-app-text hover:bg-app-surface-hover",
  ghost:
    "border-transparent bg-transparent text-app-text-muted hover:bg-app-surface-hover hover:text-app-text",
  danger: "border-transparent bg-app-danger-solid text-white hover:opacity-90",
  dangerSoft: "border-app-danger-border bg-app-danger-bg text-app-danger-text hover:opacity-90",
  dangerGhost: "border-transparent bg-transparent text-app-danger-text hover:bg-app-danger-bg",
};

/**
 * Height, padding, type scale and radius per size.
 *
 * The radius grows with the button so the corner stays optically constant:
 * `rounded-xl` on a 36px control looks like a pill, `rounded-lg` on a 48px one
 * looks like a box.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-11 gap-2 rounded-xl px-5 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-sm",
};

/** Square counterparts to {@link sizeClasses} — same heights, no side padding. */
const iconOnlySizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 w-9 rounded-lg",
  md: "h-11 w-11 rounded-xl",
  lg: "h-12 w-12 rounded-xl",
};

/** Spinner size per button size, so the icon slot does not change width. */
const spinnerClasses: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
};

/**
 * The app's single button.
 *
 * Every `<button>` that carries an action should be this component. It exists
 * so that height, radius, type scale, hover, focus ring and disabled treatment
 * are decided once instead of re-derived at ~250 call sites — the drift that
 * produced 28 different "primary button" spellings before it was introduced.
 *
 * Choose `variant` by intent and `size` by density; everything else follows.
 * `className` is appended last for genuine one-offs (layout, `flex-1`, a
 * feature-specific accent), but reach for it rarely: if a variant is missing,
 * add it here rather than patching it at the call site.
 *
 * **Press motion is not opt-in.** Every button sinks on press through the
 * shared `buttonHoverMotion` token. It used to be applied by hand at 18 call
 * sites, which is why the same "Refresh" icon button reacted on one page header
 * and sat dead on another. Hover is a colour change per variant, not a scale —
 * see the token for why nothing here may grow past its resting size. A disabled
 * or loading button gets `buttonHoverMotionDisabled` so it also *feels* dead,
 * and `prefers-reduced-motion` removes the movement entirely.
 *
 * ```tsx
 * <Button onClick={save} loading={saving} icon={<Check className="h-4 w-4" />}>
 *     Save changes
 * </Button>
 * <Button variant="secondary" onClick={close}>Cancel</Button>
 * <Button variant="ghost" size="sm" iconOnly aria-label="Close">
 *     <X className="h-4 w-4" />
 * </Button>
 * ```
 *
 * Not for navigation: a control that changes the URL is an `<a>`/`<Link>`, and
 * styling one as a button does not make it keyboard- or screen-reader-correct.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    iconOnly = false,
    fullWidth = false,
    loading = false,
    icon,
    trailingIcon,
    disabled = false,
    type = "button",
    className = "",
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const prefersReducedMotion = useReducedMotion();

  const hoverMotion =
    isDisabled || prefersReducedMotion ? buttonHoverMotionDisabled : buttonHoverMotion;

  const classes = [
    baseClasses,
    variantClasses[variant],
    iconOnly ? iconOnlySizeClasses[size] : sizeClasses[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const spinner = <Loader2 className={`${spinnerClasses[size]} animate-spin`} aria-hidden="true" />;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      className={classes}
      {...hoverMotion}
      {...rest}
    >
      {iconOnly ? (
        /* The icon *is* the content here, so the spinner replaces it
                   rather than joining it. */
        loading ? (
          spinner
        ) : (
          children
        )
      ) : (
        <>
          {loading ? spinner : icon}
          {children}
          {trailingIcon}
        </>
      )}
    </motion.button>
  );
});
