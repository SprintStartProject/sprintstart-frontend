import { describe, expect, it } from "vitest";

import { originUrl, textFragment } from "../../../../src/features/board/selection/textFragment";

describe("the way back to a selection", () => {
  it("names short selections whole", () => {
    expect(textFragment("deploys happen on Thursdays")).toBe(
      "#:~:text=deploys%20happen%20on%20Thursdays",
    );
  });

  it("has nothing to point at when there is no text", () => {
    expect(textFragment("   ")).toBe("");
  });

  it("escapes the characters the fragment syntax uses itself", () => {
    // A comma would otherwise read as the separator between a range's two ends, and a dash as the
    // separator between a prefix and its match.
    const fragment = textFragment("first, second - third & fourth");

    expect(fragment).toContain("%2C");
    expect(fragment).toContain("%2D");
    expect(fragment).toContain("%26");
  });

  it("describes a long selection by its two ends", () => {
    const long =
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen";
    const fragment = textFragment(long);

    // Everything between the ends is allowed to have changed, which is the point of the range form.
    expect(fragment).toBe(
      "#:~:text=one%20two%20three%20four%20five,eleven%20twelve%20thirteen%20fourteen%20fifteen",
    );
  });

  it("falls back to the start when a long selection has no two ends to name", () => {
    const oneWord = "x".repeat(120);

    expect(textFragment(oneWord)).toBe(`#:~:text=${oneWord}`);
  });

  it("stays relative, so a card made on one machine still works on another", () => {
    const url = originUrl({ pathname: "/knowledge-base", search: "?q=deploy" }, "on Thursdays");

    expect(url).toBe("/knowledge-base?q=deploy#:~:text=on%20Thursdays");
  });
});
