import { describe, expect, it } from "vitest";
import { toneLabel } from "../../../../src/features/graph-diagram/edgeTone";

describe("toneLabel", () => {
  it("names each edge style the way the legend reads", () => {
    expect(toneLabel("done")).toBe("done");
    expect(toneLabel("active")).toBe("ready now");
    expect(toneLabel("waiting")).toBe("waiting");
    expect(toneLabel("upstream")).toBe("comes first");
    expect(toneLabel("rule")).toBe("locks");
  });
});
