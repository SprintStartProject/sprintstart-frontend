import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RocketPet } from "../../../../src/features/moments/components/RocketPet.tsx";

/**
 * Points `matchMedia` at a fixed answer for `(pointer: coarse)`, so a test can
 * choose whether it is running on a finger or on a mouse.
 */
function setPointerType(coarse: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: query.includes("pointer: coarse") ? coarse : false,
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }),
    });
}

function rocketButton() {
    return screen.getByRole("button", { name: /launch the rocket/i });
}

describe("RocketPet", () => {
    beforeEach(() => {
        window.localStorage.clear();
        setPointerType(false);
    });

    it("is reachable on a touchscreen, where the old version was not rendered at all", () => {
        setPointerType(true);
        render(<RocketPet />);

        expect(rocketButton()).toBeInTheDocument();
    });

    it("launches on the first click with a mouse", async () => {
        const user = userEvent.setup();
        render(<RocketPet />);

        await user.click(rocketButton());

        // The tally is the observable side effect of a launch having happened.
        expect(window.localStorage.getItem("rocketLaunchCount")).toBe("1");
    });

    it("needs a second tap on a touchscreen, so a corner tap never fires it by accident", async () => {
        setPointerType(true);
        const user = userEvent.setup();
        render(<RocketPet />);

        // First tap stands in for hover: it brings the rocket out, nothing more.
        await user.click(rocketButton());
        expect(window.localStorage.getItem("rocketLaunchCount")).toBeNull();

        await user.click(rocketButton());
        expect(window.localStorage.getItem("rocketLaunchCount")).toBe("1");
    });

    it("counts launches across sessions", async () => {
        window.localStorage.setItem("rocketLaunchCount", "6");
        const user = userEvent.setup();
        render(<RocketPet />);

        expect(rocketButton()).toHaveAccessibleName(/launched 6 times/i);

        await user.click(rocketButton());
        expect(window.localStorage.getItem("rocketLaunchCount")).toBe("7");
    });

    it("survives a blocked localStorage rather than taking the app down with it", async () => {
        const getItem = vi
            .spyOn(Storage.prototype, "getItem")
            .mockImplementation(() => {
                throw new Error("blocked");
            });
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        const user = userEvent.setup();
        render(<RocketPet />);
        await user.click(rocketButton());

        expect(rocketButton()).toBeInTheDocument();

        getItem.mockRestore();
        warn.mockRestore();
    });
});
