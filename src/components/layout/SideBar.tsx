import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Home, Languages, MessageSquare, Rocket, Sun } from 'lucide-react';

type SidebarNavItem = {
    label: string;
    path: string;
    icon: ReactNode;
};

const navItems: SidebarNavItem[] = [
    {
        label: 'Home',
        path: '/',
        icon: <Home className="h-[18px] w-[18px] shrink-0 transition-colors" />,
    },
    {
        label: 'Chat',
        path: '/chat',
        icon: <MessageSquare className="h-[18px] w-[18px] shrink-0 transition-colors" />,
    },
    {
        label: 'Knowledge Base',
        path: '/knowledge-base',
        icon: <BookOpen className="h-[18px] w-[18px] shrink-0 transition-colors" />,
    },
    {
        label: 'OnBoarding',
        path: '/onboarding',
        icon: <Rocket className="h-[18px] w-[18px] shrink-0 transition-colors" />,
    },
];

function getNavLinkClass(isActive: boolean): string {
    return [
        'group flex h-[40px] items-center gap-[12px] rounded-[8px] px-[12px] text-[14px] font-medium leading-none transition-all duration-200',
        isActive
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30 [&>svg]:text-white'
            : 'text-slate-300 hover:bg-slate-900 hover:text-white [&>svg]:text-slate-400 hover:[&>svg]:text-white',
    ].join(' ');
}

export function SideBar() {
    return (
        <aside className="sticky top-0 flex h-screen w-[286px] shrink-0 flex-col border-r border-slate-800 bg-gray-950">
            <div className="flex items-center gap-3 px-[24px] py-[24px]">
                <div className="flex h-[32px] w-[32px] items-center justify-center rounded-[8px] bg-blue-600 shadow-lg shadow-blue-950/40">
                    <Rocket className="h-[18px] w-[18px] text-white" />
                </div>

                <h1 className="text-lg font-bold leading-none tracking-tight text-white">
                    SprintStart
                </h1>
            </div>

            <nav className="flex-1 space-y-[5px] px-[16px] py-[20px]">
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) => getNavLinkClass(isActive)}
                    >
                        {({ isActive }) => (
                            <>
                                {item.icon}

                                <span>{item.label}</span>

                                {isActive ? (
                                    <span className="ml-auto h-[6px] w-[6px] rounded-full bg-white" />
                                ) : null}
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="space-y-[12px] border-t border-slate-800 bg-slate-900/50 p-[16px]">
                <button
                    type="button"
                    className="flex h-[40px] w-full items-center justify-between rounded-[8px] px-[12px] text-[14px] font-medium leading-none text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
                >
                    <span className="flex items-center gap-[12px]">
                        <Languages className="h-[16px] w-[16px] text-slate-400" />
                        English
                        </span>

                        <span className="text-[10px] font-bold text-blue-500">
                        EN <span className="text-slate-500">/ DE</span>
                    </span>
                </button>

                <button
                    type="button"
                    className="flex h-[40px] w-full items-center justify-between rounded-[8px] px-[12px] text-[14px] font-medium leading-none text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
                >
                <span className="flex items-center gap-[12px]">
                    <Sun className="h-[16px] w-[16px] text-slate-400" />
                    Light Mode
                </span>
                    <span className="flex h-[16px] w-[32px] items-center justify-end rounded-full bg-blue-600 p-[4px]">
                        <span className="h-[8px] w-[8px] rounded-full bg-white" />
                    </span>
                </button>
            </div>
        </aside>
    );
}