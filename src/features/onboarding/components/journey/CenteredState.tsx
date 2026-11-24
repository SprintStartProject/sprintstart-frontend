import type { ReactNode } from "react";
import { Rocket } from "lucide-react";
import { PageShell } from "../../../../components/layout/PageShell";

/** Loading, error and empty states: inside the page's own chrome, so the header never blinks away. */
export function CenteredState({ children }: { children: ReactNode }) {
  return (
    <PageShell
      icon={Rocket}
      title="Onboarding"
      subtitle="Your path into the project. Phases that are open can be done in any order."
    >
      <div className="flex min-h-96 flex-col items-center justify-center py-12 text-center">
        {children}
      </div>
    </PageShell>
  );
}

const TONE_CLASS = {
  danger: "bg-app-danger-bg text-app-danger-text",
  warning: "bg-app-warning-bg text-app-warning-text",
  brand: "bg-app-brand-soft text-app-brand-text",
} as const;

/** The round icon above a state's heading, tinted by how worried the state is. */
export function StateIcon({
  tone,
  children,
}: {
  tone: keyof typeof TONE_CLASS;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex h-16 w-16 items-center justify-center rounded-3xl ${TONE_CLASS[tone]}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
