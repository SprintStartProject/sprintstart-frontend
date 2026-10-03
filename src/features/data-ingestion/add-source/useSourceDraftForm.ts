import { useState } from "react";
import type { DraftSource } from "../connectors/draft.ts";
import { SOURCE_SYSTEMS, type SourceSystem } from "../connectors/sourceSystems.ts";
import type { AddSourceStep } from "./AddSourceFlow.tsx";

const FIRST_SOURCE_SYSTEM = SOURCE_SYSTEMS[0];

/**
 * The state of the add-source sub-flow that its host (the Add sources modal, the
 * create-project wizard) shares: whether it is open, which screen and type it is on,
 * and the drafts the current form reports. The form fields themselves live in each
 * connector's form, so leaving the detail screen discards them without any reset here.
 *
 * @param options.initiallyOpen - Whether the flow starts open, on the type grid.
 */
export function useSourceDraftForm({ initiallyOpen = false }: { initiallyOpen?: boolean } = {}) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [step, setStep] = useState<AddSourceStep>("type");
  const [type, setType] = useState<SourceSystem>(FIRST_SOURCE_SYSTEM);
  // Remounts the flow on each open so a new "Add source" starts from a clean slate.
  const [flowKey, setFlowKey] = useState(0);
  const [drafts, setDrafts] = useState<DraftSource[]>([]);
  // True while the desktop "add credential" companion is open, so the host's
  // modal slides left to make room for it beside itself.
  const [companionOpen, setCompanionOpen] = useState(false);

  /** Opens the flow on the type grid. */
  const open = () => {
    setDrafts([]);
    setType(FIRST_SOURCE_SYSTEM);
    setStep("type");
    setFlowKey((key) => key + 1);
    setIsOpen(true);
  };

  /** Closes the flow and forgets what its form reported. */
  const close = () => {
    setIsOpen(false);
    setDrafts([]);
  };

  /** Closes the flow and puts it back on the type grid, for a host that is reset as a whole. */
  const reset = () => {
    close();
    setStep("type");
    setType(FIRST_SOURCE_SYSTEM);
  };

  const selectType = (selected: SourceSystem) => {
    setType(selected);
    setStep("detail");
  };

  const backToTypes = () => {
    setStep("type");
    setDrafts([]);
  };

  /** Closes the flow and returns the drafts its form reported, for "Add to list". */
  const commit = (): DraftSource[] => {
    const staged = drafts;
    close();

    return staged;
  };

  return {
    isOpen,
    step,
    type,
    flowKey,
    /** What the current form describes; empty while it is incomplete. */
    drafts,
    /** Whether the current form is complete enough to stage or connect. */
    canAdd: drafts.length > 0,
    companionOpen,
    setCompanionOpen,
    /** Stable, so a form can report from an effect. */
    reportDrafts: setDrafts,
    open,
    close,
    reset,
    selectType,
    backToTypes,
    commit,
  };
}
