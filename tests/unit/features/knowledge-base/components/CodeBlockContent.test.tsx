import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeBlockContent } from "../../../../../src/features/knowledge-base/components/CodeBlockContent";

describe("CodeBlockContent", () => {
  it("highlights the text in the given language", () => {
    const { container } = render(<CodeBlockContent language="python">print(1)</CodeBlockContent>);

    expect(container.querySelector("code[class*='language-python']")).toBeInTheDocument();
  });

  it("drops the single trailing newline the markdown parser leaves", () => {
    const { container } = render(<CodeBlockContent language="text">{"a\nb\n"}</CodeBlockContent>);

    expect(container.querySelector("code")?.textContent).toBe("a\nb");
  });

  it("keeps blank lines inside the text", () => {
    const { container } = render(
      <CodeBlockContent language="text">{"a\n\nb\n\n"}</CodeBlockContent>,
    );

    expect(container.querySelector("code")?.textContent).toBe("a\n\nb\n");
  });

  it("shows no line numbers", () => {
    const { container } = render(<CodeBlockContent language="text">{"a\nb"}</CodeBlockContent>);

    expect(container.querySelector(".react-syntax-highlighter-line-number")).toBeNull();
  });

  it("wraps every line in its own element", () => {
    const { container } = render(<CodeBlockContent language="text">{"a\nb\nc"}</CodeBlockContent>);

    expect(container.querySelectorAll("code > span")).toHaveLength(3);
  });

  it("sits flush in its frame on the app background", () => {
    const { container } = render(<CodeBlockContent language="text">a</CodeBlockContent>);

    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre.style.margin).toBe("0px");
    expect(pre.style.padding).toBe("1rem");
    expect(pre.style.backgroundColor).toBe("var(--color-app-bg)");
  });

  it("uses the dark theme's text colour", () => {
    const { container } = render(<CodeBlockContent language="text">a</CodeBlockContent>);

    expect(container.querySelector("code")?.style.color).not.toBe("");
  });
});
