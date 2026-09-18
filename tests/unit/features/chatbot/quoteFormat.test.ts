import { describe, it, expect } from "vitest";
import {
  formatMarkdownQuote,
  insertQuoteIntoDraft,
} from "../../../../src/features/chatbot/utils/quoteFormat";

describe("quoteFormat", () => {
  describe("formatMarkdownQuote", () => {
    it("returns an empty string when given empty or whitespace text", () => {
      expect(formatMarkdownQuote("")).toBe("");
      expect(formatMarkdownQuote("   \n   ")).toBe("");
    });

    it("prefixes a single line with `> `", () => {
      expect(formatMarkdownQuote("Hello world")).toBe("> Hello world");
    });

    it("prefixes every line in multi-line text with `> `", () => {
      const input = "First line\nSecond line\nThird line";
      const expected = "> First line\n> Second line\n> Third line";
      expect(formatMarkdownQuote(input)).toBe(expected);
    });

    it("preserves lines that already have blockquote syntax", () => {
      const input = "> Already quoted\nNew line";
      const expected = "> Already quoted\n> New line";
      expect(formatMarkdownQuote(input)).toBe(expected);
    });
  });

  describe("insertQuoteIntoDraft", () => {
    it("returns formatted quote followed by double newlines when draft is empty", () => {
      const result = insertQuoteIntoDraft("", "Quoted message");
      expect(result).toBe("> Quoted message\n\n");
    });

    it("prepends the quote at the top when draft already contains text", () => {
      const currentDraft = "What does this mean?";
      const result = insertQuoteIntoDraft(currentDraft, "AI explanation here");
      expect(result).toBe("> AI explanation here\n\nWhat does this mean?");
    });

    it("handles multi-line quotes prepended to existing draft", () => {
      const currentDraft = "My question.";
      const quote = "Line 1\nLine 2";
      const result = insertQuoteIntoDraft(currentDraft, quote);
      expect(result).toBe("> Line 1\n> Line 2\n\nMy question.");
    });

    it("returns current draft untouched if quote text is empty", () => {
      expect(insertQuoteIntoDraft("Draft text", "")).toBe("Draft text");
      expect(insertQuoteIntoDraft("Draft text", "   ")).toBe("Draft text");
    });
  });
});
