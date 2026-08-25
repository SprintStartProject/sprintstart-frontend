import { ExternalLink, FileText } from "lucide-react";
import type { OrientationCitation, OrientationSource } from "../types";

type SourceLinksProps = {
  label: string;
  items: (OrientationCitation | OrientationSource)[];
};

/**
 * The material a claim or a packet came from, rendered as visible, openable links.
 *
 * Deliberately not a tooltip or a hover affordance: provenance is what makes
 * assembled orientation trustworthy in a way generated prose is not, and a hire
 * who has to discover it will not. Sources with no URL are still named — knowing
 * *which* document said something is useful even when it cannot be opened.
 */
export function SourceLinks({ label, items }: SourceLinksProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 border-t border-app-border pt-2">
      <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
        {label}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
        {items.map((item, index) => (
          <li key={`${item.filename}-${index}`}>
            {item.sourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-app-brand-text hover:underline focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
              >
                <FileText className="h-3 w-3" aria-hidden="true" />
                {item.filename}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-app-text-muted">
                <FileText className="h-3 w-3" aria-hidden="true" />
                {item.filename}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
