import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { CardMark } from "../marks/cardMarks";
import { remarkNoteText } from "../layout/noteMarkdown";
import { Marked } from "./Marked";

type NoteMarkdownProps = { text: string; marks: CardMark[]; cardId: string };

/**
 * A note drawn as Markdown, with its highlights still highlights.
 *
 * Styled like the buddy's replies (`BuddyMarkdown`), scaled to a card: nothing in here may widen it.
 */
export function NoteMarkdown({ text, marks, cardId }: NoteMarkdownProps) {
  return (
    <div className="min-w-0 space-y-2 text-sm break-words text-app-text [&_a]:break-words [&_a]:text-app-brand-text [&_a]:underline [&_code]:rounded [&_code]:bg-app-surface-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:break-words [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:max-w-full [&_pre]:min-w-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface-muted [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkNoteText]}
        components={{
          // Drawn from the hast node rather than from `children`: what is inside a highlight is
          // always one run of text (see `remarkNoteText`), and `Marked` wants it as a string.
          mark: ({ node }) => (
            <Marked text={`==${textOf(node)}==`} marks={marks} parse cardId={cardId} />
          ),
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** The text inside a hast element, which for a highlight is a single text node. */
function textOf(node: { children?: unknown[] } | undefined): string {
  return (node?.children ?? [])
    .map((child) =>
      typeof child === "object" && child !== null && "value" in child ? String(child.value) : "",
    )
    .join("");
}
