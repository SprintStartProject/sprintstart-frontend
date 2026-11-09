const SIZE_CLASSNAMES = {
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-xs",
} as const;

type SourceTypeBadgeProps = {
  /** The source system's display type, e.g. "GitHub", "Jira", "Upload". */
  type: string;
  size?: keyof typeof SIZE_CLASSNAMES;
};

/**
 * The one badge used to label a source's type, wherever a source is shown
 * (list, details drawer, admin project view). Kept as a single component so the
 * type marker cannot drift into a different colour per screen.
 */
export function SourceTypeBadge({ type, size = "md" }: SourceTypeBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-app-brand-soft font-medium text-app-brand-text ${SIZE_CLASSNAMES[size]}`}
    >
      {type}
    </span>
  );
}
