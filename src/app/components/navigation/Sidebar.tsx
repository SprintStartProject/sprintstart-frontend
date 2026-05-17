import { Link, useLocation, useNavigate, Location } from 'react-router';
import { Moon, Sun, ChevronDown, Menu, X, Rocket, Languages } from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import { useRole, UserRole } from '../../context/RoleContext';
import { getVisibleNavItems, NavItem } from './NavigationConfig';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface SidebarItemProps {
  item: NavItem;
  isActive: boolean;
  onClick?: () => void;
}

function SidebarItem({ item, isActive, onClick }: SidebarItemProps) {
  const Icon = item.icon;
  const { t } = useTranslation();
  const label = t(`nav.${item.id.replace(/-/g, '_')}`, item.label);

  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group ${
        isActive
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
      }`}
    >
      <Icon
        className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}
      />
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="active-indicator"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-white"
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      )}
    </Link>
  );
}

interface SidebarContentProps {
  role: UserRole;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  location: Location;
  sections: Record<string, NavItem[]>;
  isRoleMenuOpen: boolean;
  setIsRoleMenuOpen: (open: boolean) => void;
  handleRoleChange: (role: UserRole) => void;
  setIsMobileMenuOpen: (open: boolean) => void;
}

function SidebarContent({
  role,
  theme,
  setTheme,
  location,
  sections,
  isRoleMenuOpen,
  setIsRoleMenuOpen,
  handleRoleChange,
  setIsMobileMenuOpen,
}: SidebarContentProps) {
  const roles: UserRole[] = [
    'New Project Member',
    'Existing Project Member',
    'Project Manager',
    'HR',
    'Admin',
    'Show all',
  ];
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'de' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 shadow-sm">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
          <Rocket className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight leading-none">
            SprintStart
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-6 overflow-y-auto py-4">
        {/* Sections */}
        {Object.entries(sections).map(([key, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={key} className="space-y-1">
              {key !== 'base' && (
                <p className="px-3 text-[10px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-2">
                  {key === 'pm' ? 'Project Management' : key.toUpperCase()}
                </p>
              )}
              {items.map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={
                    location.pathname === item.path ||
                    (item.path === '/' && location.pathname === '/')
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              ))}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 space-y-3">
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center gap-3">
            <Languages className="w-4 h-4" />
            <span>{i18n.language === 'en' ? 'English' : 'Deutsch'}</span>
          </div>
          <div className="flex gap-1">
            <span
              className={`text-[10px] ${i18n.language === 'en' ? 'font-bold text-blue-600' : 'text-gray-400'}`}
            >
              EN
            </span>
            <span className="text-[10px] text-gray-300">/</span>
            <span
              className={`text-[10px] ${i18n.language === 'de' ? 'font-bold text-blue-600' : 'text-gray-400'}`}
            >
              DE
            </span>
          </div>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <div
            className={`w-8 h-4 rounded-full p-1 transition-colors ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            <motion.div
              animate={{ x: theme === 'dark' ? 16 : 0 }}
              className="h-2 w-2 bg-white rounded-full shadow-sm"
            />
          </div>
        </button>

        {/* Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
            className="flex items-center gap-3 p-2 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 w-full group"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-200 dark:shadow-none ring-2 ring-white dark:ring-gray-900">
                {role === 'Show all'
                  ? 'SA'
                  : role
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate uppercase tracking-tight">
                {role}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate">
                {role === 'Show all' ? 'All Modules Enabled' : 'Organization Admin'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-transform ${isRoleMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {isRoleMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 p-1.5"
              >
                <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-700 mb-1">
                  Switch Perspective
                </p>
                {roles.map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between ${
                      r === role
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {r}
                    {r === role && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { role, setRole } = useRole();
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const visibleNavItems = getVisibleNavItems(role);

  // Group items by section
  const sections = {
    base: visibleNavItems.filter((i) => i.section === 'base'),
    pm: visibleNavItems.filter((i) => i.section === 'project-manager'),
    hr: visibleNavItems.filter((i) => i.section === 'hr'),
    admin: visibleNavItems.filter((i) => i.section === 'admin'),
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setIsRoleMenuOpen(false);
    navigate('/');
  };

  // Close mobile menu on resize if above breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const contentProps = {
    role,
    theme,
    setTheme,
    location,
    sections,
    isRoleMenuOpen,
    setIsRoleMenuOpen,
    handleRoleChange,
    setIsMobileMenuOpen,
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 h-screen sticky top-0 flex-col shrink-0">
        <SidebarContent {...contentProps} />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 z-50 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Rocket className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 dark:text-white tracking-tight">
            SprintStart
          </span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-gray-950 z-[60] flex flex-col"
            >
              <SidebarContent {...contentProps} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
