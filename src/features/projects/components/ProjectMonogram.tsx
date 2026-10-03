import { monogramLetters, monogramTint } from "../projectMonogram";

export type ProjectMonogramSize = "sm" | "md" | "lg";

type ProjectMonogramProps = {
  /** Picks the tint, so a project keeps its colour wherever it is shown. */
  projectId: string;
  name: string;
  size?: ProjectMonogramSize;
  className?: string;
};

const SIZE_CLASSES: Record<ProjectMonogramSize, string> = {
  sm: "h-9 w-9 rounded-[10px] text-xs",
  md: "h-10 w-10 rounded-xl text-sm",
  lg: "h-16 w-16 rounded-2xl text-xl",
};

/**
 * A project's initials on a tint derived from its id.
 *
 * The one place the tile is drawn, so the sidebar switcher, the switcher modal
 * and the admin views cannot drift into slightly different tiles for the same
 * project. Decorative: the project's name is always printed next to it, so it is
 * hidden from assistive technology.
 */
export function ProjectMonogram({
  projectId,
  name,
  size = "md",
  className = "",
}: ProjectMonogramProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center font-semibold ${SIZE_CLASSES[size]} ${monogramTint(projectId)} ${className}`.trim()}
    >
      {monogramLetters(name)}
    </span>
  );
}
