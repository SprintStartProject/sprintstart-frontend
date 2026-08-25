import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders the buddy's reply as Markdown (GitHub-flavoured), so lists, bold, headings, links,
 * code and tables come through instead of raw asterisks and backticks. Shared by both buddy
 * surfaces (the `/buddy` page and the floating widget) so a reply reads the same in either.
 *
 * User messages are never passed here — they contain no Markdown, and echoing one back styled
 * would be surprising; those stay plain, pre-wrapped text at the call site.
 *
 * Nothing in here may widen its container. A model writes whatever it likes into a 384 px
 * panel, so wide content gets its own scroller or wraps; it never makes the conversation scroll
 * sideways. The rule is per block —
 *
 * - `pre` and tables scroll inside themselves: `overflow-x-auto` plus `min-w-0`, without which
 *   a flex ancestor's default `min-width: auto` grows to fit and the scroller never engages;
 * - prose, links and inline code break mid-token, because a URL is one unbreakable word to the
 *   line breaker and no container width fixes that.
 *
 * `break-words` is safe to put on every `code`: inside a `pre` the whitespace is preserved and no
 * wrapping is allowed at all, so it applies to inline code only and code blocks still scroll.
 */
export function BuddyMarkdown({ content }: { content: string }) {
  return (
    <div className="min-w-0 space-y-2 break-words [&_a]:break-words [&_a]:underline [&_code]:rounded [&_code]:bg-app-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:break-words [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:max-w-full [&_pre]:min-w-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-app-surface [&_pre]:p-3 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="max-w-full min-w-0 overflow-x-auto">
              <table className="w-full border-collapse border border-app-border-muted">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-app-border-muted bg-app-surface px-2 py-1 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-app-border-muted px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
