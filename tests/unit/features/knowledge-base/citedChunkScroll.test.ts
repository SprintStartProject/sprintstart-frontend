import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findCitedElement,
  scrollToCitedLines,
} from "../../../../src/features/knowledge-base/citedChunkScroll";

function containerWith(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

describe("findCitedElement", () => {
  it("prefers the element anchored at the cited line", () => {
    const container = containerWith(
      "<p id='other' data-highlighted='true' data-line-start='1' data-line-end='9'></p>" +
        "<p id='line-4'></p>",
    );

    expect(findCitedElement(container, 4)?.id).toBe("line-4");
  });

  it("falls back to an element already marked as holding a cited line", () => {
    const container = containerWith(
      "<p id='covering' data-line-start='1' data-line-end='9'></p>" +
        "<p id='marked' data-highlighted='true'></p>",
    );

    expect(findCitedElement(container, 4)?.id).toBe("marked");
  });

  it("only takes an element for marked when its attribute is exactly true", () => {
    const container = containerWith("<p id='not-marked' data-highlighted='false'></p>");

    expect(findCitedElement(container, 4)).toBeNull();
  });

  it("falls back to the first element whose line span covers the line", () => {
    const container = containerWith(
      "<p id='before' data-line-start='1' data-line-end='3'></p>" +
        "<p id='covering' data-line-start='3' data-line-end='6'></p>" +
        "<p id='also' data-line-start='4' data-line-end='8'></p>",
    );

    expect(findCitedElement(container, 4)?.id).toBe("covering");
  });

  it("includes both ends of a span", () => {
    const container = containerWith("<p id='span' data-line-start='3' data-line-end='6'></p>");

    expect(findCitedElement(container, 3)?.id).toBe("span");
    expect(findCitedElement(container, 6)?.id).toBe("span");
    expect(findCitedElement(container, 2)).toBeNull();
    expect(findCitedElement(container, 7)).toBeNull();
  });

  it("treats an element without an end as a single line", () => {
    const container = containerWith("<p id='single' data-line-start='5'></p>");

    expect(findCitedElement(container, 5)?.id).toBe("single");
    expect(findCitedElement(container, 6)).toBeNull();
  });

  it("is null when nothing shows the line", () => {
    expect(findCitedElement(containerWith("<p>text</p>"), 4)).toBeNull();
  });
});

describe("scrollToCitedLines", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const scrollIntoView = () => vi.mocked(HTMLElement.prototype.scrollIntoView);

  it("scrolls the element of the smallest cited line to the middle, smoothly", () => {
    const container = containerWith("<p id='line-2'></p><p id='line-5'></p>");

    expect(scrollToCitedLines(container, [5, 2, 9])).toBe(true);

    expect(scrollIntoView()).toHaveBeenCalledTimes(1);
    expect(scrollIntoView()).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect((scrollIntoView().mock.contexts[0] as HTMLElement).id).toBe("line-2");
  });

  it("reports false and scrolls nothing when no element shows the line", () => {
    expect(scrollToCitedLines(containerWith("<p>text</p>"), [3])).toBe(false);

    expect(scrollIntoView()).not.toHaveBeenCalled();
  });

  it.each([undefined, []])("does nothing for the cited lines %j", (lines) => {
    expect(scrollToCitedLines(containerWith("<p id='line-1'></p>"), lines)).toBe(false);

    expect(scrollIntoView()).not.toHaveBeenCalled();
  });

  it("does nothing without a container", () => {
    expect(scrollToCitedLines(null, [1])).toBe(false);

    expect(scrollIntoView()).not.toHaveBeenCalled();
  });
});
