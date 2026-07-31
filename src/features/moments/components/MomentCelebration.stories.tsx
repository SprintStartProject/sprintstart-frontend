import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MomentCelebration } from "./MomentCelebration.tsx";
import type { MomentTone } from "../types.ts";
import "../../../styles/index.css";

/**
 * Applies the app's light/dark class the same way `ThemeProvider` does, so a
 * story is a fair preview of the real thing rather than a light-only mock.
 */
function ThemeFrame({
    dark,
    children,
}: {
    dark: boolean;
    children: React.ReactNode;
}) {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(dark ? "dark" : "light");
    }, [dark]);

    return <div className="min-h-[420px] bg-app-bg">{children}</div>;
}

type StoryArgs = {
    tone: MomentTone;
    title: string;
    message: string;
    dark: boolean;
};

const meta: Meta<StoryArgs> = {
    title: "Moments/MomentCelebration",
    argTypes: {
        tone: {
            control: "inline-radio",
            options: ["success", "milestone", "triumph"] satisfies MomentTone[],
        },
        dark: { control: "boolean" },
    },
    render: ({ tone, title, message, dark }) => (
        <ThemeFrame dark={dark}>
            <MomentCelebration
                // Remount on every arg change so the entry animation and the
                // confetti burst replay instead of sitting there already settled.
                key={`${tone}-${title}-${message}`}
                celebration={{ id: "story", seed: 1, tone, title, message }}
                onDismiss={() => {}}
            />
        </ThemeFrame>
    ),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** A single step or check cleared — the quietest of the three. */
export const Success: Story = {
    args: {
        tone: "success",
        title: "Step complete",
        message: "Nice — that's the contribution guide done.",
        dark: true,
    },
};

/** A phase cleared and the next one unlocked. The everyday celebration. */
export const Milestone: Story = {
    args: {
        tone: "milestone",
        title: "Phase cleared",
        message: "You passed the Systems Check. The next phase is unlocked.",
        dark: true,
    },
};

/** The whole onboarding path finished. Loudest tone, used once per person. */
export const Triumph: Story = {
    args: {
        tone: "triumph",
        title: "You're on board",
        message: "Every phase is behind you. Welcome to the team.",
        dark: true,
    },
};

/** Same milestone in light mode — both themes have to earn their keep. */
export const MilestoneLight: Story = {
    args: { ...Milestone.args, dark: false },
};
