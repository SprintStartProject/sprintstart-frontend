import { memo, useMemo, type ReactNode } from "react";
import ReactMarkdown, { type Options as ReactMarkdownOptions } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { linkifyCitations } from "../markdown/linkifyCitations";
import type { Citation } from "../types";
import type { SelectedCitation } from "../../../context/ChatContext";

// Hoisted to module scope so the plugin arrays have a stable identity across
// renders — ReactMarkdown would otherwise see a new array each render and
// re-walk the markdown AST every time (A4).
const REMARK_PLUGINS = [remarkGfm, remarkMath];
const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [[rehypeKatex, { strict: "ignore", errorColor: "inherit" }]];

type MessageMarkdownProps = {
    /** Raw markdown content (citation markers like `[1]` are not yet linkified). */
    content: string;
    /** Whether this is a user (right-aligned, branded) or assistant message. */
    isRequest: boolean;
    /** Citations attached to the message; drives `[N]` linkification + popovers. */
    citations: Citation[];
    /** Called when the user clicks a `[N]` citation reference. */
    onCitationClick: (citation: SelectedCitation) => void;
};

/**
 * Renders a single chat message's markdown (GFM + math + KaTeX) with citation
 * markers turned into interactive `[N]` superscripts.
 *
 * Memoized so that unchanged messages don't re-render when a sibling message
 * receives a streamed token — only the message whose `content`/`citations`
 * actually changed re-renders (A1/A2). The `linkifyCitations` call and the
 * per-role `components` config are memoized on the props that affect them.
 */
function MessageMarkdownImpl({
    content,
    isRequest,
    citations,
    onCitationClick,
}: MessageMarkdownProps) {
    // A2: linkify once per (content, citation count) pair instead of every render.
    const mdContent = useMemo(
        () => (isRequest ? content : linkifyCitations(content, citations.length)),
        [content, citations.length, isRequest],
    );

    // A4: the components map closes over `isRequest`/`citations`/`onCitationClick`,
    // so it can't be fully module-scope — but memoizing on those deps keeps the
    // identity stable across renders that don't change them.
    const components = useMemo(
        () => ({
            a({ href, children }: { href?: string; children?: ReactNode }) {
                const match = href ? /^#cite-(\d+)$/.exec(href) : null;

                if (match) {
                    const n = Number(match[1]);
                    const citation = citations[n - 1];
                    return (
                        <sup>
                            <button
                                type="button"
                                className="citation-ref"
                                title={citation ? citation.filename : `Quelle ${n}`}
                                onClick={(e) => {
                                    if (citation) {
                                        onCitationClick({
                                            citation,
                                            rect: e.currentTarget.getBoundingClientRect(),
                                        });
                                    }
                                }}
                            >
                                {n}
                            </button>
                        </sup>
                    );
                }

                return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                        {children}
                    </a>
                );
            },
            table: ({ children }: { children?: ReactNode }) => (
                <div className="overflow-x-auto">
                    <table
                        className={`w-full border-collapse border-2 my-3 ${
                            isRequest ? "border-app-brand-border" : "border-app-border-muted"
                        }`}
                    >
                        {children}
                    </table>
                </div>
            ),
            th: ({ children }: { children?: ReactNode }) => (
                <th
                    className={`border-2 px-3 py-2 text-left ${
                        isRequest
                            ? "border-app-brand-border bg-app-brand-soft"
                            : "border-app-border-muted bg-app-surface"
                    }`}
                >
                    {children}
                </th>
            ),
            td: ({ children }: { children?: ReactNode }) => (
                <td
                    className={`border-2 px-3 py-2 ${
                        isRequest ? "border-app-brand-border" : "border-app-border-muted"
                    }`}
                >
                    {children}
                </td>
            ),
            code({
                children,
                className,
            }: {
                children?: ReactNode;
                className?: string;
            }) {
                const isBlock = className?.startsWith("language-");

                if (!isBlock) {
                    return (
                        <code
                            className={`px-1 py-0.5 mx-0.5 rounded border ${
                                isRequest
                                    ? "bg-app-brand-soft border-app-brand-border"
                                    : "bg-app-surface border-app-border-muted"
                            }`}
                        >
                            {children}
                        </code>
                    );
                }

                return <code className={className}>{children}</code>;
            },
            pre(props: { children?: ReactNode }) {
                return (
                    <pre
                        className={`
                            p-3
                            my-3
                            rounded-xl
                            overflow-x-auto
                            border
                            ${
                                isRequest
                                    ? "bg-app-brand-soft border-app-brand-border"
                                    : "bg-app-surface border-app-border-muted"
                            }
                        `}
                    >
                        {props.children}
                    </pre>
                );
            },
        }),
        [isRequest, citations, onCitationClick],
    );

    return (
        <ReactMarkdown
            remarkPlugins={REMARK_PLUGINS}
            rehypePlugins={REHYPE_PLUGINS}
            components={components}
        >
            {mdContent}
        </ReactMarkdown>
    );
}

export const MessageMarkdown = memo(MessageMarkdownImpl);
