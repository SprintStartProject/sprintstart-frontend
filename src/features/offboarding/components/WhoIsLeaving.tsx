import type { MemberMatch } from "../../../services/offboardingTypes";
import type { DepartureDraft } from "../departure";
import { MemberPicker } from "./MemberPicker";
import { PeopleInput } from "./PeopleInput";

/** The project's members as the form can offer them. */
export type TeamState = {
  members: MemberMatch[];
  loading: boolean;
  failed: boolean;
};

type WhoIsLeavingProps = {
  team: TeamState;
  draft: DepartureDraft;
  onChange: (draft: DepartureDraft) => void;
};

/**
 * Where the leaving people are chosen: from the project's members when they are known, and by typing
 * an email or login for anybody the list does not offer.
 */
export function WhoIsLeaving({ team, draft, onChange }: WhoIsLeavingProps) {
  const listed = team.members.length > 0;
  return (
    <div className="space-y-4">
      {team.loading && (
        <p role="status" className="text-sm text-app-text-muted">
          Loading the team…
        </p>
      )}
      {team.failed && (
        <p role="status" className="text-sm text-app-warning-text">
          The team could not be loaded. Add an email or a GitHub login instead.
        </p>
      )}
      {listed && (
        <MemberPicker
          members={team.members}
          selected={draft.memberIds}
          onChange={(memberIds) => onChange({ ...draft, memberIds })}
        />
      )}
      <PeopleInput
        label={listed ? "Someone who is not listed?" : "Who is leaving?"}
        hint="An email or a GitHub login. Press Enter to add, or paste several."
        people={draft.people}
        onChange={(people) => onChange({ ...draft, people })}
      />
    </div>
  );
}
