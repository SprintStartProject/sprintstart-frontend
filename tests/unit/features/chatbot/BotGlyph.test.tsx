import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BotGlyph } from "../../../../src/features/chatbot/components/BotGlyph";
import type { BotState } from "../../../../src/features/chatbot/components/BotGlyph";

/**
 * The framer mock strips motion props, so these assert the glyph *renders* in
 * every state rather than checking keyframe values — the animation itself is
 * not something jsdom can see. What is worth guarding is that no state throws
 * or silently drops the face: an unhandled state in one of the several ternaries
 * driving eyes, antenna and mouth would show up here.
 */
const ALL_STATES: BotState[] = ["awake", "drowsy", "asleep", "thinking", "cheering", "dizzy"];

describe("BotGlyph", () => {
  it.each(ALL_STATES)("renders a complete face in the %s state", (state) => {
    const { container } = render(<BotGlyph size={30} state={state} />);

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "30");

    // Two eyes, the antenna bulb, and the head/plate/mouth rects.
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(5);
  });

  it("renders while startled, which layers on top of a state", () => {
    const { container } = render(<BotGlyph size={30} state="awake" isWaking />);

    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelectorAll("circle")).toHaveLength(3);
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<BotGlyph size={30} state="thinking" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("swaps the flat mouth for the round one while awed", () => {
    const { container } = render(<BotGlyph size={30} state="awake" awed />);

    // One mouth at a time: the "ooo" replaces the bar, it does not join it.
    // Five rects remain — two side nubs, the head, the two-layer face
    // plate — where the awake face has six, the sixth being the mouth bar.
    expect(container.querySelector('[data-testid="bot-awe-mouth"]')).toBeInTheDocument();
    expect(container.querySelectorAll("rect")).toHaveLength(5);

    const plain = render(<BotGlyph size={30} state="awake" />);
    expect(plain.container.querySelectorAll("rect")).toHaveLength(6);
  });

  it.each(["asleep", "drowsy", "dizzy"] as BotState[])(
    "ignores awe in the %s state, which owns its own face",
    (state) => {
      const { container } = render(<BotGlyph size={30} state={state} awed />);

      expect(container.querySelector('[data-testid="bot-awe-mouth"]')).not.toBeInTheDocument();
    },
  );
});
