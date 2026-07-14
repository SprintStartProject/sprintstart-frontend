import { useState } from 'react';
import { UserAvatar } from '../../../components/common/UserAvatar';
import type { UserProfile } from '../../../services/types';

type AccountFormProps = {
    profile: UserProfile;
    onUpdate: (data: Partial<UserProfile>) => Promise<void>;
};

/**
 * Form component for updating user account information, including name, email, and avatar.
 */
export function AccountForm({ profile, onUpdate }: AccountFormProps) {
    const [firstName, setFirstName] = useState(profile.firstName || '');
    const [lastName, setLastName] = useState(profile.lastName || '');
    const [email, setEmail] = useState(profile.email || '');
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
        <div className="rounded-xl border border-app-border bg-app-surface p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-app-text">Account Information</h2>
            
            <div className="mb-6 flex items-center gap-6">
                <div className="relative group">
                    <UserAvatar 
                        size={80}
                        profileIcon={profileIcon}
                        fallbackName={`${profile.firstName} ${profile.lastName}`.trim()}
                        seed={profile.id}
                    />
                </div>
                <div>
                    <h3 className="text-lg font-medium text-app-text">{profile.username}</h3>
                    <p className="mb-2 text-sm font-medium uppercase tracking-wider text-app-text-muted">
                        {profile.projectRoles.length > 0
                            ? profile.projectRoles.map((role) => role.name).join(', ')
                            : 'NO ROLE ASSIGNED'}
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenIconPicker}
                        className="rounded-md border border-app-border bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text transition-colors hover:bg-app-surface-hover focus:outline-none focus:ring-2 focus:ring-app-brand"
                    >
                        {isChoosingIcon ? 'Cancel' : 'Choose Icon'}
                    </button>
                </div>
            </div>

            {isChoosingIcon && (
                <div className="mb-6 rounded-lg border border-app-border bg-app-bg p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-medium text-app-text">Select an Avatar</span>
                        <button type="button" onClick={generateOptions} className="text-xs font-medium text-app-brand hover:underline">Shuffle Options</button>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {iconOptions.map(seed => (
                            <button
                                key={seed}
                                type="button"
                                onClick={() => handleSelectIcon(seed)}
                                className="shrink-0 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-app-brand focus:ring-offset-2 focus:ring-offset-app-bg"
                                aria-label={`Select avatar ${seed}`}
                            >
                                <UserAvatar size={48} profileIcon={seed} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                        <label htmlFor="firstName" className="text-sm font-medium text-app-text">First Name</label>
                        <input
                            id="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-brand"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="lastName" className="text-sm font-medium text-app-text">Last Name</label>
                        <input
                            id="lastName"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-brand"
                            required
                        />
                    </div>
                </div>
                
                <div className="space-y-1">
                    <label htmlFor="email" className="text-sm font-medium text-app-text">Email Address</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-app-text transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-brand"
                        required
                    />
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="rounded-lg bg-app-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-app-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
