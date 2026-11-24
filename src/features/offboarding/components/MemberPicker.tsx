import { Checkbox } from "../../../components/ui/Checkbox";
import type { MemberMatch } from "../../../services/offboardingTypes";
import { formatDay } from "../format";

type MemberPickerProps = {
  members: MemberMatch[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

function describe(member: MemberMatch): string {
  if (!member.matched) return "Nothing in the history is theirs yet, so they cannot be ranked.";
  const count = member.identities.length;
  const names = `${count} ${count === 1 ? "name" : "names"} in the history`;
  if (!member.inactive || !member.lastSeenAt) return names;
  return `${names}. Inactive since ${formatDay(member.lastSeenAt)}, the ranking counts them as gone already.`;
}

function MemberRow({
  member,
  checked,
  onToggle,
}: {
  member: MemberMatch;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <label
        htmlFor={`member-${member.member}`}
        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
          member.matched
            ? "cursor-pointer border-app-border hover:border-app-brand-border"
            : "cursor-not-allowed border-app-border opacity-60"
        }`}
      >
        <Checkbox
          id={`member-${member.member}`}
          checked={checked}
          disabled={!member.matched}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-app-text">
            {member.displayName}
            {member.githubLogin && (
              <span className="ml-2 font-normal text-app-text-muted">@{member.githubLogin}</span>
            )}
          </span>
          <span className="block text-xs text-app-text-muted">{describe(member)}</span>
        </span>
      </label>
    </li>
  );
}

/**
 * The project's members as a list to choose from. Choosing a member sends every name the history
 * knows them by; a member the history knows nothing about cannot be chosen.
 */
export function MemberPicker({ members, selected, onChange }: MemberPickerProps) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((other) => other !== id) : [...selected, id]);

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium text-app-text">Who is leaving?</legend>
      <ul className="grid gap-2 sm:grid-cols-2">
        {members.map((member) => (
          <MemberRow
            key={member.member}
            member={member}
            checked={selected.includes(member.member)}
            onToggle={() => toggle(member.member)}
          />
        ))}
      </ul>
    </fieldset>
  );
}
