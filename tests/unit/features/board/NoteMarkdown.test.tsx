import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoteMarkdown } from "../../../../src/features/board/components/NoteMarkdown";
import {
  looksLikeMarkdown,
  plainHeading,
} from "../../../../src/features/board/layout/noteMarkdown";

describe("a note the buddy wrote in Markdown", () => {
  it("is told apart from a plain note", () => {
    expect(looksLikeMarkdown("## Recap\n- one\n- two")).toBe(true);
    expect(looksLikeMarkdown("Keep the **runbook** open")).toBe(true);
    expect(looksLikeMarkdown("Just a thought.\nFrom Requirements")).toBe(false);
  });

  it("is drawn formatted, with its highlights and line breaks kept", () => {
    const { container } = render(
      <NoteMarkdown
        text={"## Recap\n- read the ==runbook==\n- **ask** Sam\n\nFirst line\nFrom Setup"}
        marks={[]}
        cardId="n1"
      />,
    );

    expect(screen.getByRole("heading", { name: "Recap" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector("strong")?.textContent).toBe("ask");
    expect(container.querySelector("mark")?.textContent).toBe("runbook");
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent).not.toContain("==");
  });
});

describe("a Markdown first line as a note's title", () => {
  it("loses the syntax and keeps the words", () => {
    expect(plainHeading("## Recap of **Setup**")).toBe("Recap of Setup");
    expect(plainHeading("Read `README` and [the guide](/kb)")).toBe("Read README and the guide");
    expect(plainHeading("Keep ==this== marked")).toBe("Keep ==this== marked");
  });
});
