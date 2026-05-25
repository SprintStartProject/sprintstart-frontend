import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

interface AuthGuardProps {
    children: ReactNode;
}

interface LocationState {
    from?: {
        pathname: string;
    };
}

export function AuthGuard({ children }: AuthGuardProps) {
    const { status } = useAuth();
    const location = useLocation();

    if (status === 'loading') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-950">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    // 1. If not logged in, force to /login
    if (status === 'unauthenticated' && location.pathname !== '/login') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 2. Prevent authenticated users from going back to login
    if (status === 'authenticated' && location.pathname === '/login') {
        const state = location.state as LocationState;
        const from = state?.from?.pathname || '/';
        return <Navigate to={from} replace />;
    }

    return <>{children}</>;
}
