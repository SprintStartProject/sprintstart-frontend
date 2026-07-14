import { UserRound } from 'lucide-react';
import type { OnboardingStepEndpoint } from '../types';

type StepOriginBadgeProps = {
  step: OnboardingStepEndpoint;
};

export function StepOriginBadge({ step }: StepOriginBadgeProps) {
  if (step.isAiAssisted !== false) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-app-brand-border bg-app-brand-soft px-2.5 py-1 text-xs font-medium text-app-brand-text">
      <UserRound className="h-3.5 w-3.5" />
      Custom step by PM
    </span>
  );
}
