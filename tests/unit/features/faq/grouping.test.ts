import { describe, it, expect } from "vitest";
import { toCategorySections, UNCATEGORIZED_KEY } from "../../../../src/features/faq/grouping";
import type { FAQCategory, FAQGroup, FAQOverview } from "../../../../src/features/faq/types";

function group(overrides: Partial<FAQGroup> & Pick<FAQGroup, "groupId">): FAQGroup {
  return {
    count: 1,
    question: `Question ${overrides.groupId}`,
    topDocuments: [],
    ...overrides,
  };
}

function category(name: string, overrides: Partial<FAQCategory> = {}): FAQCategory {
  return {
    name,
    groupCount: 1,
    questionCount: 1,
    recentQuestionCount: 0,
    trend: "STEADY",
    lastAskedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("toCategorySections", () => {
  it("files each group under its category", () => {
    const overview: FAQOverview = {
      groups: [
        group({ groupId: "g1", category: "Deployment" }),
        group({ groupId: "g2", category: "Concepts" }),
        group({ groupId: "g3", category: "Deployment" }),
      ],
      categories: [category("Deployment"), category("Concepts")],
    };

    const sections = toCategorySections(overview);

    expect(sections.map((s) => s.name)).toEqual(["Deployment", "Concepts"]);
    expect(sections[0].groups.map((g) => g.groupId)).toEqual(["g1", "g3"]);
  });

  it("keeps the backend's category order", () => {
    // The backend sorts by recent volume: a topic that is picking up belongs
    // above one that was busy months ago and has gone quiet. Re-sorting on
    // all-time counts here would throw exactly that away.
    const overview: FAQOverview = {
      groups: [
        group({ groupId: "g1", category: "Quiet", count: 50 }),
        group({ groupId: "g2", category: "Busy", count: 3 }),
      ],
      categories: [
        category("Busy", { recentQuestionCount: 3, questionCount: 3 }),
        category("Quiet", { recentQuestionCount: 0, questionCount: 50 }),
      ],
    };

    expect(toCategorySections(overview).map((s) => s.name)).toEqual(["Busy", "Quiet"]);
  });

  it("orders the groups inside a category by how often they are asked", () => {
    const overview: FAQOverview = {
      groups: [
        group({ groupId: "small", category: "Deployment", count: 2 }),
        group({ groupId: "big", category: "Deployment", count: 9 }),
      ],
      categories: [category("Deployment", { groupCount: 2 })],
    };

    expect(toCategorySections(overview)[0].groups.map((g) => g.groupId)).toEqual(["big", "small"]);
  });

  it("collects uncategorised groups into one bucket at the end", () => {
    const overview: FAQOverview = {
      groups: [
        group({ groupId: "g1" }),
        group({ groupId: "g2", category: "Deployment" }),
        group({ groupId: "g3", category: null }),
      ],
      categories: [category("Deployment")],
    };

    const sections = toCategorySections(overview);

    expect(sections.at(-1)?.key).toBe(UNCATEGORIZED_KEY);
    expect(sections.at(-1)?.groups.map((g) => g.groupId)).toEqual(["g1", "g3"]);
  });

  it("omits the uncategorised bucket when every group has a category", () => {
    const overview: FAQOverview = {
      groups: [group({ groupId: "g1", category: "Deployment" })],
      categories: [category("Deployment")],
    };

    expect(toCategorySections(overview).map((s) => s.key)).toEqual(["Deployment"]);
  });

  it("still shows a category the backend did not summarise", () => {
    // Otherwise its groups would vanish from the page entirely, which is worse
    // than showing them without their totals.
    const overview: FAQOverview = {
      groups: [group({ groupId: "g1", category: "Unlisted" })],
      categories: [],
    };

    const sections = toCategorySections(overview);

    expect(sections.map((s) => s.name)).toEqual(["Unlisted"]);
    expect(sections[0].category).toBeUndefined();
  });

  it("skips a category that has no groups left", () => {
    const overview: FAQOverview = {
      groups: [group({ groupId: "g1", category: "Deployment" })],
      categories: [category("Deployment"), category("Emptied")],
    };

    expect(toCategorySections(overview).map((s) => s.name)).toEqual(["Deployment"]);
  });

  it("treats an overview without categories as entirely uncategorised", () => {
    // A backend that predates categories must not produce an empty page.
    const overview: FAQOverview = {
      groups: [group({ groupId: "g1" }), group({ groupId: "g2" })],
    };

    const sections = toCategorySections(overview);

    expect(sections).toHaveLength(1);
    expect(sections[0].groups).toHaveLength(2);
  });
});
