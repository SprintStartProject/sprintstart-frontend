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
        The rocket waits on the pad until the first key or click sets it off; then it lights up,
        climbs while the planet falls away, and leaves through the top, taking the sky with it. A
        second input cuts straight to the hand-over. In the app it covers only the content area —
        here, with no marked stage, it takes the whole viewport.
      </p>

      <button
        type="button"
        onClick={() => {
          setRun((value) => value + 1);
          setPlaying(true);
        }}
        className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
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
