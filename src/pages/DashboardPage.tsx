import { ChartColumn } from "lucide-react";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../context/useAuth";
import { UserAvatar } from "../components/common/UserAvatar";

/**
 * Central hub displayed after login.
 * Shows high-level project status and provides quick actions for the user.
 */
export function DashboardPage() {
    const { profile } = useAuth();

    const displayName = profile?.firstName || profile?.username || "User";

    return (
        <div className="min-h-screen bg-app-bg">
            <header className="border-b border-app-border bg-app-bg">
                <div className="app-page-frame py-6">
                    <PageHeader
                        icon={ChartColumn}
                        title="Dashboard"
                        subtitle="Your central workspace for project status, onboarding progress and next actions."
                    />
                </div>
            </header>

            <main className="app-page-frame flex min-h-[70vh] flex-col p-8">
                <div className="flex flex-1 items-center justify-center">
                    <h1 className="text-5xl font-bold tracking-tight text-app-text">
                        Hello, {displayName}
                    </h1>
                </div>

                <div className="flex justify-center pb-12">
                    <UserAvatar
                        size={100}
                        profileIcon={profile?.profileIcon}
                        fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : displayName}
                        seed={profile?.id}
                    />
                </div>
            </main>
        </div>
    );
}
