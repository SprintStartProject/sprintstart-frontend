import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Field } from "../../../components/ui/Field";
import { Input } from "../../../components/ui/Input";
import { UserAvatar } from "../../../components/common/UserAvatar";
import type { UserProfile } from "../../../services/types";

type AccountFormProps = {
  profile: UserProfile;
  onUpdate: (data: Partial<UserProfile>) => Promise<void>;
};

/**
 * Form component for updating user account information, including name, email, and avatar.
 */
export function AccountForm({ profile, onUpdate }: AccountFormProps) {
  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [email, setEmail] = useState(profile.email || "");
  const [profileIcon, setProfileIcon] = useState(profile.profileIcon || profile.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isChoosingIcon, setIsChoosingIcon] = useState(false);
  const [iconOptions, setIconOptions] = useState<string[]>([]);

  const generateOptions = () => {
    const options = Array.from({ length: 5 }, () => Math.random().toString(36).substring(7));
    setIconOptions(options);
  };

  const handleOpenIconPicker = () => {
    if (!isChoosingIcon) {
      generateOptions();
    }
    setIsChoosingIcon(!isChoosingIcon);
  };

  const handleSelectIcon = (seed: string) => {
    setProfileIcon(seed);
    setIsChoosingIcon(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate({ firstName, lastName, email, profileIcon });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-app-text">Account Information</h2>

      <div className="mb-6 flex items-center gap-6">
        <div className="group relative">
          <UserAvatar
            size={80}
            profileIcon={profileIcon}
            fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
            seed={profile.id}
          />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-app-text">{profile.username}</h3>
          <p className="mb-2 text-sm font-medium tracking-wider text-app-text-muted uppercase">
            {profile.projectRoles.length > 0
              ? profile.projectRoles.map((role) => role.name).join(", ")
              : "NO ROLE ASSIGNED"}
          </p>
          <Button variant="secondary" size="sm" onClick={handleOpenIconPicker}>
            {isChoosingIcon ? "Cancel" : "Choose Icon"}
          </Button>
        </div>
      </div>

      {isChoosingIcon && (
        <div className="animate-in fade-in slide-in-from-top-2 mb-6 rounded-2xl border border-app-border bg-app-bg p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-app-text">Select an Avatar</span>
            <Button variant="ghost" size="sm" onClick={generateOptions}>
              Shuffle Options
            </Button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {iconOptions.map((seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => handleSelectIcon(seed)}
                className="shrink-0 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg focus:outline-none"
                aria-label={`Select avatar ${seed}`}
              >
                <UserAvatar size={48} profileIcon={seed} />
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="First Name" controlId="firstName">
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </Field>
          <Field label="Last Name" controlId="lastName">
            <Input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Field>
        </div>

        <Field label="Email Address" controlId="email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>

        <div className="pt-4">
          <Button variant="primary" type="submit" loading={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
