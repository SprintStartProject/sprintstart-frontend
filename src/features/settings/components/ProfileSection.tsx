import { Spinner } from '../../../components/ui/Spinner';
import { useProfile } from '../../../features/profile/useProfile';
import { AccountForm } from '../../../features/profile/components/AccountForm';
import { PasswordForm } from '../../../features/profile/components/PasswordForm';

/**
 * Profile section of the settings page. Reuses the existing account and
 * password forms (per story: reuse, no rebuild) and the shared `useProfile`
 * hook so profile loading and update behaviour match the legacy profile page.
 */
export function ProfileSection() {
    const { profile, isLoading, error, updateProfile } = useProfile();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Spinner size="lg" label="Loading" />
            </div>
        );
    }

    if (error || !profile) {
        return (
            <p className="py-8 text-center text-sm text-app-text-muted">
                {error ?? 'Failed to load profile data.'}
            </p>
        );
    }

    return (
        <div className="space-y-6">
            <AccountForm profile={profile} onUpdate={updateProfile} />
            <PasswordForm />
        </div>
    );
}
