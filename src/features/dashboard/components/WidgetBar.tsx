export type WidgetBarSegment = {
  label: string;
  value: number;
  /** Tailwind background utility from the shared palette — never a raw colour. */
  className: string;
};

/**
 * A part-to-whole bar with its own legend.
 *
 * The visual half of the overview widgets: three or four counts that add up to a total read
 * far faster as proportions than as a column of numbers, and a card that is half a row wide
 * has the room for it. Every segment is named and counted in the legend beneath, so nothing
 * here depends on telling the colours apart.
 *
 * Segments with a count of zero are dropped rather than drawn as slivers — a half-pixel
 * stripe is noise, and the legend would claim a colour the eye cannot find.
 */
export function WidgetBar({ segments }: { segments: WidgetBarSegment[] }) {
  const visible = segments.filter((segment) => segment.value > 0);
  const total = visible.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) return null;

  return (
    <div>
      <div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full">
        {visible.map((segment) => (
          <div
            key={segment.label}
            className={`rounded-full ${segment.className}`}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {visible.map((segment) => (
          <li key={segment.label} className="flex items-center gap-1.5 text-xs text-app-text-muted">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-full ${segment.className}`}
            />
            {segment.value} {segment.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
