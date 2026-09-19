import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhasePrerequisites } from "../../../../src/features/blueprints/components/PhasePrerequisites.tsx";
import type { BlueprintPhase } from "../../../../src/features/blueprints/types.ts";

function phase(id: string, blockerIds: string[] = [], position = 0): BlueprintPhase {
  return {
    id,
    blueprintPathId: "path",
    revision: 1,
    position,
    title: `Phase ${id}`,
    description: null,
    aiPrompt: null,
    type: "FIXED",
    blockerIds,
    graphX: null,
    graphY: null,
    blueprintSteps: [],
    blueprintCheckQuestions: [],
  };
}

const noop = () => Promise.resolve();

function renderFor(phases: BlueprintPhase[], subject: string, over = {}) {
  const props = {
    phase: phases.find((item) => item.id === subject)!,
    phases,
    editable: true,
    onAdd: noop,
    onRemove: noop,
    ...over,
  };
  return { props, ...render(<PhasePrerequisites {...props} />) };
}

/** a → b → c, plus one phase nothing sequences. */
const chain = () => [phase("a"), phase("b", ["a"], 1), phase("c", ["b"], 2), phase("loner", [], 3)];

function section(name: string) {
  return screen.getByRole("heading", { name }).parentElement as HTMLElement;
}

/** Opens one of the two pickers and hands back its list. The house dropdown portals its menu. */
function openPicker(name: string) {
  fireEvent.click(screen.getByRole("combobox", { name }));
  return screen.getByRole("listbox", { name });
}

describe("PhasePrerequisites", () => {
  it("answers both halves of the question, not only the first", () => {
    // "What has to happen before this" decides whether a phase can be moved; "what opens when it is
    // done" decides whether it is worth doing early. A list that shows one answers half.
    renderFor(chain(), "b");

    expect(within(section("Waits for")).getByText("Phase a")).toBeInTheDocument();
    expect(within(section("Opens up")).getByText("Phase c")).toBeInTheDocument();
  });

  it("says plainly when a side is empty, rather than leaving it blank", () => {
    renderFor(chain(), "loner");

    expect(within(section("Waits for")).getByText(/place a hire can start/)).toBeInTheDocument();
    expect(within(section("Opens up")).getByText(/holds nobody up/)).toBeInTheDocument();
  });

  it("sets an arrow from either end, because it is the same arrow", async () => {
    // From "opens up", the edge belongs to the *other* phase — which is what somebody working down
    // a list expects when they have this phase in front of them and the next one in mind.
    const onAdd = vi.fn(() => Promise.resolve());
    renderFor(chain(), "a", { onAdd });

    const list = openPicker("Add something Phase a opens up");
    fireEvent.click(within(list).getByRole("option", { name: "Phase loner" }));

    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ id: "loner" }), "a");
  });

  it("never offers an arrow that would close a loop", () => {
    // c already waits on b through a. Offering "c" as something a could wait for would be offering
    // a ring, which nothing in it could ever start.
    renderFor(chain(), "a");

    const list = openPicker("Add something Phase a waits for");
    expect(within(list).queryByRole("option", { name: "Phase c" })).not.toBeInTheDocument();
    expect(within(list).getByRole("option", { name: "Phase loner" })).toBeInTheDocument();
  });

  it("shows the arrows on a version nobody can change, without offering to change them", () => {
    renderFor(chain(), "b", { editable: false });

    expect(within(section("Waits for")).getByText("Phase a")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Stop waiting/ })).not.toBeInTheDocument();
  });
});
