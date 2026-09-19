import { describe, expect, it } from "vitest";
import { boardChainNodes, chainAround } from "../../../../src/features/board/layout/boardChain.ts";
import {
  deriveCardStates,
  type BoardStructure,
  type CardDependency,
} from "../../../../src/features/board/layout/boardStructure.ts";
import type { BoardCard } from "../../../../src/features/board/types.ts";

/** A note card, which is the simplest thing the board can hold and is named by its first line. */
function card(id: string, text = id): BoardCard {
  return {
    id,
    kind: "NOTE",
    owner: "HIRE",
    position: 0,
    placedAt: null,
    content: { kind: "NOTE", text },
  };
}

function structureOf(entries: Record<string, CardDependency[]>): BoardStructure {
  return {
    cards: Object.fromEntries(
      Object.entries(entries).map(([id, dependsOn]) => [id, { dependsOn }]),
    ),
    groupStages: {},
  };
}

function nodesFor(cards: BoardCard[], structure: BoardStructure) {
  return boardChainNodes(cards, structure, deriveCardStates(cards, structure));
}

describe("boardChainNodes", () => {
  it("carries who set each arrow, which is the thing a picture of the board can say and a list cannot", () => {
    const cards = [card("runbook"), card("deploy")];
    const structure = structureOf({ deploy: [{ id: "runbook", source: "TEAM" }] });

    const [, deploy] = nodesFor(cards, structure);

    expect(deploy.blockerIds).toEqual(["runbook"]);
    expect(deploy.sourceByBlockerId).toEqual({ runbook: "TEAM" });
  });

  it("drops an arrow to a card that has left the board", () => {
    // The same rule `deriveCardStates` follows: a hire who dismissed the runbook card is not
    // thereby waiting on a card nobody can see, and an arrow into nothing would say they are.
    const cards = [card("deploy")];
    const structure = structureOf({ deploy: [{ id: "runbook", source: "TEAM" }] });

    const [deploy] = nodesFor(cards, structure);

    expect(deploy.blockerIds).toEqual([]);
  });

  it("gives every node no position at all, so the picture is laid out by prerequisite", () => {
    const cards = [card("a"), card("b")];

    for (const node of nodesFor(cards, structureOf({ b: [{ id: "a", source: "HIRE" }] }))) {
      expect(node.graphX).toBeNull();
      expect(node.graphY).toBeNull();
    }
  });

  it("reads the status the board derived, rather than deriving a second opinion", () => {
    const cards = [card("runbook"), card("deploy")];
    const structure = structureOf({ deploy: [{ id: "runbook", source: "TEAM" }] });

    const [runbook, deploy] = nodesFor(cards, structure);

    expect(runbook.status).toBe("OPEN");
    expect(deploy.status).toBe("BLOCKED");
  });
});

describe("chainAround", () => {
  it("takes the whole run in both directions, not only what the card waits on", () => {
    // A hire asking why a card is closed is also asking what finishing it would free.
    const cards = ["a", "b", "c"].map((id) => card(id));
    const structure = structureOf({
      b: [{ id: "a", source: "TEAM" }],
      c: [{ id: "b", source: "HIRE" }],
    });

    const chain = chainAround(nodesFor(cards, structure), "b").map((node) => node.id);

    expect(new Set(chain)).toEqual(new Set(["a", "b", "c"]));
  });

  it("leaves out everything else on the board", () => {
    const cards = [card("a"), card("b"), card("unrelated")];
    const structure = structureOf({ b: [{ id: "a", source: "TEAM" }] });

    const chain = chainAround(nodesFor(cards, structure), "b").map((node) => node.id);

    expect(chain).not.toContain("unrelated");
  });

  it("is just the card itself when nothing connects to it", () => {
    const chain = chainAround(nodesFor([card("lonely")], structureOf({})), "lonely");

    expect(chain).toHaveLength(1);
  });
});
