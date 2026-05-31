import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Rocket, ShieldAlert } from 'lucide-react';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const [isOfflineMode, setIsOfflineMode] = useState(() => 
        localStorage.getItem('sprintstart_offline_mode') === 'true'
    );
    const { login, status } = useAuth();

    const handleToggleOffline = () => {
        const newValue = !isOfflineMode;
        setIsOfflineMode(newValue);
        localStorage.setItem('sprintstart_offline_mode', newValue.toString());
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username.trim() && firstname.trim() && lastname.trim()) {
            void login(username.trim(), firstname.trim(), lastname.trim());
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 sm:p-6">
            {/* Offline Mode Toggle (Bottom Left) */}
            <div className="fixed bottom-6 left-6 flex flex-col gap-2">
                <button
                    onClick={handleToggleOffline}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                        isOfflineMode 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                            : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                >
                    <ShieldAlert className={`w-3.5 h-3.5 ${isOfflineMode ? 'text-emerald-400' : 'text-slate-500'}`} />
                    Offline Mode: {isOfflineMode ? 'ON' : 'OFF'}
                </button>
            </div>

            <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-10 backdrop-blur-sm">
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40">
                        <Rocket className="h-7 w-7 text-white" />
                    </div>
                    <div className="space-y-1 text-center">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">SprintStart</h2>
                        <p className="text-slate-400 text-sm">Sign in to your account to continue</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="e.g. jdoe"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="firstname" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    First Name
                                </label>
                                <input
                                    id="firstname"
                                    type="text"
                                    required
                                    value={firstname}
                                    onChange={(e) => setFirstname(e.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="John"
                                />
                            </div>
                            <div>
                                <label htmlFor="lastname" className="block text-sm font-medium text-slate-300 mb-1.5">
                                    Last Name
                                </label>
                                <input
                                    id="lastname"
                                    type="text"
                                    required
                                    value={lastname}
                                    onChange={(e) => setLastname(e.target.value)}
                                    className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition-all hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {status === 'loading' ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="text-center text-xs text-slate-500 pt-2">
                    Tip: Use any username. New usernames will be registered automatically.
                </div>
            </div>
        </div>
    );
}
