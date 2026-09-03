import { useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { Select } from "../../../components/ui/Select";
import { SidePanel } from "../../../components/ui/SidePanel";
import { Textarea } from "../../../components/ui/Textarea";
import { SelectionCheckbox } from "../../admin/components/SelectionCheckbox";
import { BOARD_STAGES, STAGE_LABELS, type BoardStage } from "../../board/layout/boardStructure";
import type { ProjectRole } from "../../team-management/types";
import type { CardBlueprint, CardBlueprintDraft } from "../types";

type CardBlueprintEditorProps = {
  isOpen: boolean;
  onClose: () => void;
  /** The blueprint being edited, or null when a new one is being written. */
  editing: CardBlueprint | null;
  draft: CardBlueprintDraft;
  onChange: (draft: CardBlueprintDraft) => void;
  onSave: () => void;
  saving: boolean;
  /** The project's roles, so a blueprint can be aimed at some of them. */
  roles: ProjectRole[];
  /** The other blueprints, as candidates for "comes after". Never includes the one being edited. */
  others: CardBlueprint[];
};

/**
 * One named part of the form: a heading, a sentence saying what the part decides, and its fields.
 *
 * The panel used to be six fields in a column, all at the same weight, in the order they happened
 * to be added. Nothing said that the first three describe the card, the next two describe when it
 * shows up, and the last one describes who sees it — so a PM read six unrelated questions instead
 * of three decisions, and the two that are easily confused sat side by side with nothing between
 * them but their own labels.
 */
function Section({
  title,
  children,
  hint,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-app-border pt-5 first:border-t-0 first:pt-0">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-app-text">{title}</h3>
        {hint && <p className="text-xs text-app-text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Writing one card blueprint: what the card says, when it is due, and who gets it.
 *
 * A side panel rather than a page, because a PM writing these is working down a list and comparing
 * one against the next — losing the list to edit an item would mean navigating back to find their
 * place every time.
 *
 * **Roles are checkboxes with an explicit "everyone" state, not a multi-select.** Which roles a
 * card applies to is the decision this screen exists to capture, and a control that shows the
 * answer without being opened is worth the vertical space. Ticking nothing means everyone, which
 * the hint says out loud — an empty set that silently meant "nobody" would produce blueprints that
 * quietly reach no one.
 */
export function CardBlueprintEditor({
  isOpen,
  onClose,
  editing,
  draft,
  onChange,
  onSave,
  saving,
  roles,
  others,
}: CardBlueprintEditorProps) {
  const [newItem, setNewItem] = useState("");

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    onChange({ ...draft, items: [...draft.items, text] });
    setNewItem("");
  };

  const toggleRole = (roleId: string) => {
    onChange({
      ...draft,
      roleIds: draft.roleIds.includes(roleId)
        ? draft.roleIds.filter((id) => id !== roleId)
        : [...draft.roleIds, roleId],
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? "Edit card blueprint" : "New card blueprint"}
      description="Every new hire whose role matches gets this card on their board."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSave}
            loading={saving}
            disabled={draft.title.trim().length === 0}
          >
            {editing ? "Save changes" : "Create blueprint"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Section title="The card" hint="What the hire finds on their board.">
          <Field label="Card title" required hint="What the hire sees at the top of the card.">
            <Input
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              placeholder="Get access to the deployment pipeline"
            />
          </Field>

          <Field label="Why this card is here" hint="One line under the title. Optional.">
            <Textarea
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              placeholder="You'll need this before your first release, and it takes a day to be granted."
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-app-text">Checklist</legend>
            <p className="text-xs text-app-text-muted">
              The lines the hire ticks off. A blueprint with none is a card with a title only.
            </p>

            {draft.items.length > 0 && (
              <ul className="space-y-1">
                {draft.items.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-app-text">{item}</span>
                    <Button
                      variant="dangerGhost"
                      size="sm"
                      iconOnly
                      aria-label={`Remove "${item}"`}
                      onClick={() =>
                        onChange({ ...draft, items: draft.items.filter((_, at) => at !== index) })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex gap-2">
              <label className="sr-only" htmlFor="blueprint-item">
                Add a checklist line
              </label>
              <Input
                id="blueprint-item"
                size="sm"
                value={newItem}
                onChange={(event) => setNewItem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addItem();
                }}
                placeholder="Add a line"
                className="min-w-0 flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                iconOnly
                onClick={addItem}
                disabled={newItem.trim().length === 0}
                aria-label="Add this line"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </fieldset>
        </Section>

        <Section
          title="When it shows up"
          hint="Two different questions, and the difference is worth a moment."
        >
          {/* The one explanation this panel could not do without. Both controls below narrow when a
            card is worth reading, so from their labels alone they look like the same knob at two
            strengths — and a PM who reaches for the wrong one either buries a card nobody was
            waiting on, or blocks one that nothing was stopping. Said once, here, where the two
            sit next to each other, rather than in a tooltip on each. */}
          <div className="space-y-2 rounded-xl border border-app-border bg-app-surface-muted/50 p-3 text-xs leading-relaxed text-app-text-muted">
            <p>
              <span className="font-medium text-app-text">Stage</span> is about *when this becomes
              relevant*: a &ldquo;Later&rdquo; card is not locked, it is just filed away so it does
              not crowd the hire&rsquo;s first days. They can open it whenever they like.
            </p>
            <p>
              <span className="font-medium text-app-text">Comes after</span> is about *this makes no
              sense before that*: the board dims the card, says what it is waiting on, and keeps it
              behind its predecessor in one pile until that one is finished.
            </p>
            <p>
              Not yet relevant → a later stage. Pointless without another card → comes after it. A
              card can be both: due now, and still waiting on another card that is due now.
            </p>
          </div>

          <Field label="When it's due" hint="Which stage of the ramp this card belongs to.">
            <Select
              value={draft.stage}
              onChange={(event) => onChange({ ...draft, stage: event.target.value as BoardStage })}
            >
              {BOARD_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABELS[stage].title} — {STAGE_LABELS[stage].hint}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Comes after"
            hint="The hire's card waits until that one is finished. Leave it on 'nothing' unless the order really matters."
          >
            <Select
              value={draft.afterId ?? ""}
              onChange={(event) => onChange({ ...draft, afterId: event.target.value || null })}
            >
              <option value="">Nothing — can be done any time</option>
              {others.map((blueprint) => (
                <option key={blueprint.id} value={blueprint.id}>
                  {blueprint.title}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        <Section title="Who gets it" hint="Tick none to give it to everybody on the project.">
          <fieldset className="space-y-2">
            <legend className="sr-only">Which roles get this</legend>

            {roles.length === 0 ? (
              <p className="text-sm text-app-text-muted">
                This project has no roles yet, so every blueprint applies to everybody.
              </p>
            ) : (
              <ul className="space-y-1">
                {roles.map((role) => (
                  <li key={role.id} className="flex items-center gap-2.5">
                    <SelectionCheckbox
                      checked={draft.roleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      ariaLabel={role.name}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-app-text">{role.name}</span>
                      {role.description && (
                        <span className="block text-xs text-app-text-muted">
                          {role.description}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </Section>
      </div>
    </SidePanel>
  );
}
