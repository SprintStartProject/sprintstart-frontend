import { UserRound } from 'lucide-react';
import { Badge } from '../../../components/ui/Badge';
import type { OnboardingStepEndpoint } from '../types';

type StepOriginBadgeProps = {
  step: OnboardingStepEndpoint;
};

export function StepOriginBadge({ step }: StepOriginBadgeProps) {
  if (step.isAiAssisted !== false) return null;

  return (
    <Badge variant="brand" className="gap-1.5">
      <UserRound className="h-3.5 w-3.5" />
      Custom step by PM
    </Badge>
  );
}
