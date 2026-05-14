import { useState } from 'react';
import { Search, UserPlus, MoreVertical, CheckCircle, XCircle, Clock } from 'lucide-react';
import { UserRole } from '../../context/RoleContext';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  projects: string[];
  status: 'active' | 'pending' | 'inactive';
  joinDate: string;
}

export function Admin() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const users: User[] = [
    {
      id: '1',
      name: 'Sarah Chen',
      email: 'sarah.chen@company.com',
      role: 'Admin',
      projects: ['Platform', 'API Gateway'],
      status: 'active',
      joinDate: '2025-01-15',
    },
    {
      id: '2',
      name: 'Marcus Johnson',
      email: 'marcus.j@company.com',
      role: 'Project Manager',
      projects: ['Mobile App', 'Frontend'],
      status: 'active',
      joinDate: '2025-03-20',
    },
    {
      id: '3',
      name: 'Emma Wilson',
      email: 'emma.wilson@company.com',
      role: 'Existing Project Member',
      projects: ['Backend Services'],
      status: 'active',
      joinDate: '2025-11-10',
    },
    {
      id: '4',
      name: 'David Park',
      email: 'david.park@company.com',
      role: 'New Project Member',
      projects: ['Platform', 'Infrastructure'],
      status: 'pending',
      joinDate: '2026-05-01',
    },
    {
      id: '5',
      name: 'Lisa Rodriguez',
      email: 'lisa.r@company.com',
      role: 'HR',
      projects: [],
      status: 'active',
      joinDate: '2024-08-15',
    },
    {
      id: '6',
      name: 'Alex Kim',
      email: 'alex.kim@company.com',
      role: 'Existing Project Member',
      projects: ['API Gateway'],
      status: 'inactive',
      joinDate: '2024-06-01',
    },
  ];

  const roles = [
    'all',
    'Admin',
    'Project Manager',
    'New Project Member',
    'Existing Project Member',
    'HR',
  ];
  const statuses = ['all', 'active', 'pending', 'inactive'];

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === '' ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      case 'inactive':
        return <XCircle className="w-4 h-4 text-gray-400 dark:text-gray-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950';
      case 'pending':
        return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-950';
      case 'inactive':
        return 'text-gray-700 dark:text-gray-400 bg-gray-100 dark:bg-gray-800';
      default:
        return '';
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Admin Console</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage users, roles, and project access
            </p>
          </div>
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Role:</span>
            <div className="flex gap-2">
              {roles.map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    selectedRole === role
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {role === 'all' ? 'All' : role}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Status:</span>
            <div className="flex gap-2">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                    selectedStatus === status
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Projects
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Join Date
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {user.projects.length > 0 ? (
                        user.projects.map((project) => (
                          <span
                            key={project}
                            className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs rounded"
                          >
                            {project}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded capitalize ${getStatusColor(
                        user.status,
                      )}`}
                    >
                      {getStatusIcon(user.status)}
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {user.joinDate}
                  </td>
                  <td className="px-6 py-4">
                    <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
                      <MoreVertical className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No users found matching your filters</p>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            {users.length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            {users.filter((u) => u.status === 'active').length}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">Pending Approval</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-2">
            {users.filter((u) => u.status === 'pending').length}
          </p>
        </div>
      </div>
    </div>
  );
}
