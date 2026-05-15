import { useState } from 'react';
import { 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  ChevronRight, 
  X, 
  FileText 
} from 'lucide-react';
import { UserRole } from '../../context/RoleContext';

interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  projects: string[];
}

interface Project {
  id: string;
  name: string;
  tags: string[];
  description: string;
  artifacts: string[];
}

const mockUsers: User[] = [
  {
    id: '1',
    username: 'Max Mustermann',
    email: 'max.mustermann@example.com',
    primaryRole: 'Admin',
    secondaryRoles: ['Project Manager'],
    projects: ['Project Alpha', 'Project Beta'],
  },
  {
    id: '2',
    username: 'Anna Schmidt',
    email: 'anna.schmidt@example.com',
    primaryRole: 'Project Manager',
    secondaryRoles: ['Member'],
    projects: ['Project Gamma'],
  },
  {
    id: '3',
    username: 'Tom Weber',
    email: 'tom.weber@example.com',
    primaryRole: 'Member',
    secondaryRoles: [],
    projects: ['Project Alpha', 'Project Delta'],
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

  const deleteUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
    if (userPanel.user?.id === userId) {
      closeUserPanel();
    }
  };

  const deleteProject = (projectId: string) => {
    setProjects(projects.filter(p => p.id !== projectId));
    if (projectPanel.project?.id === projectId) {
      closeProjectPanel();
    }
  };

  return (
      <div className="size-full flex bg-background">
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-red-500"/>
                Admin Console
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Manage users, roles, and project access
              </p>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-8">
            {/* Container with Tabs and Content */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* Tabs with Action Button */}
              <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-6">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-1 transition-all relative ${
                            activeTab === 'users'
                                ? 'text-gray-900 dark:text-white after:absolute after:-bottom-6 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      Users
                    </button>
                    <button
                        onClick={() => setActiveTab('projects')}
                        className={`px-1 transition-all relative ${
                            activeTab === 'projects'
                                ? 'text-gray-900 dark:text-white after:absolute after:-bottom-6 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                      Projects
                    </button>
                  </div>
                  {activeTab === 'users' ? (
                      <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md">
                        <Plus size={20} />
                        Add User
                      </button>
                  ) : (
                      <button className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm hover:shadow-md">
                        <Plus size={20} />
                        Add Project
                      </button>
                  )}
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'users' ? (
                    <div>
                      {/* Users Table */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        {/* Table Header */}
                        <div className="grid grid-cols-[50px_2fr_2fr_2fr_100px] gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600 cursor-pointer"
                                checked={selectedUsers.size === users.length && users.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers(new Set(users.map(u => u.id)));
                                  } else {
                                    setSelectedUsers(new Set());
                                  }
                                }}
                            />
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">User</div>
                          <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Role</div>
                          <div className="text-gray-600 dark:text-gray-400 uppercase tracking-wide">Projects</div>
                          <div className="text-gray-600 dark:text-gray-400 text-right uppercase tracking-wide">Actions</div>
                        </div>

                        {/* Table Body */}
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
                              <div className="flex flex-col justify-center">
                                <button
                                    onClick={() => openUserPanel(user, false)}
                                    className="text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <div className="text-gray-900 dark:text-white">{user.username}</div>
                                  <div className="text-gray-600 dark:text-gray-400">{user.email}</div>
                                </button>
                              </div>
                              <div className="flex flex-col justify-center gap-2">
                      <span
                          className={`inline-flex items-center px-3 py-1 rounded-full w-fit ${roleColors[user.primaryRole] || roleColors['Member']}`}
                      >
                        {user.primaryRole}
                      </span>
                                {user.secondaryRoles && user.secondaryRoles.length > 0 && (
                                    <div className="flex gap-2 flex-wrap">
                                      {user.secondaryRoles.map((role, idx) => (
                                          <span
                                              key={idx}
                                              className={`inline-flex items-center px-3 py-1 rounded-full ${roleColors[role] || roleColors['Member']}`}
                                          >
                              {role}
                            </span>
                                      ))}
                                    </div>
                                )}
                              </div>
                              <div className="flex flex-col justify-center gap-1">
                                {user.projects && user.projects.map((project, idx) => (
                                    <span key={idx} className="text-gray-900 dark:text-white">
                          {project}
                        </span>
                                ))}
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <button
                                    onClick={() => openUserPanel(user, true)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                  <Pencil size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
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
                    </div>
                ) : (
                    <div>
                      {/* Projects List */}
                      <div className="space-y-4">
                        {projects.map((project) => (
                            <div
                                key={project.id}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-all"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="mb-3 text-gray-900 dark:text-white">{project.name}</h3>
                                  <div className="flex gap-2 mb-4 flex-wrap">
                                    {project.tags && project.tags.map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className={`px-4 py-1.5 rounded-full ${getTagColor(idx)}`}
                                        >
                              {tag}
                            </span>
                                    ))}
                                  </div>
                                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{project.description}</p>
                                </div>
                                <button
                                    onClick={() => openProjectPanel(project, false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors ml-4 flex-shrink-0"
                                >
                                  <ChevronRight size={24} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                                </button>
                              </div>
                            </div>
                        ))}
                      </div>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User Side Panel */}
        {userPanel.user && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <h3 className="text-gray-900 dark:text-white">User Details</h3>
                <div className="flex items-center gap-2">
                  {!userPanel.isEditing ? (
                      <button
                          onClick={() => setUserPanel({ ...userPanel, isEditing: true })}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Pencil size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                      </button>
                  ) : (
                      <button
                          onClick={() => setUserPanel({ ...userPanel, isEditing: false })}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                    <X size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-6">
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Username</label>
                  {userPanel.isEditing ? (
                      <input
                          type="text"
                          defaultValue={userPanel.user.username}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1">{userPanel.user.username}</div>
                  )}
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Email</label>
                  {userPanel.isEditing ? (
                      <input
                          type="email"
                          defaultValue={userPanel.user.email}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-600 dark:text-gray-400 px-1">{userPanel.user.email}</div>
                  )}
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Primary Role</label>
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
                          className={`inline-flex items-center px-4 py-1.5 rounded-full ${roleColors[userPanel.user.primaryRole] || roleColors['Member']}`}
                      >
                  {userPanel.user.primaryRole}
                </span>
                  )}
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Secondary Roles</label>
                  <div className="flex gap-2 flex-wrap">
                    {userPanel.user.secondaryRoles && userPanel.user.secondaryRoles.map((role, idx) => (
                        <span
                            key={idx}
                            className={`inline-flex items-center px-4 py-1.5 rounded-full ${roleColors[role] || roleColors['Member']}`}
                        >
                    {role}
                  </span>
                    ))}
                    {userPanel.isEditing && (
                        <button className="px-4 py-1.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                          + Add
                        </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Projects</label>
                  <div className="space-y-2">
                    {userPanel.user.projects && userPanel.user.projects.map((project, idx) => (
                        <div key={idx} className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
                          {project}
                        </div>
                    ))}
                    {userPanel.isEditing && (
                        <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                          + Assign Project
                        </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
        )}

        {/* Project Side Panel */}
        {projectPanel.project && (
            <div className="w-96 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <h3 className="text-gray-900 dark:text-white">Project Details</h3>
                <div className="flex items-center gap-2">
                  {!projectPanel.isEditing ? (
                      <button
                          onClick={() => setProjectPanel({ ...projectPanel, isEditing: true })}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <Pencil size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                      </button>
                  ) : (
                      <button
                          onClick={() => setProjectPanel({ ...projectPanel, isEditing: false })}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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
                    <X size={18} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 space-y-6">
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Project Name</label>
                  {projectPanel.isEditing ? (
                      <input
                          type="text"
                          defaultValue={projectPanel.project.name}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1">{projectPanel.project.name}</div>
                  )}
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Tags</label>
                  <div className="flex gap-2 flex-wrap">
                    {projectPanel.project.tags && projectPanel.project.tags.map((tag, idx) => (
                        <span
                            key={idx}
                            className={`inline-flex items-center px-4 py-1.5 rounded-full ${getTagColor(idx)}`}
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
                        <button className="px-4 py-1.5 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-full hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
                          + Add Tag
                        </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Description</label>
                  {projectPanel.isEditing ? (
                      <textarea
                          defaultValue={projectPanel.project.description}
                          rows={4}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                  ) : (
                      <div className="text-gray-900 dark:text-white px-1 leading-relaxed">{projectPanel.project.description}</div>
                  )}
                </div>
                <div>
                  <label className="block mb-3 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Artifacts & Sources</label>
                  <div className="space-y-2">
                    {projectPanel.project.artifacts && projectPanel.project.artifacts.map((artifact, idx) => (
                        <button
                            key={idx}
                            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all text-left group"
                        >
                          <FileText size={18} className="text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                          <span className="text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{artifact}</span>
                          <ChevronRight size={16} className="ml-auto text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                        </button>
                    ))}
                    {projectPanel.isEditing && (
                        <button className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors flex items-center justify-center gap-2">
                          <Plus size={18} />
                          <span>Add Artifact</span>
                        </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}
