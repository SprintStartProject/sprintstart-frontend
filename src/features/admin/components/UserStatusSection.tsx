import { ShieldCheck } from "lucide-react";
import { AccountEnabledToggle } from "./AccountEnabledToggle";
import { DrawerCard } from "./DrawerCard";
import { StatusChip } from "./StatusChip";

type UserStatusSectionProps = {
  isEditing: boolean;
  enabled: boolean;
  onboardingCompleted: boolean;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** Position in the drawer body stack, so the rail reveals in sequence. */
  index?: number;
};

/**
 * The user's account status shown as a compact rail of chips rather than a
 * label/value grid: account access (with its toggle while editing) and
 * onboarding progress sit side by side, so the whole state of the account reads
 * at a glance from the top of the drawer.
 */
export function UserStatusSection({
  isEditing,
  enabled,
  onboardingCompleted,
  disabled,
  onEnabledChange,
  index = 0,
}: UserStatusSectionProps) {
  return (
    <DrawerCard label="Status" icon={ShieldCheck} index={index}>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-app-text-muted uppercase">
            Account access
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip
              active={enabled}
              activeLabel="Enabled"
              inactiveLabel="Disabled"
              inactiveVariant="danger"
              inactiveKind="disabled"
            />
            {isEditing && (
              <AccountEnabledToggle
                enabled={enabled}
                disabled={disabled}
                onChange={onEnabledChange}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-app-text-muted uppercase">
            Onboarding
          </span>
          <StatusChip
            active={onboardingCompleted}
            activeLabel="Done"
            inactiveLabel="Pending"
            activeVariant="purple"
            inactiveVariant="orange"
            inactiveKind="pending"
          />
        </div>
      </div>
    </DrawerCard>
  );
}
