import { afterEach, describe, expect, it } from "vitest";

import {
  hasNewlyBehind,
  readBehindSeen,
  writeBehindSeen,
} from "../../../../src/features/board/layout/behindSeen";

afterEach(() => window.localStorage.clear());

describe("what was behind the hire last time", () => {
  it("is nothing known on a board never looked at, which opens nothing", () => {
    expect(readBehindSeen("b1")).toBeNull();
    expect(hasNewlyBehind(readBehindSeen("b1"), ["a"])).toBe(false);
  });

  it("opens the band only for cards that are new there", () => {
    writeBehindSeen("b1", ["a", "b"]);

    expect(hasNewlyBehind(readBehindSeen("b1"), ["a", "b"])).toBe(false);
    expect(hasNewlyBehind(readBehindSeen("b1"), ["a"])).toBe(false);
    expect(hasNewlyBehind(readBehindSeen("b1"), ["a", "c"])).toBe(true);
  });
});
