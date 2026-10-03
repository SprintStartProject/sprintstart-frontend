import type { ComponentType } from "react";

/** The props every icon in the app is drawn with, lucide or hand-made. */
export type IconProps = {
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
  size?: number | string;
  strokeWidth?: number | string;
};

/**
 * An icon component. Wider than `LucideIcon` so a brand logo that lucide does
 * not ship (Bitbucket) can be used wherever a lucide icon is; every lucide icon
 * still satisfies it.
 */
export type IconComponent = ComponentType<IconProps>;
