import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { parsePeople } from "../departure";
import { HintedField } from "./HintedField";

type PeopleInputProps = {
  people: string[];
  onChange: (people: string[]) => void;
  label: string;
  hint: string;
};

/**
 * The people who are leaving, entered as emails or GitHub logins and kept as removable chips.
 *
 * Several can be pasted at once, separated by commas, spaces or lines.
 */
export function PeopleInput({ people, onChange, label, hint }: PeopleInputProps) {
  const [typed, setTyped] = useState("");

  const add = () => {
    if (typed.trim() === "") return;
    onChange(parsePeople([...people, typed].join(" ")));
    setTyped("");
  };

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  };

  return (
    <div className="space-y-2">
      <HintedField label={label} hint={hint}>
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={handleKey}
          placeholder="ada@example.com or ada-lovelace"
          trailing={
            <Button iconOnly size="xs" variant="ghost" aria-label="Add person" onClick={add}>
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
      </HintedField>
      {people.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="People who are leaving">
          {people.map((person) => (
            <li key={person}>
              <PersonChip
                person={person}
                onRemove={() => onChange(people.filter((p) => p !== person))}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonChip({ person, onRemove }: { person: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-app-brand-border bg-app-brand-soft py-0.5 pr-1 pl-3 text-sm text-app-brand-text">
      {person}
      <Button iconOnly size="xs" variant="ghost" aria-label={`Remove ${person}`} onClick={onRemove}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}
