import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Rocket } from 'lucide-react';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const { login, status } = useAuth();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (username.trim() && email.trim()) {
            void login(username.trim(), email.trim());
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-10 backdrop-blur-sm">
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/40">
                        <Rocket className="h-7 w-7 text-white" />
                    </div>
                    <div className="space-y-1 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-white">SprintStart</h2>
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
                                placeholder="Enter your username"
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                                Email (Mock)
                            </label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="name@company.com"
                            />
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
                    Tip: Use any username. New usernames will trigger the onboarding wizard.
                </div>
            </div>
        </div>
    );
}
