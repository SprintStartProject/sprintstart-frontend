import { describe, it, expect, vi } from "vitest";
import {
  announceRocketFlight,
  getFlyingRocket,
  subscribeToRocketFlight,
} from "../../../../src/features/moments/rocketWatch";

describe("rocketWatch", () => {
  it("exposes the announced rocket and clears it on teardown", () => {
    const rocket = document.createElement("div");

    const end = announceRocketFlight(rocket);
    expect(getFlyingRocket()).toBe(rocket);

    end();
    expect(getFlyingRocket()).toBeNull();
  });

  it("notifies subscribers on both ends of a flight", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToRocketFlight(listener);

    const end = announceRocketFlight(document.createElement("div"));
    expect(listener).toHaveBeenCalledTimes(1);

    end();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    const endSecond = announceRocketFlight(document.createElement("div"));
    endSecond();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("lets the newest flight win when two overlap", () => {
    const first = document.createElement("div");
    const second = document.createElement("div");

    const endFirst = announceRocketFlight(first);
    const endSecond = announceRocketFlight(second);

    // The first flight's teardown arrives late — e.g. its component
    // unmounts after a second rocket has already taken off. It must not
    // wipe out the flight that superseded it.
    endFirst();
    expect(getFlyingRocket()).toBe(second);

    endSecond();
    expect(getFlyingRocket()).toBeNull();
  });
});
