import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  readTaskPoolShown,
  writeTaskPoolShown,
} from "../../../../src/features/board/layout/taskPoolShown";

describe("whether the task pool card is on the board", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("round-trips the switch", () => {
    writeTaskPoolShown("b1", false);
    expect(readTaskPoolShown("b1")).toBe(false);

    writeTaskPoolShown("b1", true);
    expect(readTaskPoolShown("b1")).toBe(true);
  });

  it("keeps each board's answer to itself", () => {
    writeTaskPoolShown("b1", false);

    expect(readTaskPoolShown("b2")).toBe(true);
  });

  it("shows it to anybody who has not decided otherwise", () => {
    // A hire who has never seen the pool cannot have decided against it.
    expect(readTaskPoolShown("b1")).toBe(true);
    expect(readTaskPoolShown("")).toBe(true);
  });

  it("shows it rather than trusting something unreadable", () => {
    // User-writable storage: a hand-edited or foreign entry must not take the pool off a board.
    window.localStorage.setItem("sprintstart:board-task-pool-shown:b1", "{oh no");
    window.localStorage.setItem(
      "sprintstart:board-task-pool-shown:b2",
      JSON.stringify({ version: 99, shown: false }),
    );

    expect(readTaskPoolShown("b1")).toBe(true);
    expect(readTaskPoolShown("b2")).toBe(true);
  });

  it("survives a storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => writeTaskPoolShown("b1", false)).not.toThrow();
    expect(readTaskPoolShown("b1")).toBe(true);
  });
});
