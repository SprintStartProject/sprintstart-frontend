import { useState, type Dispatch, type SetStateAction } from "react";
import type { DraftSource } from "./addSourceKit";

export type WizardDraft = {
  name: string;
  /** Turns the "Name is required" message on only after the user left the field or tried to advance. */
  nameTouched: boolean;
  setNameTouched: (touched: boolean) => void;
  /**
   * A name conflict reported by the backend at commit time (the client list may be stale).
   * Cleared as soon as the name is edited.
   */
  nameServerError: string;
  setNameServerError: (message: string) => void;
  changeName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  industry: string;
  setIndustry: (value: string) => void;
  managerId: string;
  setManagerId: (id: string) => void;
  selectedUserIds: Set<string>;
  setSelectedUserIds: Dispatch<SetStateAction<Set<string>>>;
  sources: DraftSource[];
  setSources: Dispatch<SetStateAction<DraftSource[]>>;
  createdProjectId: string;
  setCreatedProjectId: (id: string) => void;
  /** Back to an empty wizard. */
  reset: () => void;
};

/**
 * Everything the user drafts across the steps, held locally until the single commit. The id of the
 * project the commit created lives here too, so a retry reuses it instead of making a second one.
 */
export function useWizardDraft(): WizardDraft {
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [nameServerError, setNameServerError] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [managerId, setManagerId] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(() => new Set());
  const [sources, setSources] = useState<DraftSource[]>([]);
  const [createdProjectId, setCreatedProjectId] = useState("");

  const changeName = (value: string) => {
    setName(value);
    // Any edit invalidates a stale server-side "already exists".
    if (nameServerError) setNameServerError("");
  };

  const reset = () => {
    setName("");
    setNameTouched(false);
    setNameServerError("");
    setDescription("");
    setIndustry("");
    setManagerId("");
    setSelectedUserIds(new Set());
    setSources([]);
    setCreatedProjectId("");
  };

  return {
    name,
    nameTouched,
    setNameTouched,
    nameServerError,
    setNameServerError,
    changeName,
    description,
    setDescription,
    industry,
    setIndustry,
    managerId,
    setManagerId,
    selectedUserIds,
    setSelectedUserIds,
    sources,
    setSources,
    createdProjectId,
    setCreatedProjectId,
    reset,
  };
}
