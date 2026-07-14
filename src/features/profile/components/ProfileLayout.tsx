import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/useAuth';
import { userService } from '../../../services/userService';
import type { UserProfile } from '../../../services/types';
import { AccountForm } from './AccountForm';
import { PasswordForm } from './PasswordForm';
import { Loader2, UserCircle } from 'lucide-react';
import { PageHeader } from '../../../components/layout/PageHeader';

/**
 * Wrapper layout for the profile settings view.
 * Coordinates loading of the user profile and passes data to specific forms.
 */
export function ProfileLayout() {
    const { refetchProfile } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        userService
            .getProfile()
            .then((data) => {
                if (mounted && data) {
                    setProfile(data);
                }
                if (mounted) setIsLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load profile', err);
                if (mounted) setIsLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
        try {
            // Workaround: Backend requires projectsId on PATCH requests
            const payload = {
                ...updates,
                projectIds: profile?.projectIds || []
            };
            const updatedProfile = await userService.updateProfile(payload);
            setProfile(updatedProfile);
            await refetchProfile();
        } catch (error) {
            console.error('Failed to update profile', error);
            throw error;
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-app-brand" />
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="flex h-full w-full items-center justify-center text-app-text-muted">
                Failed to load profile data.
            </div>
        );
    }

    return (
        <>
            <header className="border-b border-app-border bg-app-bg">
                <div className="app-page-content py-6">
                    <div className="max-w-4xl">
                        <PageHeader
                            icon={UserCircle}
                            title="User Profile"
                            subtitle="Manage your account details, profile appearance and password."
                        />
                    </div>
                </div>
            </header>

            <main className="app-page-content py-6 md:py-8">
                <div className="max-w-4xl space-y-8">
                    <AccountForm
                        profile={profile}
                        onUpdate={handleUpdateProfile}
                    />
                    <PasswordForm />
                </div>
            </main>
        </>
    );
}
