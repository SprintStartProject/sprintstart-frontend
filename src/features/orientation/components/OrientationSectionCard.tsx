import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";
import { SourceLinks } from "./SourceLinks";
import { STEP_LABELS } from "../steps";
import type { OrientationSection } from "../types";

type OrientationSectionCardProps = {
  section: OrientationSection;
  isOpen: boolean;
  onToggle: () => void;
};

/**
 * One step of the packet, collapsible, with its sources shown under it.
 *
 * Collapsed by default once a hire has been here before (see `useOpenSteps`) —
 * the value of step segmentation is precisely that you can skip the parts you
 * have done. Correcting a section is a packet-level action (the whole packet is
 * replaced on save), so the "fix this" affordance lives on the panel, not here.
 */
export function OrientationSectionCard({ section, isOpen, onToggle }: OrientationSectionCardProps) {
  const label = STEP_LABELS[section.step] ?? section.step;

  return (
    <li className="overflow-hidden rounded-xl border border-app-border bg-app-bg">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-app-surface-muted focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        <span>
          <span className="block text-[11px] font-semibold tracking-wide text-app-text-subtle uppercase">
            {label}
          </span>
          <span className="block text-sm font-medium text-app-text">{section.title}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="border-t border-app-border px-4 py-3">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.body}</ReactMarkdown>
          </div>

          <SourceLinks label="Where this came from" items={section.citations} />
        </div>
      )}
    </li>
  );
}
