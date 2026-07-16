import { useMemo, useState } from "react";
import { BookText, ChevronDown, ExternalLink } from "lucide-react";
import type { Citation } from "../types";

type MessageCitationsProps = {
    citations: Citation[];
};

type CitationGroup = {
    filename: string;
    count: number;
    sourceUrl?: string;
    locations: string[];
};

/**
 * Groups consecutive line/page numbers into readable ranges (e.g., "Line 1-5").
 */
function formatRanges(prefix: string, numbers: number[]): string[] {
    if (numbers.length === 0) return [];
    
    // remove duplicates and sort
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = start;

    for (let i = 1; i <= sorted.length; i++) {
        const curr = sorted[i];
        if (curr === prev + 1) {
            prev = curr;
        } else {
            if (start === prev) {
                ranges.push(`${prefix} ${start}`);
            } else {
                ranges.push(`${prefix} ${start}-${prev}`);
            }
            start = curr;
            prev = curr;
        }
    }
    return ranges;
}

/**
 * Groups the raw per-chunk citations returned by the assistant into one entry
 * per source file. The backend streams a citation for every retrieved chunk, so
 * a single file can appear many times — grouping keeps the block compact.
 *
 * The whole block is collapsed by default (just a "Sources · N" line) so it
 * never dominates the message. Expanding reveals compact per-file chips; a chip
 * can be selected to list the individual locations (lines/pages) it cites, and
 * files that carry a sourceUrl link out to the original artifact.
 */
export function MessageCitations({ citations }: MessageCitationsProps) {
    const [open, setOpen] = useState(false);
    const [activeFile, setActiveFile] = useState<string | null>(null);

    const groups = useMemo<CitationGroup[]>(() => {
        const map = new Map<string, {
            filename: string;
            count: number;
            sourceUrl?: string;
            lines: Set<number>;
            pages: Set<number>;
        }>();

        for (const citation of citations) {
            const existing = map.get(citation.filename);

            if (existing) {
                existing.count += 1;
                existing.sourceUrl ??= citation.sourceUrl;
                if (citation.startLine !== undefined) existing.lines.add(citation.startLine);
                if (citation.startPage !== undefined) existing.pages.add(citation.startPage);
            } else {
                const group = {
                    filename: citation.filename,
                    count: 1,
                    sourceUrl: citation.sourceUrl,
                    lines: new Set<number>(),
                    pages: new Set<number>()
                };
                if (citation.startLine !== undefined) group.lines.add(citation.startLine);
                if (citation.startPage !== undefined) group.pages.add(citation.startPage);
                map.set(citation.filename, group);
            }
        }

        return [...map.values()].map(group => ({
            filename: group.filename,
            count: group.count,
            sourceUrl: group.sourceUrl,
            locations: [
                ...formatRanges("Line", Array.from(group.lines)),
                ...formatRanges("Page", Array.from(group.pages))
            ]
        }));
    }, [citations]);

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
                    Sources · {groups.length}
                </span>
                <ChevronDown
                    size={12}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            {open && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                    {groups.map((group) => {
                        const isActive = group.filename === activeFile;
                        const canExpand = group.locations.length > 0;

                        return (
                            <div key={group.filename} className="relative">
                                <button
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
                                        <span className="shrink-0 font-mono opacity-70">
                                            ·{group.count}
                                        </span>
                                    )}
                                </button>

                                {isActive && (
                                    <div className="absolute left-0 top-full z-10 mt-1 w-max min-w-[150px] max-w-[300px] rounded-md border border-app-border-muted bg-app-bg-soft px-2 py-1.5 shadow-md">
                                        {group.sourceUrl && (
                                            <a
                                                href={group.sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-app-brand-text hover:underline"
                                            >
                                                Open source
                                                <ExternalLink size={10} />
                                            </a>
                                        )}
                                        <div className="flex max-h-48 flex-wrap gap-x-2 gap-y-0.5 overflow-y-auto">
                                            {group.locations.map((location, idx) => (
                                                <span
                                                    key={idx}
                                                    className="font-mono text-[11px] leading-relaxed text-app-text-muted"
                                                >
                                                    {location}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
