import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { RocketPet } from "./RocketPet.tsx";
import "../../../styles/index.css";

type StoryArgs = { dark: boolean };

function Frame({ dark }: StoryArgs) {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(dark ? "dark" : "light");
    }, [dark]);

    return (
        <div className="min-h-[420px] bg-app-bg p-8">
            <p className="max-w-sm text-sm text-app-text-muted">
                Bottom-right corner. Click it. It comes back.
            </p>
            <RocketPet />
        </div>
    );
}

const meta: Meta<StoryArgs> = {
    title: "Moments/RocketPet",
    argTypes: { dark: { control: "boolean" } },
    render: (args) => <Frame {...args} />,
};

export default meta;
type Story = StoryObj<StoryArgs>;

/**
 * The rocket perches at low opacity and lifts on hover, so it reads as
 * available without competing with the page it sits on.
 */
export const Default: Story = { args: { dark: true } };

export const Light: Story = { args: { dark: false } };
