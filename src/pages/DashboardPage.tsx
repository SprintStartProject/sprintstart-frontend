import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { UserAvatar } from '../components/common/UserAvatar';
import { Link } from 'react-router-dom';
import { Bot, BookOpen, Sparkles, ChartColumn } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Game2048Modal } from '../features/game2048/components/Game2048Modal';
import { useGame2048Shortcut } from '../features/game2048/hooks/useGame2048Shortcut';
import { DinoGameModal } from '../features/dino/components/DinoGameModal';
import { useDinoShortcut } from '../features/dino/hooks/useDinoShortcut';
import { SpaceInvadersModal } from '../features/space-invaders/components/SpaceInvadersModal';
import { useSpaceInvadersShortcut } from '../features/space-invaders/hooks/useSpaceInvadersShortcut';

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
                {/* Centered Greeting and Date/Time */}
                <div className="flex flex-1 flex-col items-center justify-center space-y-6">
                    <div className="text-center space-y-2">
                        <p className="text-xl font-medium text-app-text/70">{formattedDate}</p>
                        <p className="text-3xl font-light text-app-text/90">{formattedTime}</p>
                    </div>
                    
                    <div className="flex items-center gap-4 pb-6">
                        <h2 className="text-5xl font-bold tracking-tight text-app-text">
                            {greeting}, {displayName}
                        </h2>
                        <UserAvatar 
                            size={48} 
                            profileIcon={profile?.profileIcon} 
                            fallbackName={profile ? `${profile.firstName} ${profile.lastName}`.trim() : displayName}
                            seed={profile?.id}
                        />
                    </div>

                    {/* Quick Links */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-8">
                        <Link to="/chat" className="flex flex-col items-center justify-center p-8 bg-app-surface border border-app-border rounded-2xl hover:border-app-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                            <Bot className="w-10 h-10 mb-4 text-blue-500 group-hover:scale-110 transition-all duration-300" />
                            <h3 className="text-xl font-semibold text-app-text group-hover:text-blue-600 transition-colors">Chat</h3>
                            <p className="text-app-text/60 text-center mt-2">Talk to the AI assistant</p>
                        </Link>
                        
                        <Link to="/knowledge-base" className="flex flex-col items-center justify-center p-8 bg-app-surface border border-app-border rounded-2xl hover:border-app-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                            <BookOpen className="w-10 h-10 mb-4 text-blue-500 group-hover:scale-110 transition-all duration-300" />
                            <h3 className="text-xl font-semibold text-app-text group-hover:text-blue-600 transition-colors">Knowledge Base</h3>
                            <p className="text-app-text/60 text-center mt-2">Explore company resources</p>
                        </Link>

                        <Link to="/onboarding" className="flex flex-col items-center justify-center p-8 bg-app-surface border border-app-border rounded-2xl hover:border-app-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                            <Sparkles className="w-10 h-10 mb-4 text-blue-500 group-hover:scale-110 transition-all duration-300" />
                            <h3 className="text-xl font-semibold text-app-text group-hover:text-blue-600 transition-colors">Onboarding</h3>
                            <p className="text-app-text/60 text-center mt-2">Continue your setup</p>
                        </Link>
                    </div>
                </div>
            </main>

            <Game2048Modal open={game2048Open} onClose={() => setGame2048Open(false)} />
            <DinoGameModal open={dinoOpen} onClose={() => setDinoOpen(false)} />
            <SpaceInvadersModal open={invadersOpen} onClose={() => setInvadersOpen(false)} />
        </div>
    );
}
