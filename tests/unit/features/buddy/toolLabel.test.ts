import { describe, it, expect } from "vitest";
import { toolLabel } from "../../../../src/features/buddy/toolLabel";

describe("toolLabel", () => {
  it('maps each known backend tool to a "what it is doing" label', () => {
    expect(toolLabel("get_my_metrics")).toBe("Checking your progress…");
    expect(toolLabel("get_my_competencies")).toBe("Looking at where you stand…");
    expect(toolLabel("get_suggested_tasks")).toBe("Finding good tasks for you…");
  });

  it("falls back to a generic label for an unknown tool", () => {
    expect(toolLabel("some_new_tool")).toBe("Looking that up…");
  });
});
