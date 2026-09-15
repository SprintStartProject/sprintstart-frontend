import { useAuth } from "../../../context/useAuth";
import { TokenRow } from "../../settings/components/TokenRow";
import { AtlassianCredentialAddForm } from "../../settings/components/atlassian/AtlassianCredentialAddForm";
import { AtlassianCredentialRow } from "../../settings/components/atlassian/AtlassianCredentialRow";
import type { AtlassianCredentialDto } from "../../../services/sources/atlassianService";
import type { AccessAddFormProps, AccessRowProps } from "../types";

/**
 * Adapters between the source-specific credential UIs and the uniform
 * `AccessConnector` contract the registry is built from. They exist so the
 * registry itself stays a plain data module, and so the per-source rows and
 * forms keep their own props (and their `data-testid`s) instead of being bent
 * into a shared shape.
 */

/** GitHub PATs are identified by name alone, which is the whole payload. */
export function GithubTokenRow({ entry, onSaved }: AccessRowProps<string>) {
  return <TokenRow name={entry.payload} onSaved={onSaved} />;
}

export function AtlassianAccessRow({ entry, onSaved }: AccessRowProps<AtlassianCredentialDto>) {
  return <AtlassianCredentialRow credential={entry.payload} onSaved={onSaved} />;
}

/**
 * The Atlassian form needs a default account email, which every other
 * connector's form does not — so the profile is read here rather than
 * threaded through the view and the registry.
 */
export function AtlassianAccessAddForm({ onClose, onSaved }: AccessAddFormProps) {
  const { profile } = useAuth();

  return (
    <AtlassianCredentialAddForm
      defaultUserEmail={profile?.email ?? null}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
