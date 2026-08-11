import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MissionComplete } from "./MissionComplete.tsx";
import "../../../styles/index.css";

type StoryArgs = {
  displayName: string;
  dark: boolean;
};

/**
 * The finale runs once and then sits on its card, so the story needs a way to
 * run it again. Remounting via a changing key exercises the same mount path the
 * app uses, rather than reaching into the component's stage state.
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
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 bg-app-bg">
      <p className="max-w-sm text-center text-sm text-app-text-muted">
        Three beats: the descent onto the Moon, the touchdown, and the card. Click or press a key
        during the first two to skip straight to the card.
      </p>

      <button
        type="button"
        onClick={() => {
          setRun((value) => value + 1);
          setPlaying(true);
        }}
        className="rounded-xl bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand-hover focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:outline-none"
      >
        Replay finale
      </button>

      {playing && (
        <MissionComplete
          key={run}
          displayName={displayName || undefined}
          onDismiss={() => setPlaying(false)}
        />
      )}
    </div>
  );
}

const meta: Meta<StoryArgs> = {
  title: "Moments/MissionComplete",
  argTypes: { dark: { control: "boolean" } },
  render: (args) => <Replayable {...args} />,
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** What someone sees once, on the day they finish onboarding. */
export const Default: Story = {
  args: { displayName: "David", dark: true },
};

/** Before the profile has loaded there is no name to use — falls back cleanly. */
export const WithoutName: Story = {
  args: { displayName: "", dark: true },
};

export const Light: Story = {
  args: { displayName: "David", dark: false },
};
