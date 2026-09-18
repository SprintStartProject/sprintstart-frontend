import { describe, it, expect, beforeEach } from "vitest";
import {
  readPathWindowOpen,
  readPathWindowShown,
  writePathWindowOpen,
  writePathWindowShown,
} from "../../../../src/features/board/layout/pathWindowFold";

describe("the fold on the strip that says where a hire stands", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips the fold and whether the strip is there at all", () => {
    writePathWindowOpen("b1", false);
    writePathWindowShown("b1", false);

    expect(readPathWindowOpen("b1")).toBe(false);
    expect(readPathWindowShown("b1")).toBe(false);
  });

  it("keeps the two apart, so folding is not removing", () => {
    // Different owners: the strip folds itself, and the board decides whether it exists. One
    // record would have them writing over each other's half.
    writePathWindowOpen("b1", false);

    expect(readPathWindowShown("b1")).toBe(true);
  });

  it("keeps each board's answer to itself", () => {
    writePathWindowShown("b1", false);

    expect(readPathWindowShown("b2")).toBe(true);
  });

  it("shows it to anybody who has not decided otherwise", () => {
    // A hire who has never seen the strip cannot have decided against it.
    expect(readPathWindowOpen("b1")).toBe(true);
    expect(readPathWindowShown("b1")).toBe(true);
    expect(readPathWindowShown("")).toBe(true);
  });

  it("shows it rather than trusting something unreadable", () => {
    // User-writable storage: a hand-edited or half-written entry must not be able to take a strip
    // off somebody's board.
    window.localStorage.setItem("sprintstart:board-path-shown:b1", "{oh no");
    window.localStorage.setItem(
      "sprintstart:board-path-window:b1",
      JSON.stringify({ version: 99, open: false }),
    );

    expect(readPathWindowShown("b1")).toBe(true);
    expect(readPathWindowOpen("b1")).toBe(true);
  });
});
