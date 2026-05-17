import {
  MessageSquare,
  Rocket,
  BookOpen,
  User,
  BarChart3,
  TrendingUp,
  HandshakeIcon,
  Target,
  Settings,
  Database,
  FileText,
  LucideIcon,
} from 'lucide-react';
import { UserRole } from '../../context/RoleContext';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
  roles: UserRole[];
  section: 'base' | 'project-manager' | 'hr' | 'admin';
}

export const navigationItems: NavItem[] = [
  // Base Zone - Always visible (except onboarding)
  {
    id: 'chat',
    label: 'Chat',
    icon: MessageSquare,
    path: '/',
    roles: ['New Project Member', 'Existing Project Member', 'Project Manager', 'HR', 'Admin'],
    section: 'base',
  },
  {
    id: 'onboarding',
    label: 'My Onboarding',
    icon: Rocket,
    path: '/onboarding',
    roles: ['New Project Member'],
    section: 'base',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    path: '/dashboard',
    roles: ['New Project Member', 'Existing Project Member', 'Project Manager', 'HR', 'Admin'],
    section: 'base',
  },
  {
    id: 'knowledge',
    label: 'Knowledge Base',
    icon: BookOpen,
    path: '/knowledge',
    roles: ['New Project Member', 'Existing Project Member', 'Project Manager', 'HR', 'Admin'],
    section: 'base',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    path: '/profile',
    roles: ['New Project Member', 'Existing Project Member', 'Project Manager', 'HR', 'Admin'],
    section: 'base',
  },

  // Project Manager Zone
  {
    id: 'knowledge-quality',
    label: 'Knowledge Quality',
    icon: TrendingUp,
    path: '/knowledge-quality',
    roles: ['Project Manager'],
    section: 'project-manager',
  },

  // HR Zone
  {
    id: 'handover',
    label: 'Handover Management',
    icon: HandshakeIcon,
    path: '/handover',
    roles: ['HR'],
    section: 'hr',
  },
  {
    id: 'skill-gaps',
    label: 'Skill Gaps',
    icon: Target,
    path: '/skill-gaps',
    roles: ['HR'],
    section: 'hr',
  },

  // Admin Zone
  {
    id: 'access-management',
    label: 'Access Management',
    icon: Settings,
    path: '/access-management',
    roles: ['Admin'],
    section: 'admin',
  },
  {
    id: 'data-ingestion',
    label: 'Data Ingestion',
    icon: Database,
    path: '/data-ingestion',
    roles: ['Admin'],
    section: 'admin',
  },
  {
    id: 'system-logs',
    label: 'System Logs',
    icon: FileText,
    path: '/system-logs',
    roles: ['Admin'],
    section: 'admin',
  },
];

export function getVisibleNavItems(role: UserRole): NavItem[] {
  if (role === 'Show all') return navigationItems;
  return navigationItems.filter((item) => item.roles.includes(role));
}
