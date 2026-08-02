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
                Bottom-right corner. It hides there and leans out every so often
                — move the pointer near it to bring it fully out, click it to
                launch it. It stays gone for a few minutes before it comes back.
                On a touchscreen the first tap brings it out and the second one
                launches it; switch the toolbar to a mobile device to try that.
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
 * Peeks on a 20–45s timer, so give it a moment. Hover is the reliable way to
 * see the full pose without waiting.
 */
export const Default: Story = { args: { dark: true } };

export const Light: Story = { args: { dark: false } };
