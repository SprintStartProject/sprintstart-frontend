import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PathReveal } from "./PathReveal.tsx";
import "../../../styles/index.css";

type StoryArgs = {
    dark: boolean;
};

/**
 * The launch ends by removing itself, so the story needs something underneath
 * to be handed over to — otherwise the most important beat, the page arriving
 * from below, has nothing to show. Remounting via a changing key exercises the
 * same mount path the app uses.
 */
function Replayable({ dark }: StoryArgs) {
    const [run, setRun] = useState(0);
    const [playing, setPlaying] = useState(true);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(dark ? "dark" : "light");
    }, [dark]);

    return (
        <div className="flex min-h-[560px] flex-col items-center justify-center gap-4 bg-app-bg">
            <p className="max-w-sm text-center text-sm text-app-text-muted">
                Four beats: the rocket stands on Earth, lights up, climbs while the
                planet falls away, then leaves through the top and takes the sky
                with it — uncovering whatever is underneath. Click or press a key
                to cut straight to the hand-over.
            </p>

            <button
                type="button"
                onClick={() => {
                    setRun((value) => value + 1);
                    setPlaying(true);
                }}
                className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
            >
                Replay launch
            </button>

            {playing && <PathReveal key={run} onDone={() => setPlaying(false)} />}
        </div>
    );
}

const meta: Meta<StoryArgs> = {
    title: "Moments/PathReveal",
    argTypes: { dark: { control: "boolean" } },
    render: (args) => <Replayable {...args} />,
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** What someone sees once, the day their onboarding path is built. */
export const Default: Story = {
    args: { dark: true },
};

export const Light: Story = {
    args: { dark: false },
};
