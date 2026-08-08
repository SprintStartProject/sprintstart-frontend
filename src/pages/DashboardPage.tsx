import { useCallback, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/useAuth';
import { ChartColumn } from 'lucide-react';
import { centralSpringToken } from '../styles/tokens';
import { PageHeader } from '../components/layout/PageHeader';
import { Game2048Modal } from '../features/game2048/components/Game2048Modal';
import { useGame2048Shortcut } from '../features/game2048/hooks/useGame2048Shortcut';
import { DinoGameModal } from '../features/dino/components/DinoGameModal';
import { useDinoShortcut } from '../features/dino/hooks/useDinoShortcut';
import { SpaceInvadersModal } from '../features/space-invaders/components/SpaceInvadersModal';
import { useSpaceInvadersShortcut } from '../features/space-invaders/hooks/useSpaceInvadersShortcut';
import { DashboardHero } from '../features/dashboard/components/DashboardHero';
import { NextStepWidget } from '../features/dashboard/components/NextStepWidget';
import { KnowledgeBaseWidget } from '../features/dashboard/components/KnowledgeBaseWidget';
import { QuickChatWidget } from '../features/dashboard/components/QuickChatWidget';
import { SkillsStrip } from '../features/dashboard/components/SkillsStrip';

/**
 * Central hub displayed after login.
 * Shows high-level project status and provides quick actions for the user.
 */
export function DashboardPage() {
    const { profile } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());

    // 2048 easter egg: Ctrl+Shift+2 opens the game in a modal.
    const [game2048Open, setGame2048Open] = useState(false);
    const openGame2048 = useCallback(() => setGame2048Open(true), []);
    useGame2048Shortcut(openGame2048);

    // Dino easter egg: Ctrl+Shift+1 opens the runner in a modal.
    // Bypasses the `dinoUnlocked` gate that the sidebar/chat use — the
    // dashboard chord is a true easter egg, always available.
    const [dinoOpen, setDinoOpen] = useState(false);
    const openDino = useCallback(() => setDinoOpen(true), []);
    useDinoShortcut(openDino);

    // Space Invaders easter egg: Ctrl+Shift+3 opens the game in a modal.
    const [invadersOpen, setInvadersOpen] = useState(false);
    const openInvaders = useCallback(() => setInvadersOpen(true), []);
    useSpaceInvadersShortcut(openInvaders);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);
    
    // Safely fallback to 'User' if profile isn't loaded yet
    const displayName = profile?.firstName || profile?.username || 'User';

    const formattedDate = currentTime.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const formattedTime = currentTime.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const hour = currentTime.getHours();
    let greeting = 'Good evening';
    if (hour < 6) greeting = 'Good night';
    else if (hour < 12) greeting = 'Good morning';
    else if (hour < 17) greeting = 'Good afternoon';

    return (
        <div className="min-h-screen">
            <header className="border-b border-app-border bg-app-bg">
                <div className="app-page-frame py-6">
                    <PageHeader
                        icon={ChartColumn}
                        title="Dashboard"
                        subtitle="Your central workspace for project status, onboarding progress and next actions."
                    />
                </div>
            </header>

            <main className="app-page-frame space-y-5 py-6 pb-24 lg:py-8">
                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={centralSpringToken}
                >
                    <DashboardHero
                        greeting={greeting}
                        displayName={displayName}
                        formattedDate={formattedDate}
                        formattedTime={formattedTime}
                        profileIcon={profile?.profileIcon}
                        fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : displayName}
                        seed={profile?.id}
                    />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...centralSpringToken, delay: 0.08 }}
                    className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                >
                    <NextStepWidget />
                    <KnowledgeBaseWidget />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...centralSpringToken, delay: 0.16 }}
                >
                    <QuickChatWidget />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...centralSpringToken, delay: 0.24 }}
                >
                    <SkillsStrip />
                </motion.div>
            </main>

            <Game2048Modal open={game2048Open} onClose={() => setGame2048Open(false)} />
            <DinoGameModal open={dinoOpen} onClose={() => setDinoOpen(false)} />
            <SpaceInvadersModal open={invadersOpen} onClose={() => setInvadersOpen(false)} />
        </div>
    );
}
