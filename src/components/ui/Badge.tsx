import type { ReactNode } from "react";

export type BadgeVariant =
    | "success"
    | "brand"
    | "warning"
    | "neutral"
    | "danger"
    | "purple"
    | "orange";

export type BadgeProps = {
    children: ReactNode;
    variant?: BadgeVariant;
    className?: string;
};

const badgeVariantClasses: Record<BadgeVariant, string> = {
    success: "border-app-success-border bg-app-success-bg text-app-success-text",
    brand: "border-app-brand-border bg-app-brand-soft text-app-brand-text",
    warning: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
    neutral: "border-app-neutral-border bg-app-neutral-bg text-app-neutral-text",
    danger: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
    purple:
        "border-app-accent bg-app-accent-soft text-app-accent",
    orange:
        "border-app-orange-border bg-app-orange-bg text-app-orange-text",
};

/**
 * Semantic status badge. 7 color variants mapping to semantic roles:
 * success, brand, warning, neutral, danger (core), plus purple and orange
 * (used by StatusChip for onboarding states).
 */
export function Badge({ children, variant = "brand", className = "" }: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold leading-none ${badgeVariantClasses[variant]} ${className}`.trim()}
        >
            {children}
        </span>
    );
}
