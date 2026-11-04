import { useState } from "react";
import { toggled, toggledAll } from "./discoveryRules";

type RepositoryPicker = {
  filter: string;
  setFilter: (filter: string) => void;
  selected: ReadonlySet<string>;
  clearSelection: () => void;
  toggle: (name: string) => void;
  toggleAll: (names: string[], allSelected: boolean) => void;
};

/** The filter text and the set of ticked repository names. */
export function useRepositoryPicker(): RepositoryPicker {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return {
    filter,
    setFilter,
    selected,
    clearSelection: () => setSelected(new Set()),
    toggle: (name) => setSelected((current) => toggled(current, name)),
    toggleAll: (names, allSelected) =>
      setSelected((current) => toggledAll(current, names, allSelected)),
  };
}
