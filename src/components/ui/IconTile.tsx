import type { ReactNode } from "react";
import type { IconComponent } from "../icons/types.ts";

/**
 * The colour an icon tile is recognised by.
 *
 * - `accent` — the brand gradient with a white icon. The tile every card header
 *   and dashboard widget carries.
 * - `brand` — the soft brand tint. Used for a selected or highlighted tile.
 * - `cyan` / `indigo` / `pink` / `purple` — the PM section colours.
 * - `success` / `warning` / `danger` — the app's ordinary status ladder.
 * - `neutral` — no judgement attached. The default.
 * - `muted` — a tile that sits on a card already tinted `neutral`.
 */
export type IconTileTone =
  | "accent"
  | "brand"
  | "cyan"
  | "indigo"
  | "pink"
  | "purple"
  | "warning"
  | "success"
  | "danger"
  | "neutral"
  | "muted";

/** `sm` for card headers up to `2xl` for drawer headers. */
export type IconTileSize = "sm" | "md" | "lg" | "xl" | "2xl";

export type IconTileProps = {
  /** Drawn at the size that belongs to `size`. Lucide icons and brand logos both fit. */
  icon?: IconComponent;
  tone?: IconTileTone;
  size?: IconTileSize;
  className?: string;
  /**
   * Rendered after the icon: an attention dot, or an icon that needs its own
   * responsive size instead of the one `size` gives it.
   */
  children?: ReactNode;
};

const iconTileToneClasses: Record<IconTileTone, string> = {
  accent: "bg-gradient-to-br from-app-progress-fill to-app-progress-fill-end text-white shadow-sm",
  brand: "bg-app-brand-soft text-app-brand-text",
  cyan: "bg-app-cyan-bg text-app-cyan-text",
  indigo: "bg-app-indigo-bg text-app-indigo-text",
  pink: "bg-app-pink-bg text-app-pink-text",
  purple: "bg-app-purple-bg text-app-purple-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  success: "bg-app-success-bg text-app-success-text",
  danger: "bg-app-danger-bg text-app-danger-text",
  neutral: "bg-app-neutral-bg text-app-neutral-text",
  muted: "bg-app-surface-muted text-app-text-muted",
};

const iconTileSizeClasses: Record<IconTileSize, string> = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-8 w-8 rounded-lg",
  lg: "h-9 w-9 rounded-xl",
  xl: "h-11 w-11 rounded-xl",
  "2xl": "h-14 w-14 rounded-2xl",
};

const iconTileIconClasses: Record<IconTileSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4",
  xl: "h-5 w-5",
  "2xl": "h-6 w-6",
};

/**
 * The square that holds an icon: card headers, list rows, source cards, drawer
 * heads. Every colour comes from a token, so both themes are handled without a
 * `dark:` override at the call site.
 *
 * The tile is decorative. Whatever it stands for has to be said in text next to
 * it, which is why the span is `aria-hidden`.
 *
 * ```tsx
 * <IconTile icon={Users} size="sm" tone="accent" />
 * <IconTile icon={GithubIcon} size="xl" tone={isSelected ? "brand" : "neutral"} />
 * ```
 */
export function IconTile({
  icon: Icon,
  tone = "neutral",
  size = "lg",
  className = "",
  children,
}: IconTileProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${iconTileSizeClasses[size]} ${iconTileToneClasses[tone]} ${className}`.trim()}
    >
      {Icon ? <Icon className={iconTileIconClasses[size]} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
