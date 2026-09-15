import type { FilterSelectOption } from "../../components/ui/FilterSelect";

/**
 * A staged source's documentation owner, as the pickers offer it.
 *
 * The id is what `setComponentOwners` writes; the label is what the PM reads. Kept as its own
 * type so the two places that build the list — the project's members on the Data Ingestion
 * page, the staged members in the create-project wizard — agree on the shape without either
 * owning it.
 */
export type SourceOwnerOption = FilterSelectOption<string>;

/**
 * The empty choice, prepended by every owner picker.
 *
 * "Nobody" has to be something you can pick and not merely the state you start in: a PM who
 * names the wrong person needs a way back, and clearing the field is it.
 */
export const NO_OWNER_OPTION: SourceOwnerOption = { value: "", label: "No owner" };

/** Alphabetical by what is on screen, so a list of any length can be scanned. */
export function sortOwnerOptions(options: SourceOwnerOption[]): SourceOwnerOption[] {
  return [...options].sort((left, right) => left.label.localeCompare(right.label));
}
