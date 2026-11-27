import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type {
  KnowledgeModelName,
  RankingName,
  RiskQuery,
} from "../../../services/offboardingTypes";
import { DEFAULT_SETTINGS, draftProblem, toRiskQuery, type DepartureDraft } from "../departure";
import { HintedField } from "./HintedField";
import { WhoIsLeaving, type TeamState } from "./WhoIsLeaving";

type DepartureFormProps = {
  team: TeamState;
  busy: boolean;
  onSubmit: (query: RiskQuery) => void;
};

const EMPTY_DRAFT: DepartureDraft = {
  memberIds: [],
  people: [],
  asOfDay: "",
  ...DEFAULT_SETTINGS,
};

function ModelFields({
  draft,
  onChange,
}: {
  draft: DepartureDraft;
  onChange: (draft: DepartureDraft) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <HintedField
        label="Rank files by"
        hint="The departing share puts files that lose their knowledge first; the placeholder score also weighs how relevant a file is."
      >
        <Select
          value={draft.ranking}
          onChange={(event) => onChange({ ...draft, ranking: event.target.value as RankingName })}
        >
          <option value="departing-share">Departing share</option>
          <option value="placeholder">Placeholder score</option>
        </Select>
      </HintedField>
      <HintedField
        label="Who knows a file"
        hint="Authorship counts whoever wrote enough of it; time-weighted lets evidence fade with its age."
      >
        <Select
          value={draft.knowledge}
          onChange={(event) =>
            onChange({ ...draft, knowledge: event.target.value as KnowledgeModelName })
          }
        >
          <option value="authorship">Authorship</option>
          <option value="time-weighted">Time-weighted</option>
        </Select>
      </HintedField>
    </div>
  );
}

function ScopeFields({
  draft,
  onChange,
}: {
  draft: DepartureDraft;
  onChange: (draft: DepartureDraft) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <HintedField
        label="As of"
        hint="Replays the history up to the end of this day. Empty means now."
      >
        <Input
          type="date"
          value={draft.asOfDay}
          onChange={(event) => onChange({ ...draft, asOfDay: event.target.value })}
        />
      </HintedField>
      <WeightField
        label="Review weight"
        hint="Commits count 1. Give reviews a weight to let them count too; empty leaves them out."
        value={draft.reviewWeight}
        onChange={(reviewWeight) => onChange({ ...draft, reviewWeight })}
      />
    </div>
  );
}

/** How much one kind of evidence counts next to commits, as typed. */
function WeightField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <HintedField label={label} hint={hint}>
      <Input
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </HintedField>
  );
}

/** How much the evidence from documentation pages and tickets counts next to commits. */
function SourceFields({
  draft,
  onChange,
}: {
  draft: DepartureDraft;
  onChange: (draft: DepartureDraft) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <WeightField
        label="Page weight"
        hint="Confluence and Notion pages people wrote. 1 counts them like commits; 0 leaves pages off the map."
        value={draft.pageEditWeight}
        onChange={(pageEditWeight) => onChange({ ...draft, pageEditWeight })}
      />
      <WeightField
        label="Ticket weight"
        hint="People on the Jira tickets a commit names count for its files. Empty leaves tickets out."
        value={draft.ticketWeight}
        onChange={(ticketWeight) => onChange({ ...draft, ticketWeight })}
      />
    </div>
  );
}

/**
 * Describes a departure: who leaves, as of which day, and how much reviews, pages and tickets count
 * next to commits.
 *
 * It only builds the request; ranking is the page's business.
 */
export function DepartureForm({ team, busy, onSubmit }: DepartureFormProps) {
  const [draft, setDraft] = useState<DepartureDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const problem = submitted ? draftProblem(draft) : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (draftProblem(draft) === null) onSubmit(toRiskQuery(draft, team.members));
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label="Departure to simulate"
    >
      <WhoIsLeaving team={team} draft={draft} onChange={setDraft} />
      <ScopeFields draft={draft} onChange={setDraft} />
      <SourceFields draft={draft} onChange={setDraft} />
      <ModelFields draft={draft} onChange={setDraft} />
      {problem && (
        <p role="alert" className="text-sm text-app-danger-text">
          {problem}
        </p>
      )}
      <Button type="submit" loading={busy} icon={<Search className="h-4 w-4" />}>
        Rank files
      </Button>
    </form>
  );
}
