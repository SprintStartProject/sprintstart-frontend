import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { BuddyComposer } from "../../../../src/features/buddy/components/BuddyComposer";

// The caret contract of the composer: a send hands the caret to the page (so
// Space can open the dino game), a swallowed submission keeps it where the
// hire is typing. See `submit` in the component.
describe("BuddyComposer caret handoff", () => {
  const submitWith = (handleSubmit: (event: React.FormEvent) => boolean) => {
    render(<BuddyComposer draft="party" setDraft={vi.fn()} handleSubmit={handleSubmit} />);
    const field = screen.getByLabelText("Message");
    field.focus();
    fireEvent.submit(field.closest("form")!);
    return field;
  };

  it("keeps the caret when the submission started no turn", () => {
    const field = submitWith(() => false);
    expect(document.activeElement).toBe(field);
  });

  it("hands the caret off when a turn started, so Space can open the game", () => {
    const field = submitWith(() => true);
    expect(document.activeElement).not.toBe(field);
  });

  it("does not steal focus back while the dino game is open, and returns it when the game closes", () => {
    const handleSubmit = () => true;
    const { rerender } = render(
      <BuddyComposer draft="hi" setDraft={vi.fn()} handleSubmit={handleSubmit} busy={false} />,
    );
    const field = screen.getByLabelText("Message");
    field.focus();
    fireEvent.submit(field.closest("form")!);
    expect(document.activeElement).not.toBe(field);

    // Turn in flight, game opened.
    rerender(
      <BuddyComposer draft="" setDraft={vi.fn()} handleSubmit={handleSubmit} busy gameActive />,
    );
    // Reply lands mid-game: the composer must not grab the keys the game is using.
    rerender(
      <BuddyComposer
        draft=""
        setDraft={vi.fn()}
        handleSubmit={handleSubmit}
        busy={false}
        gameActive
      />,
    );
    expect(document.activeElement).not.toBe(field);

    // Game closed: the caret comes back to the composer.
    rerender(
      <BuddyComposer
        draft=""
        setDraft={vi.fn()}
        handleSubmit={handleSubmit}
        busy={false}
        gameActive={false}
      />,
    );
    expect(document.activeElement).toBe(field);
  });
});
