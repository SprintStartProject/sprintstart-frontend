import { describe, expect, it } from "vitest";
import { describeFailedItem } from "../../../../src/features/data-ingestion/failedItems";

describe("describeFailedItem", () => {
  it("names the singular type and reference when the item has a reference", () => {
    expect(
      describeFailedItem({ artifactType: "PULL_REQUEST", reference: "42", reason: "boom" }),
    ).toBe("Pull request: 42");
  });

  it("says the fetch failed when the item has no reference", () => {
    expect(
      describeFailedItem({ artifactType: "PULL_REQUEST", reference: null, reason: "boom" }),
    ).toBe("Pull requests could not be fetched");
    expect(describeFailedItem({ artifactType: "COMMIT", reference: null, reason: "x" })).toBe(
      "Commits could not be fetched",
    );
  });

  it("labels Confluence pages", () => {
    expect(describeFailedItem({ artifactType: "PAGE", reference: "123", reason: "x" })).toBe(
      "Page: 123",
    );
  });

  it("falls back to the lowercased enum for unknown types", () => {
    expect(describeFailedItem({ artifactType: "DESIGN_FILE", reference: "a", reason: "x" })).toBe(
      "Design file: a",
    );
    expect(describeFailedItem({ artifactType: "DESIGN_FILE", reference: null, reason: "x" })).toBe(
      "Design file could not be fetched",
    );
  });
});
