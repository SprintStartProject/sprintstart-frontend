import { useState } from "react";
import { Save } from "lucide-react";

import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { useToast } from "../../../context/useToast";
import type { RiskQuery } from "../../../services/offboardingTypes";
import { useSnapshots } from "../useSnapshots";

/** Stores the ranking on screen, under a name if one is given, so it can be compared later. */
export function SaveMapBar({ projectId, query }: { projectId: string; query: RiskQuery }) {
  const toast = useToast();
  const snapshots = useSnapshots(projectId);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await snapshots.save(query, label);
      setLabel("");
      toast.success("Risk map saved");
    } catch {
      toast.error("The risk map could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Name for the saved map"
        placeholder="Name this map (optional)"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        className="max-w-xs"
      />
      <Button
        variant="secondary"
        loading={saving}
        onClick={() => void save()}
        icon={<Save className="h-4 w-4" />}
      >
        Save this map
      </Button>
    </div>
  );
}
