import { AccountEnabledToggle } from "./AccountEnabledToggle";
import { Section } from "./Section";
import { StatusChip } from "./StatusChip";

type AccountAccessRowProps = {
  isEditing: boolean;
  enabled: boolean;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

function AccountAccessRow({
  isEditing,
  enabled,
  disabled,
  onEnabledChange,
}: AccountAccessRowProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-1.5 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
      <dt className="text-sm text-app-text-muted">Account access</dt>
      <dd className="flex flex-wrap items-center gap-3">
        <StatusChip
          active={enabled}
          activeLabel="Enabled"
          inactiveLabel="Disabled"
          inactiveVariant="danger"
          inactiveKind="disabled"
        />
        {isEditing && (
          <AccountEnabledToggle enabled={enabled} disabled={disabled} onChange={onEnabledChange} />
        )}
      </dd>
    </div>
  );
}

type UserStatusSectionProps = {
  isEditing: boolean;
  enabled: boolean;
  onboardingCompleted: boolean;
  disabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
};

export function UserStatusSection({
  isEditing,
  enabled,
  onboardingCompleted,
  disabled,
  onEnabledChange,
}: UserStatusSectionProps) {
  return (
    <Section>
      <dl>
        <AccountAccessRow
          isEditing={isEditing}
          enabled={enabled}
          disabled={disabled}
          onEnabledChange={onEnabledChange}
        />
        <div className="grid grid-cols-1 items-center gap-1.5 py-2.5 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
          <dt className="text-sm text-app-text-muted">Onboarding</dt>
          <dd>
            <StatusChip
              active={onboardingCompleted}
              activeLabel="Done"
              inactiveLabel="Pending"
              activeVariant="purple"
              inactiveVariant="orange"
              inactiveKind="pending"
            />
          </dd>
        </div>
      </dl>
    </Section>
  );
}
