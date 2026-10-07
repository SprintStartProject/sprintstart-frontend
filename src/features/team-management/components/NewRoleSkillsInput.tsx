import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "../../../components/ui/Input";
import type { Skill } from "../types";

/** How many catalog skills are offered under the field while typing. */
const MAX_MATCHES = 6;

/** A skill picked for a role that does not exist yet: a catalog entry, or a new name. */
export type PendingSkill = {
  /** Stable for the list: the catalog id, or the lower-cased new name. */
  key: string;
  name: string;
  /** Set for a skill already in the catalog; a new one is created by name. */
  skillId?: string;
};

/**
 * The skills of a role being created, picked before it exists — so a new role does not need
 * opening, typing into the panel and adding one skill at a time afterwards.
 *
 * Typing offers matching skills from the catalog to pick with one press; Enter (or a comma)
 * takes what was typed, as the catalog skill of that exact name if there is one, otherwise as a
 * new skill. Retired skills are not offered: they can no longer be assigned.
 */
export function NewRoleSkillsInput({
  catalog,
  value,
  onChange,
  disabled = false,
}: {
  catalog: Skill[];
  value: PendingSkill[];
  onChange: (skills: PendingSkill[]) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const picked = new Set(value.map((skill) => skill.key));
  const trimmed = query.trim();
  const lowered = trimmed.toLowerCase();

  const matches =
    lowered === ""
      ? []
      : catalog
          .filter(
            (skill) =>
              skill.status !== "RETIRED" &&
              !picked.has(skill.id) &&
              skill.name.toLowerCase().includes(lowered),
          )
          .slice(0, MAX_MATCHES);

  function add(skill: PendingSkill) {
    if (!picked.has(skill.key)) onChange([...value, skill]);
    setQuery("");
  }

  function addTyped() {
    if (trimmed === "") return;
    const existing = catalog.find(
      (skill) => skill.status !== "RETIRED" && skill.name.toLowerCase() === lowered,
    );
    add(
      existing
        ? { key: existing.id, name: existing.name, skillId: existing.id }
        : { key: `new:${lowered}`, name: trimmed },
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-app-text-muted">
        Skills
      </label>
      <Input
        id={id}
        value={query}
        disabled={disabled}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTyped();
          } else if (event.key === "Backspace" && query === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        placeholder="Type a skill and press Enter, e.g. React"
      />

      {matches.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-app-text-subtle">From the catalog:</span>
          {matches.map((skill) => (
            <button
              key={skill.id}
              type="button"
              onClick={() => add({ key: skill.id, name: skill.name, skillId: skill.id })}
              className="inline-flex items-center gap-1 rounded-full border border-app-border bg-app-bg px-2 py-0.5 text-xs text-app-text transition-colors hover:border-app-brand-border-strong hover:text-app-brand-text"
            >
              <Plus aria-hidden="true" className="h-3 w-3" />
              {skill.name}
            </button>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <ul aria-label="Skills for the new role" className="mt-2 flex flex-wrap gap-1.5">
          {value.map((skill) => (
            <li
              key={skill.key}
              className="inline-flex items-center gap-1 rounded-full border border-app-brand-border-strong bg-app-brand-soft py-0.5 pr-1 pl-2.5 text-xs text-app-brand-text"
            >
              {skill.name}
              {!skill.skillId && <span className="text-2xs font-semibold uppercase">new</span>}
              <button
                type="button"
                aria-label={`Remove ${skill.name}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((other) => other.key !== skill.key))}
                className="-my-1 rounded-full p-1.5 hover:bg-app-brand/15"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
