import { useMemo, useState } from "react";
import { BookText, ChevronDown } from "lucide-react";
import type { Citation } from "../types";

type MessageCitationsProps = {
    citations: Citation[];
};

type CitationGroup = {
    filename: string;
    count: number;
    sections: string[];
};

/**
 * Groups the raw per-chunk citations returned by the assistant into one entry
 * per source file. The backend streams a citation for every retrieved chunk, so
 * a single file can appear many times — grouping keeps the block compact.
 *
 * The whole block is collapsed by default (just a "Quellen · N" line) so it
 * never dominates the message. Expanding reveals compact per-file chips; a chip
 * can be selected to list the individual section paths it cites.
 */
export function MessageCitations({ citations }: MessageCitationsProps) {
    const [open, setOpen] = useState(false);
    const [activeFile, setActiveFile] = useState<string | null>(null);

    const groups = useMemo<CitationGroup[]>(() => {
        const map = new Map<string, CitationGroup>();

        for (const citation of citations) {
            const existing = map.get(citation.filename);
            const section = citation.section_path?.trim();

            if (existing) {
                existing.count += 1;
                if (section && !existing.sections.includes(section)) {
                    existing.sections.push(section);
                }
            } else {
                map.set(citation.filename, {
                    filename: citation.filename,
                    count: 1,
                    sections: section ? [section] : []
                });
            }
        }

        return [...map.values()];
    }, [citations]);

    const activeGroup = groups.find((g) => g.filename === activeFile) ?? null;

    if (groups.length === 0) return null;

    return (
        <div className="mt-2.5 border-t border-app-border-muted pt-2">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1.5 text-app-text-subtle transition-colors hover:text-app-text-muted"
            >
                <BookText size={12} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Quellen · {groups.length}
                </span>
                <ChevronDown
                    size={12}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {groups.map((group) => {
                            const isActive = group.filename === activeFile;
                            const canExpand = group.sections.length > 0;

                            return (
                                <button
                                    key={group.filename}
                                    type="button"
                                    onClick={() =>
                                        canExpand &&
                                        setActiveFile(isActive ? null : group.filename)
                                    }
                                    className={`flex max-w-[220px] items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors ${
                                        isActive
                                            ? "border-app-brand-border bg-app-brand-soft text-app-brand-text"
                                            : "border-app-border-muted bg-app-bg-soft text-app-text-muted hover:bg-app-surface-hover"
                                    } ${canExpand ? "cursor-pointer" : "cursor-default"}`}
                                >
                                    <span className="truncate">{group.filename}</span>
                                    {group.count > 1 && (
                                        <span className="shrink-0 tabular-nums opacity-70">
                                            ·{group.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {activeGroup && activeGroup.sections.length > 0 && (
                        <ul className="mt-1.5 rounded-md border border-app-border-muted bg-app-bg-soft px-2 py-1.5">
                            {activeGroup.sections.map((section, idx) => (
                                <li
                                    key={idx}
                                    className="flex gap-1.5 py-0.5 text-[11px] leading-relaxed text-app-text-muted"
                                >
                                    <span className="text-app-text-disabled">·</span>
                                    <span className="min-w-0 break-words">{section}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </div>
    );
}
