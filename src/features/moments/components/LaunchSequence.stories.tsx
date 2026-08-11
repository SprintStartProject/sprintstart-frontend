import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { LaunchSequence } from "./LaunchSequence.tsx";
import "../../../styles/index.css";

type StoryArgs = {
  displayName: string;
  dark: boolean;
};

/**
 * The sequence plays once and hands over, so the story needs a way to run it
 * again — remounting via a changing key is the honest way to do that, since it
 * exercises the same mount path the app uses.
 */
function Replayable({ displayName, dark }: StoryArgs) {
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 bg-app-bg">
      <p className="max-w-sm text-center text-sm text-app-text-muted">
        This is what the app looks like underneath. The sequence covers it, never blocks it — any
        click or key skips straight through.
      </p>

      <button
        type="button"
        onClick={() => {
          setRun((value) => value + 1);
          setPlaying(true);
        }}
        className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        Replay launch sequence
      </button>

      {playing && (
        <LaunchSequence
          key={run}
          displayName={displayName || undefined}
          onDone={() => setPlaying(false)}
        />
      )}
    </div>
  );
}

const meta: Meta<StoryArgs> = {
  title: "Moments/LaunchSequence",
  argTypes: { dark: { control: "boolean" } },
  render: (args) => <Replayable {...args} />,
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** What a returning user sees once per tab, right after sign-in. */
export const Default: Story = {
  args: { displayName: "David", dark: true },
};

/** Before the profile has loaded there is no name to greet — falls back cleanly. */
export const WithoutName: Story = {
  args: { displayName: "", dark: true },
};

export const Light: Story = {
  args: { displayName: "David", dark: false },
};
