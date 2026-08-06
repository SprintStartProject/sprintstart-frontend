import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Key, MessageSquare, Palette, Rocket, Settings, User } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { PermissionGroup } from '../services/types';
import { PageHeader } from '../components/layout/PageHeader';
import { SettingsSection } from '../features/settings/components/SettingsSection';
import { ProfileSection } from '../features/settings/components/ProfileSection';
import { AppearanceSection } from '../features/settings/components/AppearanceSection';
import { ChatSection } from '../features/settings/components/ChatSection';
import { MomentsSection } from '../features/settings/components/MomentsSection';
import { TokensSection } from '../features/settings/components/TokensSection';
import { useDinoEasterEgg } from '../features/settings/hooks/useDinoEasterEgg';

type SectionId = 'profile' | 'appearance' | 'chat' | 'moments' | 'tokens';

type SectionDef = {
    id: SectionId;
    label: string;
    icon: typeof User;
    title: string;
    description: string;
    render: () => ReactNode;
};

const ALL_SECTIONS: ReadonlyArray<SectionDef> = [
    {
        id: 'profile',
        label: 'User Profile',
        icon: User,
        title: 'User Profile',
        description: 'Manage your account details, avatar and password.',
        render: () => <ProfileSection />,
    },
    {
        id: 'appearance',
        label: 'Appearance',
        icon: Palette,
        title: 'Appearance',
        description: 'Choose a light, dark, or system theme preference.',
        render: () => <AppearanceSection />,
    },
    {
        id: 'chat',
        label: 'Chat',
        icon: MessageSquare,
        title: 'Chat',
        description: 'How the assistant shows progress while generating an answer.',
        render: () => <ChatSection />,
    },
    {
        id: 'moments',
        label: 'Moments',
        icon: Rocket,
        title: 'Moments',
        description: 'Small decorative extras that live outside the onboarding flow.',
        render: () => <MomentsSection />,
    },
    {
        id: 'tokens',
        label: 'Access Tokens',
        icon: Key,
        title: 'Access Tokens',
        description: 'GitHub Personal Access Tokens used for repository ingestion.',
        render: () => <TokensSection />,
    },
];

const PAT_ALLOWED_GROUPS: ReadonlySet<PermissionGroup> = new Set([
    PermissionGroup.PM,
    PermissionGroup.HR,
    PermissionGroup.ADMIN,
]);

/**
 * Central settings hub — a single scrollable page grouping the user's
 * personal configuration (profile, theme, chat, access tokens) in one
 * predictable place. The PAT section is only shown to PM/HR/ADMIN. A hidden
 * dino-game easter-egg (triple-click the cogwheel) lives in its own hook.
 */
export function SettingsPage() {
    const { profile } = useAuth();
    const canManagePats =
        profile !== null && PAT_ALLOWED_GROUPS.has(profile.permissionGroup);

    const dino = useDinoEasterEgg();

    const sections = useMemo(
        () =>
            canManagePats
                ? ALL_SECTIONS
                : ALL_SECTIONS.filter((s) => s.id !== 'tokens'),
        [canManagePats],
    );

    return (
        <div className="h-full min-h-screen w-full bg-app-bg">
            <header className="border-b border-app-border bg-app-bg">
                <div className="app-page-content py-6">
                    <div className="max-w-4xl">
                        <PageHeader
                            icon={Settings}
                            title="Settings"
                            subtitle="Manage your profile, appearance and access tokens in one place."
                            onIconClick={dino.handleIconClick}
                        />
                    </div>
                </div>
            </header>

            <main className="app-page-content py-6 md:py-8">
                <div className="mx-auto max-w-4xl">
                    <nav
                        aria-label="Settings sections"
                        className="mb-8 flex gap-2 overflow-x-auto pb-1"
                    >
                        {sections.map(({ id, label, icon: Icon }) => (
                            <a
                                key={id}
                                href={`#${id}`}
                                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-app-surface-hover hover:text-app-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus"
                            >
                                <Icon className="h-4 w-4" aria-hidden />
                                {label}
                            </a>
                        ))}
                    </nav>

                    <div className="space-y-10">
                        {sections.map((section) => (
                            <SettingsSection
                                key={section.id}
                                id={section.id}
                                icon={section.icon}
                                title={section.title}
                                description={section.description}
                            >
                                {section.render()}
                            </SettingsSection>
                        ))}
                    </div>
                </div>
            </main>

            {dino.toast && (
                <div
                    role="status"
                    aria-live="polite"
                    className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 rounded-full bg-app-brand px-4 py-2 text-sm font-medium text-white shadow-lg"
                >
                    {dino.toast}
                </div>
            )}
        </div>
    );
}
