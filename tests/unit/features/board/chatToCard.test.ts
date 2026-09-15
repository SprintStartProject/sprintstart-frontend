import { describe, expect, it } from "vitest";

import {
  buddyReplyNote,
  chatLink,
  chatMessageNote,
  plainFromMarkdown,
  transcriptNote,
} from "../../../../src/features/board/generation/chatToCard";

function noteText(request: ReturnType<typeof chatMessageNote>): string {
  if (request.kind !== "NOTE") throw new Error("expected a note");
  return request.text;
}

describe("keeping something out of a conversation", () => {
  describe("markdown flattened for a card that renders prose", () => {
    it("takes the markers off and keeps the words", () => {
      expect(plainFromMarkdown("## Deploys\n\nThey are **on Thursdays**.")).toBe(
        "Deploys\n\nThey are on Thursdays.",
      );
    });

    it("keeps a list a list, whatever bullet it was written with", () => {
      expect(plainFromMarkdown("* one\n+ two\n- three")).toBe("- one\n- two\n- three");
    });

    it("keeps a link's address, which is the part that cannot be found again", () => {
      expect(plainFromMarkdown("see [the runbook](https://example.com/rb)")).toBe(
        "see the runbook (https://example.com/rb)",
      );
    });

    it("leaves a code fence exactly as it is", () => {
      const code = "```\nconst x = **not bold**;\n```";

      expect(plainFromMarkdown(code)).toBe(code);
    });
  });

  describe("one answer", () => {
    it("leads with the answer's own first line and says where it came from", () => {
      const [heading, body, attribution] = noteText(
        chatMessageNote("Deploys are on Thursdays.\n\nAsk in #release first."),
      ).split("\n\n");

      expect(heading).toBe("Deploys are on Thursdays.");
      expect(body).toContain("Ask in #release first.");
      expect(attribution).toBe("From the assistant");
    });

    it("does not repeat a one-line answer under itself", () => {
      const parts = noteText(chatMessageNote("Deploys are on Thursdays.")).split("\n\n");

      expect(parts).toEqual(["Deploys are on Thursdays.", "From the assistant"]);
    });

    it("names the buddy when it was the buddy", () => {
      expect(noteText(buddyReplyNote("Start with the runbook."))).toContain("From your buddy");
    });
  });

  describe("a whole chat", () => {
    it("keeps a link to the conversation rather than a copy of it", () => {
      expect(chatLink({ id: "abc", title: "Deploy questions" })).toEqual({
        kind: "LINK",
        url: "/chat/abc",
        label: "Deploy questions",
      });
    });

    it("still keeps a chat whose title has not been written yet", () => {
      const card = chatLink({ id: "abc", title: "   " });

      expect(card).toEqual({ kind: "LINK", url: "/chat/abc", label: "Chat" });
    });
  });

  describe("a whole buddy conversation", () => {
    const turns = [
      { speaker: "You", content: "What should I do first?" },
      { speaker: "Buddy", content: "Read **the runbook**." },
      { speaker: "You", content: "And then?" },
    ];

    it("is one card, headed by what the hire asked rather than by what the buddy answered", () => {
      const text = noteText(transcriptNote(turns, "You"));

      expect(text.split("\n\n")[0]).toBe("What should I do first?");
    });

    it("names every speaker and keeps every turn", () => {
      const text = noteText(transcriptNote(turns, "You"));

      expect(text).toContain("You: What should I do first?");
      expect(text).toContain("Buddy: Read the runbook.");
      expect(text).toContain("You: And then?");
      expect(text.endsWith("From your buddy")).toBe(true);
    });

    it("falls back to a name of its own when nobody asked anything", () => {
      const text = noteText(transcriptNote([], "You"));

      expect(text.split("\n\n")[0]).toBe("A conversation with your buddy");
    });
  });
});
