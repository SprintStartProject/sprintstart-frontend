import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BoardPhaseRecap } from "../../../../src/features/board/components/BoardPhaseRecap";
import * as bus from "../../../../src/features/buddy/aiBuddyBus";
import type { OnboardingPathEndpoint } from "../../../../src/features/onboarding/types";

const finished = (title: string) =>
  ({
    id: "path",
    phases: [
      {
        id: "p1",
        title,
        position: 1,
        steps: [{ id: "s1", title: "Set up SSH", status: "FINISHED", position: 0 }],
        questions: [],
      },
    ],
  }) as unknown as OnboardingPathEndpoint;

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function ask(title: string): Promise<string> {
  const open = vi.spyOn(bus, "openAiBuddy").mockImplementation(() => {});
  render(<BoardPhaseRecap boardId="b1" path={finished(title)} />);
  await userEvent.click(screen.getByRole("button", { name: /ask your buddy/i }));

  return open.mock.calls[0]?.[0]?.draft ?? "";
}

describe("the recap a finished phase offers", () => {
  it("asks the buddy to open with a link back to the phase", async () => {
    expect(await ask("Setup")).toContain("[[Setup]]");
  });

  it("leaves the link out when the title could not be linked", async () => {
    expect(await ask("Setup [optional]")).not.toContain("[[");
  });
});
