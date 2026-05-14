import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import { ThemeProvider } from './components/ThemeProvider';
import { RoleProvider } from './context/RoleContext';
import { Sidebar } from './components/navigation/Sidebar';
import { ChatHome } from './views/ChatHome';
import { PlaceholderView } from './views/PlaceholderView';
import { navigationItems, NavItem } from './components/navigation/NavigationConfig';
import { useTranslation } from 'react-i18next';
import { ComponentType } from 'react';

// Import existing screens
import { Admin } from './screens/Admin';
import { Dashboard } from './screens/Dashboard';
import { Handover } from './screens/Handover';
import { Knowledge } from './screens/Knowledge';
import { Onboarding } from './screens/Onboarding';
import { Profile } from './screens/Profile';

// Import newly implemented high-fidelity screens
import KnowledgeQuality from './screens/KnowledgeQuality';
import Statistics from './screens/Statistics';
import SkillGaps from './screens/SkillGaps';
import SystemLogs from './screens/SystemLogs';
import DataIngestion from './screens/DataIngestion';

// Layout component with sidebar
function AppLayout() {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden font-sans selection:bg-blue-100 dark:selection:bg-blue-900/40 selection:text-blue-700 dark:selection:text-blue-300">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 pt-16 lg:pt-0 overflow-y-auto relative">
        <Outlet />
      </main>
    </div>
  );
}

// Map paths to specific screen components
const SCREEN_MAP: Record<string, ComponentType> = {
  '/onboarding': Onboarding,
  '/knowledge': Knowledge,
  '/team-dashboard': Dashboard,
  '/handover': Handover,
  '/access-management': Admin,
  '/profile': Profile,
  '/knowledge-quality': KnowledgeQuality,
  '/statistics': Statistics,
  '/skill-gaps': SkillGaps,
  '/system-logs': SystemLogs,
  '/data-ingestion': DataIngestion,
};

function TranslatedPlaceholder({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  const label = t(`nav.${item.id.replace(/-/g, '_')}`, item.label);
  return (
    <PlaceholderView
      title={label}
      icon={item.icon}
      description={t('common.placeholder_description', { module: label })}
    />
  );
}

// Create router configuration
const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <ChatHome />,
      },
      ...navigationItems
        .filter((item) => item.path !== '/')
        .map((item) => {
          const ScreenComponent = SCREEN_MAP[item.path];
          return {
            path: item.path.startsWith('/') ? item.path.substring(1) : item.path,
            element: ScreenComponent ? <ScreenComponent /> : <TranslatedPlaceholder item={item} />,
          };
        }),
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <RoleProvider>
        <div className="antialiased text-gray-900 dark:text-gray-100 font-sans tracking-tight">
          <RouterProvider router={router} />
        </div>
      </RoleProvider>
    </ThemeProvider>
  );
}
