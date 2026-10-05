import type { IconProps } from "./types.ts";

/**
 * The Bitbucket logo as an inline SVG. lucide has no Bitbucket icon, so this
 * takes the same props as one and fills with `currentColor`, which lets it sit
 * next to the other source icons. The logo is a filled shape, so `strokeWidth`
 * is accepted and ignored.
 */
export function BitbucketIcon({ className, "aria-hidden": ariaHidden, size }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <path d="M.778 1.213a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
    </svg>
  );
}
