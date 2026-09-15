import { beforeEach, describe, expect, it } from "vitest";

import {
  colorOf,
  enclosingCardMark,
  marksOf,
  readCardMarks,
  removeCardMark,
  setCardMark,
  writeCardMarks,
} from "../../../../src/features/board/marks/cardMarks";

describe("the colour of a highlight, and the marks kept beside a card", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips a card's marks", () => {
    writeCardMarks("p1", { c1: [{ text: "on Thursdays", color: "green" }] });

    expect(readCardMarks("p1").c1).toEqual([{ text: "on Thursdays", color: "green" }]);
  });

  it("repaints rather than marking the same words twice", () => {
    const yellow = setCardMark({}, "c1", "on Thursdays", "yellow");
    const green = setCardMark(yellow, "c1", "on Thursdays", "green");

    expect(marksOf(green, "c1")).toEqual([{ text: "on Thursdays", color: "green" }]);
  });

  it("takes a mark off, and drops a card left with none", () => {
    const marks = setCardMark({}, "c1", "on Thursdays", "pink");

    expect("c1" in removeCardMark(marks, "c1", "on Thursdays")).toBe(false);
  });

  it("ignores a blank selection, which would match everywhere", () => {
    expect(setCardMark({}, "c1", "   ", "yellow")).toEqual({});
  });

  it("reports the colour of some words, and nothing for words nobody marked", () => {
    const marks = marksOf(setCardMark({}, "c1", "on Thursdays", "blue"), "c1");

    expect(colorOf(marks, "on Thursdays")).toBe("blue");
    expect(colorOf(marks, "on Fridays")).toBeNull();
  });

  it("keeps projects apart", () => {
    writeCardMarks("p1", { c1: [{ text: "a", color: "yellow" }] });

    expect(readCardMarks("p2")).toEqual({});
  });

  it("reads marks written before highlights had a colour as yellow", () => {
    // Version 1 stored bare strings. Bumping the version would have thrown those marks away in
    // order to add a property nobody asked about.
    window.localStorage.setItem(
      "sprintstart:board-card-marks:p3",
      JSON.stringify({ version: 1, marks: { c1: ["on Thursdays"] } }),
    );

    expect(readCardMarks("p3").c1).toEqual([{ text: "on Thursdays", color: "yellow" }]);
  });

  it("reads rubbish in storage as nothing rather than falling over", () => {
    window.localStorage.setItem("sprintstart:board-card-marks:p4", "{not json");
    expect(readCardMarks("p4")).toEqual({});

    window.localStorage.setItem(
      "sprintstart:board-card-marks:p5",
      JSON.stringify({
        version: 2,
        marks: { c1: [{ text: "  " }, 7], c2: [{ text: "real", color: "chartreuse" }] },
      }),
    );

    // A blank mark says nothing and is dropped; an unknown colour falls back rather than losing
    // the mark that carries it.
    expect(readCardMarks("p5")).toEqual({ c2: [{ text: "real", color: "yellow" }] });
  });
});

describe("rubbing out part of a mark kept beside a card", () => {
  it("splits one highlight into two, keeping the colour", () => {
    const marks = setCardMark({}, "c1", "deploys are on Thursdays", "blue");

    expect(marksOf(removeCardMark(marks, "c1", "are on"), "c1")).toEqual([
      { text: "deploys", color: "blue" },
      { text: "Thursdays", color: "blue" },
    ]);
  });

  it("drops the card when nothing is left either side", () => {
    const marks = setCardMark({}, "c1", "deploys", "blue");

    expect("c1" in removeCardMark(marks, "c1", "deploys")).toBe(false);
  });

  it("finds the mark a selection sits inside", () => {
    const marks = marksOf(setCardMark({}, "c1", "deploys are on Thursdays", "pink"), "c1");

    expect(enclosingCardMark(marks, "on Thursdays")?.color).toBe("pink");
    expect(enclosingCardMark(marks, "on Fridays")).toBeNull();
  });
});
