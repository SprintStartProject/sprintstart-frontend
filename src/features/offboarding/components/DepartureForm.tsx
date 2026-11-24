import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import type {
  KnowledgeModelName,
  RankingName,
  RiskQuery,
} from "../../../services/offboardingTypes";
import { draftProblem, toRiskQuery, type DepartureDraft } from "../departure";
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
  reviewWeight: "",
  ranking: "departing-share",
  knowledge: "authorship",
};

/**
 * Describes a departure: who leaves, as of which day, and whether reviews count next to commits.
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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="As of" hint="Replays the history up to the end of this day. Empty means now.">
          <Input
            type="date"
            value={draft.asOfDay}
            onChange={(event) => setDraft({ ...draft, asOfDay: event.target.value })}
          />
        </Field>
        <Field
          label="Review weight"
          hint="Commits count 1. Give reviews a weight to let them count too; empty leaves them out."
        >
          <Input
            type="number"
            min={0}
            step={0.1}
            value={draft.reviewWeight}
            onChange={(event) => setDraft({ ...draft, reviewWeight: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Rank files by"
          hint="The departing share puts files that lose their knowledge first; the placeholder score also weighs how relevant a file is."
        >
          <Select
            value={draft.ranking}
            onChange={(event) => setDraft({ ...draft, ranking: event.target.value as RankingName })}
          >
            <option value="departing-share">Departing share</option>
            <option value="placeholder">Placeholder score</option>
          </Select>
        </Field>
        <Field
          label="Who knows a file"
          hint="Authorship counts whoever wrote enough of it; time-weighted lets evidence fade with its age."
        >
          <Select
            value={draft.knowledge}
            onChange={(event) =>
              setDraft({ ...draft, knowledge: event.target.value as KnowledgeModelName })
            }
          >
            <option value="authorship">Authorship</option>
            <option value="time-weighted">Time-weighted</option>
          </Select>
        </Field>
      </div>
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
