import { motion } from 'motion/react';
import { useState } from 'react';
import {
  ChevronRight,
  FileText,
  Pencil,
  Plus,
  Settings,
  Trash2,
  X,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  email: string;
  primaryRole: string;
  secondaryRole: string;
  project: string;
}

interface Project {
  id: string;
  name: string;
  tags: string[];
  description: string;
  artifacts: string[];
}

const roleColors: Record<string, string> = {
  'Admin': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Project Manager': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'HR': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Member': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'New Member': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const tagColors = [
  'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
];

const mockUsers: User[] = [
  {
    id: '1',
    username: 'Max Mustermann',
    email: 'max.mustermann@example.com',
    primaryRole: 'Admin',
    secondaryRole: 'Project Manager',
    project: 'Project Alpha',
  },
  {
    id: '2',
    username: 'Anna Schmidt',
    email: 'anna.schmidt@example.com',
    primaryRole: 'Project Manager',
    secondaryRole: 'Member',
    project: 'Project Gamma',
  },
  {
    id: '3',
    username: 'Tom Weber',
    email: 'tom.weber@example.com',
    primaryRole: 'Member',
    secondaryRole: '',
    project: 'Project Alpha',
  },
];

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Project Alpha',
    tags: ['Java', 'CSS', 'React'],
    description: 'Main development project for the new platform architecture.',
    artifacts: ['API Documentation', 'Architecture Diagram', 'Requirements Doc', 'Test Plan'],
  },
  {
    id: '2',
    name: 'Project Beta',
    tags: ['Kotlin', 'LLM', 'Javascript'],
    description: 'Marketing campaign for product launch in Q2 2026.',
    artifacts: ['Campaign Brief', 'Marketing Assets', 'Timeline'],
  },
  {
    id: '3',
    name: 'Project Gamma',
    tags: ['React', 'CSS'],
    description: 'Research initiative for AI integration capabilities.',
    artifacts: ['Research Paper', 'Prototype Code', 'Analysis Report'],
  },
];

const getTagColor = (index: number) => tagColors[index % tagColors.length];

export function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'projects'>('users');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [projects, setProjects] = useState<Project[]>(mockProjects);

  const [userPanel, setUserPanel] = useState<{ user: User | null; isEditing: boolean }>({
    user: null,
    isEditing: false,
  });

  const [projectPanel, setProjectPanel] = useState<{ project: Project | null; isEditing: boolean }>({
    project: null,
    isEditing: false,
  });

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);

    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }

    setSelectedUsers(newSelected);
  };

  const openUserPanel = (user: User, editing: boolean = false) => {
    setProjectPanel({ project: null, isEditing: false });
    setUserPanel({ user, isEditing: editing });
  };

  const openProjectPanel = (project: Project, editing: boolean = false) => {
    setUserPanel({ user: null, isEditing: false });
    setProjectPanel({ project, isEditing: editing });
  };

  const closeUserPanel = () => {
    setUserPanel({ user: null, isEditing: false });
  };

  const closeProjectPanel = () => {
    setProjectPanel({ project: null, isEditing: false });
  };

  const closeActivePanel = () => {
    closeUserPanel();
    closeProjectPanel();
  };

  const deleteUser = (userId: string) => {
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== userId));

    setSelectedUsers((currentSelectedUsers) => {
      const nextSelectedUsers = new Set(currentSelectedUsers);
      nextSelectedUsers.delete(userId);
      return nextSelectedUsers;
    });

    if (userPanel.user?.id === userId) {
      closeUserPanel();
    }
  };

  const deleteProject = (projectId: string) => {
    setProjects((currentProjects) => currentProjects.filter((project) => project.id !== projectId));

    if (projectPanel.project?.id === projectId) {
      closeProjectPanel();
    }
  };

  const allUsersSelected = selectedUsers.size === users.length && users.length > 0;

  return (
      <div className="relative size-full min-h-screen flex bg-color-gray-950 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <header className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-red-500 shrink-0" />
                  Admin Console
                </h1>

                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  Manage users, roles, and project access
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
              <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                {users.length} Users
              </span>
                <span className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                {projects.length} Projects
              </span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-4 sm:px-6 sm:py-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800 rounded-xl w-full sm:w-auto overflow-x-auto">
                      <button
                          onClick={() => setActiveTab('users')}
                          className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                              activeTab === 'users'
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Users
                      </button>

                      <button
                          onClick={() => setActiveTab('projects')}
                          className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                              activeTab === 'projects'
                                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-gray-600'
                                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                      >
                        Projects
                      </button>
                    </div>

                    {activeTab === 'users' ? (
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md text-sm font-bold">
                          <Plus size={18} />
                          Add User
                        </button>
                    ) : (
                        <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md text-sm font-bold">
                          <Plus size={18} />
                          Add Project
                        </button>
                    )}
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  {activeTab === 'users' ? (
                      <div>
                        <div className="hidden md:block border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                          <div className="grid grid-cols-[50px_2fr_2fr_2fr_100px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center">
                              <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600 cursor-pointer"
                                  checked={allUsersSelected}
                                  onChange={(event) => {
                                    if (event.target.checked) {
                                      setSelectedUsers(new Set(users.map((user) => user.id)));
                                    } else {
                                      setSelectedUsers(new Set());
                                    }
                                  }}
                              />
                            </div>

                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              User
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Roles
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                              Project
                            </div>
                            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 text-right uppercase tracking-wide">
                              Actions
                            </div>
                          </div>

                          {users.map((user) => (
                              <div
                                  key={user.id}
                                  className="grid grid-cols-[50px_2fr_2fr_2fr_100px] gap-4 px-6 py-5 border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                              >
                                <div className="flex items-center">
                                  <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600 cursor-pointer"
                                      checked={selectedUsers.has(user.id)}
                                      onChange={() => toggleUserSelection(user.id)}
                                  />
                                </div>

                                <div className="flex flex-col justify-center min-w-0">
                                  <button
                                      onClick={() => openUserPanel(user, false)}
                                      className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-w-0"
                                  >
                                    <div className="text-gray-900 dark:text-white truncate">
                                      {user.username}
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400 truncate">
                                      {user.email}
                                    </div>
                                  </button>
                                </div>

                                <div className="flex flex-col justify-center gap-2 min-w-0">
                                  <div className="flex gap-2 flex-wrap">
                              <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                      roleColors[user.primaryRole] || roleColors.Member
                                  }`}
                              >
                                {user.primaryRole}
                              </span>

                                    {user.secondaryRole && user.secondaryRole.trim() !== '' && (
                                        <span
                                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                                roleColors[user.secondaryRole] || roleColors.Member
                                            }`}
                                        >
                                  {user.secondaryRole}
                                </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center min-w-0">
                            <span className="text-gray-900 dark:text-white truncate">
                              {user.project && user.project.trim() !== ''
                                  ? user.project
                                  : 'No project'}
                            </span>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <button
                                      onClick={() => openUserPanel(user, true)}
                                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                  >
                                    <Pencil
                                        size={18}
                                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    />
                                  </button>

                                  <button
                                      onClick={() => deleteUser(user.id)}
                                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </div>
                          ))}
                        </div>

                        <div className="md:hidden space-y-3">
                          <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
                              <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600 cursor-pointer"
                                  checked={allUsersSelected}
                                  onChange={(event) => {
                                    if (event.target.checked) {
                                      setSelectedUsers(new Set(users.map((user) => user.id)));
                                    } else {
                                      setSelectedUsers(new Set());
                                    }
                                  }}
                              />
                              Select all
                            </label>

                            <span className="text-xs font-bold text-gray-400">
                          {selectedUsers.size} selected
                        </span>
                          </div>

                          {users.map((user) => (
                              <div
                                  key={user.id}
                                  className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600 cursor-pointer shrink-0"
                                        checked={selectedUsers.has(user.id)}
                                        onChange={() => toggleUserSelection(user.id)}
                                    />

                                    <button
                                        onClick={() => openUserPanel(user, false)}
                                        className="text-left min-w-0"
                                    >
                                      <div className="text-gray-900 dark:text-white font-bold truncate">
                                        {user.username}
                                      </div>
                                      <div className="text-gray-600 dark:text-gray-400 text-sm truncate">
                                        {user.email}
                                      </div>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openUserPanel(user, true)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                    >
                                      <Pencil size={17} className="text-gray-500 dark:text-gray-400" />
                                    </button>

                                    <button
                                        onClick={() => deleteUser(user.id)}
                                        className="p-2 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                                    >
                                      <Trash2 size={17} className="text-red-600 dark:text-red-400" />
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 space-y-3">
                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                                      Roles
                                    </div>

                                    <div className="flex gap-2 flex-wrap">
                                <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                        roleColors[user.primaryRole] || roleColors.Member
                                    }`}
                                >
                                  {user.primaryRole}
                                </span>

                                      {user.secondaryRole && user.secondaryRole.trim() !== '' && (
                                          <span
                                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                                  roleColors[user.secondaryRole] || roleColors.Member
                                              }`}
                                          >
                                    {user.secondaryRole}
                                  </span>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                                      Project
                                    </div>

                                    <div className="text-sm text-gray-900 dark:text-white">
                                      {user.project && user.project.trim() !== ''
                                          ? user.project
                                          : 'No project'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                          ))}
                        </div>
                      </div>
                  ) : (
                      <div className="space-y-4">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 sm:p-6 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1 min-w-0">
                                  <h3 className="mb-3 text-gray-900 dark:text-white font-bold">
                                    {project.name}
                                  </h3>

                                  <div className="flex gap-2 mb-4 flex-wrap">
                                    {project.tags.map((tag, index) => (
                                        <span
                                            key={tag}
                                            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold ${getTagColor(
                                                index,
                                            )}`}
                                        >
                                  {tag}
                                </span>
                                    ))}
                                  </div>

                                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                                    {project.description}
                                  </p>

                                  <div className="mt-4 text-xs font-bold text-gray-400 uppercase tracking-wide">
                                    {project.artifacts.length} Sources / Artifacts
                                  </div>
                                </div>

                                <button
                                    onClick={() => openProjectPanel(project, false)}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 sm:p-2 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors sm:ml-4 shrink-0 text-sm font-bold text-gray-700 dark:text-gray-300"
                                >
                                  <span className="sm:hidden">Open details</span>
                                  <ChevronRight
                                      size={22}
                                      className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                  />
                                </button>
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>

        {(userPanel.user || projectPanel.project) && (
            <button
                type="button"
                aria-label="Close details panel"
                onClick={closeActivePanel}
                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] lg:hidden"
            />
        )}

        {userPanel.user && (
            <motion.aside
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-y-0 right-0 z-40 flex h-screen w-[min(92vw,24rem)] max-w-full flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl lg:static lg:z-auto lg:h-auto lg:w-96 lg:shrink-0 lg:shadow-xl"
            >
              <div className="flex items-center justify-between gap-4 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <div className="min-w-0">
                  <h3 className="text-gray-900 dark:text-white font-bold">User Details</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {userPanel.user.email}
                  </p>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {!userPanel.isEditing ? (
                      <button
                          onClick={() => setUserPanel({ ...userPanel, isEditing: true })}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Pencil
                            size={18}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        />
                      </button>
                  ) : (
                      <button
                          onClick={() => setUserPanel({ ...userPanel, isEditing: false })}
                          className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-bold"
                      >
                        Save
                      </button>
                  )}

                  <button
                      onClick={() => deleteUser(userPanel.user!.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  </button>

                  <button
                      onClick={closeUserPanel}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X
                        size={18}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-sm">
                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Username
                  </label>

                  {userPanel.isEditing ? (
                      <input
                          type="text"
                          defaultValue={userPanel.user.username}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1 break-words">
                        {userPanel.user.username}
                      </div>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Email
                  </label>

                  {userPanel.isEditing ? (
                      <input
                          type="email"
                          defaultValue={userPanel.user.email}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-600 dark:text-gray-400 px-1 break-words">
                        {userPanel.user.email}
                      </div>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Primary Role
                  </label>

                  {userPanel.isEditing ? (
                      <select
                          defaultValue={userPanel.user.primaryRole}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option>Admin</option>
                        <option>Project Manager</option>
                        <option>Member</option>
                        <option>HR</option>
                        <option>New Member</option>
                      </select>
                  ) : (
                      <span
                          className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold ${
                              roleColors[userPanel.user.primaryRole] || roleColors.Member
                          }`}
                      >
                  {userPanel.user.primaryRole}
                </span>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Secondary Role
                  </label>

                  {userPanel.isEditing ? (
                      <select
                          defaultValue={userPanel.user.secondaryRole}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="">None</option>
                        <option>Admin</option>
                        <option>Project Manager</option>
                        <option>Member</option>
                        <option>HR</option>
                        <option>New Member</option>
                      </select>
                  ) : (
                      <span
                          className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold ${
                              userPanel.user.secondaryRole
                                  ? roleColors[userPanel.user.secondaryRole] || roleColors.Member
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                  {userPanel.user.secondaryRole || 'None'}
                </span>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Project
                  </label>

                  {userPanel.isEditing ? (
                      <select
                          defaultValue={userPanel.user.project}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      >
                        <option value="">None</option>
                        {projects.map((project) => (
                            <option key={project.id}>{project.name}</option>
                        ))}
                      </select>
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1 break-words">
                        {userPanel.user.project || 'None'}
                      </div>
                  )}
                </div>
              </div>
            </motion.aside>
        )}

        {projectPanel.project && (
            <motion.aside
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-y-0 right-0 z-40 flex h-screen w-[min(92vw,24rem)] max-w-full flex-col border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl lg:static lg:z-auto lg:h-auto lg:w-96 lg:shrink-0 lg:shadow-xl"
            >
              <div className="flex items-center justify-between gap-4 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <div className="min-w-0">
                  <h3 className="text-gray-900 dark:text-white font-bold">Project Details</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {projectPanel.project.name}
                  </p>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {!projectPanel.isEditing ? (
                      <button
                          onClick={() => setProjectPanel({ ...projectPanel, isEditing: true })}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Pencil
                            size={18}
                            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        />
                      </button>
                  ) : (
                      <button
                          onClick={() => setProjectPanel({ ...projectPanel, isEditing: false })}
                          className="px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-xs font-bold"
                      >
                        Save
                      </button>
                  )}

                  <button
                      onClick={() => deleteProject(projectPanel.project!.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} className="text-red-600 dark:text-red-400" />
                  </button>

                  <button
                      onClick={closeProjectPanel}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <X
                        size={18}
                        className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-5 sm:space-y-6 text-sm">
                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Project Name
                  </label>

                  {projectPanel.isEditing ? (
                      <input
                          type="text"
                          defaultValue={projectPanel.project.name}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1 break-words">
                        {projectPanel.project.name}
                      </div>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Tags
                  </label>

                  <div className="flex gap-2 flex-wrap">
                    {projectPanel.project.tags.map((tag, index) => (
                        <span
                            key={tag}
                            className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold ${getTagColor(
                                index,
                            )}`}
                        >
                    {tag}

                          {projectPanel.isEditing && (
                              <button className="ml-2 hover:opacity-70 transition-opacity">
                                <X size={14} />
                              </button>
                          )}
                  </span>
                    ))}

                    {projectPanel.isEditing && (
                        <button className="px-4 py-1.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors text-xs font-bold">
                          + Add Tag
                        </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Description
                  </label>

                  {projectPanel.isEditing ? (
                      <textarea
                          defaultValue={projectPanel.project.description}
                          rows={4}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1 leading-relaxed break-words">
                        {projectPanel.project.description}
                      </div>
                  )}
                </div>

                <div>
                  <label className="block mb-2 sm:mb-3 text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Sources
                  </label>

                  <div className="space-y-2">
                    {projectPanel.project.artifacts.map((artifact) => (
                        <button
                            key={artifact}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left group"
                        >
                          <FileText
                              size={18}
                              className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors shrink-0"
                          />

                          <span className="min-w-0 flex-1 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors break-words">
                      {artifact}
                    </span>

                          <ChevronRight
                              size={16}
                              className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors shrink-0"
                          />
                        </button>
                    ))}

                    {projectPanel.isEditing && (
                        <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors flex items-center justify-center gap-2 font-bold">
                          <Plus size={18} />
                          <span>Add Source</span>
                        </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.aside>
        )}
      </div>
  );
}
