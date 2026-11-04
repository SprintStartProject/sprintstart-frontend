import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";

type DiscoveryFormProps = {
  ownerLabel: string;
  ownerPlaceholder: string;
  ownerInput: string;
  onOwnerInputChange: (value: string) => void;
  /** Locked while discovery or the parent's connect batch runs, or without any stored credential. */
  disabled: boolean;
  /** True while a fresh discovery (not "Load more") runs. */
  loading: boolean;
  credentialPicker: ReactNode;
  onSubmit: () => void;
};

/** The owner field, the credential picker and the Discover button. */
export function DiscoveryForm({
  ownerLabel,
  ownerPlaceholder,
  ownerInput,
  onOwnerInputChange,
  disabled,
  loading,
  credentialPicker,
  onSubmit,
}: DiscoveryFormProps) {
  return (
    <form
      className="grid grid-cols-[1fr_auto] items-end gap-3 sm:grid-cols-[1fr_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="col-span-2 sm:col-span-1">
        <label htmlFor="discovery-owner" className="text-sm font-medium text-app-text">
          {ownerLabel}
        </label>
        <Input
          id="discovery-owner"
          value={ownerInput}
          onChange={(event) => onOwnerInputChange(event.target.value)}
          disabled={disabled}
          placeholder={ownerPlaceholder}
          className="mt-2"
        />
      </div>

      {credentialPicker}

      <Button
        variant="primary"
        type="submit"
        disabled={disabled}
        loading={loading}
        icon={<Search className="h-4 w-4" />}
      >
        Discover
      </Button>
    </form>
  );
}
