import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { Rocket } from 'lucide-react';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [firstname, setFirstname] = useState('');
    const [lastname, setLastname] = useState('');
    const { login, status } = useAuth();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (username.trim() && firstname.trim() && lastname.trim()) {
            void login(username.trim(), firstname.trim(), lastname.trim());
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-app-bg p-4 text-app-text sm:p-6">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl backdrop-blur-sm sm:p-10">
                <div className="flex flex-col items-center space-y-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-app-brand shadow-lg">
                        <Rocket className="h-7 w-7 text-white" />
                    </div>

                    <div className="space-y-1 text-center">
                        <h2 className="text-2xl font-bold tracking-tight text-app-text sm:text-3xl">
                            SprintStart
                        </h2>

                        <p className="text-sm text-app-text-subtle">
                            Sign in to your account to continue
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label
                                htmlFor="username"
                                className="mb-1.5 block text-sm font-medium text-app-text-muted"
                            >
                                Username
                            </label>

                            <input
                                id="username"
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full rounded-xl border border-app-border-muted bg-app-surface-muted px-4 py-3 text-app-text placeholder:text-app-text-disabled transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-focus"
                                placeholder="e.g. jdoe"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="firstname"
                                    className="mb-1.5 block text-sm font-medium text-app-text-muted"
                                >
                                    First Name
                                </label>

                                <input
                                    id="firstname"
                                    type="text"
                                    required
                                    value={firstname}
                                    onChange={(e) => setFirstname(e.target.value)}
                                    className="w-full rounded-xl border border-app-border-muted bg-app-surface-muted px-4 py-3 text-app-text placeholder:text-app-text-disabled transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-focus"
                                    placeholder="John"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="lastname"
                                    className="mb-1.5 block text-sm font-medium text-app-text-muted"
                                >
                                    Last Name
                                </label>

                                <input
                                    id="lastname"
                                    type="text"
                                    required
                                    value={lastname}
                                    onChange={(e) => setLastname(e.target.value)}
                                    className="w-full rounded-xl border border-app-border-muted bg-app-surface-muted px-4 py-3 text-app-text placeholder:text-app-text-disabled transition-colors focus:border-app-brand focus:outline-none focus:ring-1 focus:ring-app-focus"
                                    placeholder="Doe"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={status === 'loading'}
                        className="w-full rounded-xl bg-app-brand px-4 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-app-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {status === 'loading' ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="pt-2 text-center text-xs text-app-text-disabled">
                    Tip: Use any username. New usernames will be registered automatically.
                </div>
            </div>
        </div>
    );
}