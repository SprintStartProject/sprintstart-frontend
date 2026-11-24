import { useState } from "react";
import type { AreaAccent } from "../layout/areaAccents";
import {
  assignToGroup,
  dissolveGroup,
  newBoardGroup,
  readBoardGroups,
  writeBoardGroups,
  type BoardGroup,
} from "../layout/boardGroups";
import { useStoredFor } from "./useStoredFor";

/** The groups with one of them changed. */
function changing(groups: BoardGroup[], groupId: string, change: Partial<BoardGroup>) {
  return groups.map((group) => (group.id === groupId ? { ...group, ...change } : group));
}

type Params = {
  boardId: string;
  storedFor: string;
  /** The section being shown; an area taken away while it is open sends the view back to everything. */
  sectionId: string | null;
  setSectionId: (sectionId: string | null) => void;
};

/**
 * The named areas the hire has grouped their cards into, kept per board.
 *
 * An area is only ever a *display* grouping: the board's own order underneath is untouched, so
 * taking one away leaves its cards exactly where they are.
 */
export function useBoardAreas({ boardId, storedFor, sectionId, setSectionId }: Params) {
  const [groups, setGroups] = useStoredFor<BoardGroup[]>(
    storedFor,
    () => readBoardGroups(boardId),
    [],
  );
  /** Whether the "name your area" form is open over the board. */
  const [namingArea, setNamingArea] = useState(false);

  function saveGroups(next: BoardGroup[]) {
    setGroups(next);
    writeBoardGroups(boardId, next);
  }

  /**
   * Makes an empty area under the name it was given, and opens it.
   *
   * Empty is the point: an area made from the tool rail is a box somebody wants *before* they have
   * decided what goes in it -- "Paperwork", "Week two" -- and making them find a card to hang it off
   * first is the reason areas were only ever made by accident.
   */
  function handleNewArea(name: string) {
    const created = { ...newBoardGroup(groups), name };
    saveGroups([...groups, created]);
    setNamingArea(false);
    setSectionId(created.id);
  }

  /** Takes the area away and leaves its cards exactly where they are on the board. */
  function handleDissolveGroup(groupId: string) {
    saveGroups(dissolveGroup(groups, groupId));
    // A rail pointed at an area that is gone would show an empty pane, so the view falls
    // back to the whole board rather than to nothing.
    if (sectionId === groupId) setSectionId(null);
  }

  return {
    groups,
    saveGroups,
    namingArea,
    setNamingArea,
    handleNewArea,
    handleDissolveGroup,
    /** Puts a card in an area, or takes it out of one. */
    handleAssignGroup: (cardId: string, groupId: string | null) =>
      saveGroups(assignToGroup(groups, cardId, groupId)),
    handleRenameGroup: (groupId: string, name: string) =>
      saveGroups(changing(groups, groupId, { name })),
    /** Paints an area. A colour the hire chose, on a group the hire named -- see `areaAccents.ts`. */
    handleRecolourGroup: (groupId: string, accent: AreaAccent) =>
      saveGroups(changing(groups, groupId, { accent })),
    handleToggleGroup: (groupId: string) =>
      saveGroups(
        changing(groups, groupId, {
          collapsed: !groups.find((group) => group.id === groupId)?.collapsed,
        }),
      ),
  };
}
