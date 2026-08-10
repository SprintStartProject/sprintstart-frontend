import type { ReactNode } from "react";

/**
 * What the badge is saying, not what colour it is.
 *
 * - `brand` — neutral emphasis, the default. "This thing is a role/tag/type."
 * - `success` / `warning` / `danger` — the app's ordinary status ladder.
 * - `neutral` — a fact with no judgement attached (counts, plain labels).
 * - `purple` / `orange` — a *reached* and a *pending* state that must not be
 *   confused with Success and Warning. "Onboarding: Done" sits directly under
 *   "Account: Active"; in green they read as the same statement, which they are
 *   not. Kept deliberately small: two accents, one meaning each.
 *
 * `pink`, `yellow` and `navy` used to exist here too. Nothing ever used them,
 * and each carried three hardcoded Tailwind colours with `dark:` overrides —
 * together 30 of the 38 raw colour values in the whole codebase. They are gone
 * (standards §1: no abstractions for potential future use).
 */
export type BadgeVariant =
    | "success"
    | "brand"
    | "warning"
    | "neutral"
    | "danger"
    | "purple"
    | "orange";

/**
 * `sm` for badges inside dense rows and cards, `md` when the badge is a element
 * of the page in its own right.
 */
export type BadgeSize = "sm" | "md";

export type BadgeProps = {
    children: ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    /**
     * Native tooltip. Used by the ingestion run badges to surface a failure
     * reason whose full text lives in the drawer — never for information the
     * user needs, since a tooltip is invisible on touch and to screen readers.
     */
    title?: string;
    className?: string;
};

const badgeVariantClasses: Record<BadgeVariant, string> = {
    success: "border-app-success-border bg-app-success-bg text-app-success-text",
    brand: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
    warning: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
    neutral: "border-app-neutral-border bg-app-neutral-bg text-app-neutral-text",
    danger: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
    purple: "border-app-purple-border bg-app-purple-bg text-app-purple-text",
    orange: "border-app-orange-border bg-app-orange-bg text-app-orange-text",
};

const badgeSizeClasses: Record<BadgeSize, string> = {
    sm: "px-2 py-0.5",
    md: "px-3 py-1",
};

/**
 * Small status pill. Every colour comes from a token, so both themes are
 * handled without a single `dark:` override at the call site.
 *
 * Colour alone never carries the meaning — the badge always contains text, and
 * for anything a user must act on, an icon too (standards §5).
 *
 * ```tsx
 * <Badge variant="success">Connected</Badge>
 * <Badge variant="neutral" size="sm">+3</Badge>
 * ```
 */
export function Badge({
    children,
    variant = "brand",
    size = "md",
    title,
    className = "",
}: BadgeProps) {
    return (
        <span
            title={title}
            className={`inline-flex items-center rounded-full border text-xs font-semibold leading-none ${badgeSizeClasses[size]} ${badgeVariantClasses[variant]} ${className}`.trim()}
        >
            {children}
        </span>
    );
}
