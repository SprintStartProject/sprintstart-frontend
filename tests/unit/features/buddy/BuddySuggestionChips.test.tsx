import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BuddySuggestionChips } from "../../../../src/features/buddy/components/BuddySuggestionChips";

const suggestions = [
  { label: "What should I work on?", question: "What should I work on next?" },
  { label: "Who reviews my PRs?", question: "Who reviews my pull requests?" },
  { label: "Where are the runbooks?", question: "Where do I find the runbooks?" },
  { label: "How do I get staging access?", question: "How do I get staging credentials?" },
  { label: "When is the release train?", question: "When does the next release train leave?" },
];

describe("BuddySuggestionChips", () => {
  it("renders nothing when the backend offered nothing", () => {
    const { container } = render(<BuddySuggestionChips suggestions={[]} onPick={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("caps the row at `limit` while the chips keep their reading size", async () => {
    const onPick = vi.fn();
    render(<BuddySuggestionChips suggestions={suggestions} onPick={onPick} limit={3} />);

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip.className).toContain("text-sm");
      expect(chip.className).not.toContain("text-xs");
    }

    // A chip fills the composer with its question; it never sends.
    await userEvent.click(chips[1]);
    expect(onPick).toHaveBeenCalledWith(suggestions[1].question);
  });

  it("shows every chip at reading size when nothing caps the row", () => {
    render(<BuddySuggestionChips suggestions={suggestions} onPick={vi.fn()} />);

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(5);
    expect(chips[0].className).toContain("text-sm");
  });

  it("keeps the dock's compact row at three, one size down", () => {
    render(<BuddySuggestionChips suggestions={suggestions} onPick={vi.fn()} compact />);

    const chips = screen.getAllByRole("button");
    expect(chips).toHaveLength(3);
    expect(chips[0].className).toContain("text-xs");
  });
});
