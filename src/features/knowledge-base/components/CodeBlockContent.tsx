import type { ReactNode } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

export function CodeBlockContent({
  language,
  children,
}: {
  language: string;
  children?: ReactNode;
}) {
  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      showLineNumbers={false}
      wrapLines={true}
      customStyle={{ margin: 0, padding: "1rem", backgroundColor: "var(--color-app-bg)" }}
    >
      {/* react-markdown passes a code block's text as its children, never an object. */}
      {/* eslint-disable-next-line @typescript-eslint/no-base-to-string */}
      {String(children).replace(/\n$/, "")}
    </SyntaxHighlighter>
  );
}
