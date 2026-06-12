import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { userService } from '../../../src/services/userService';
import { Role } from '../../../src/services/types';

describe('userService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  it('login: uses testuser bypass for "testuser" username', async () => {
    const profile = await userService.login('testuser', 'John', 'Doe');
    
    expect(profile.username).toBe('testuser');
    expect(profile.id).toBe('test-user-id');
    expect(localStorage.getItem('sprintstart_session_id')).toBe('test-user-id');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('login: fetches users and returns existing user if found', async () => {
    const mockUsers = [
      { id: '1', username: 'jdoe', firstname: 'Jane', lastname: 'Doe' }
    ];
    
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUsers),
    });

    const profile = await userService.login('jdoe', 'Jane', 'Doe');
    
    expect(profile.id).toBe('1');
    expect(localStorage.getItem('sprintstart_session_id')).toBe('1');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/users');
  });

  it('login: creates a new user if not found', async () => {
    // 1. Fetch users (returns empty)
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    // 2. Create user (POST)
    const newUser = { id: '2', username: 'newuser', firstname: 'New', lastname: 'User' };
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(newUser),
    });

    const profile = await userService.login('newuser', 'New', 'User');
    
    expect(profile.id).toBe('2');
    expect(localStorage.getItem('sprintstart_session_id')).toBe('2');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('getProfile: returns null if no session exists', async () => {
    const profile = await userService.getProfile();
    expect(profile).toBeNull();
  });

  it('getProfile: fetches user by id from session', async () => {
    localStorage.setItem('sprintstart_session_id', '123');
    const mockUser = { id: '123', username: 'jdoe' };
    
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUser),
    });

    const profile = await userService.getProfile();
    
    expect(profile?.id).toBe('123');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/users/123');
  });

  it('updateProfile: sends PATCH request to update user', async () => {
    localStorage.setItem('sprintstart_session_id', '123');
    const updatedProfile = { id: '123', primaryRole: Role.ADMIN };
    
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(updatedProfile),
    });

    const profile = await userService.updateProfile({ primaryRole: Role.ADMIN });
    
    expect(profile.primaryRole).toBe(Role.ADMIN);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/v1/users/123', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ primaryRole: Role.ADMIN })
    }));
  });

  it('logout: clears session id', async () => {
    localStorage.setItem('sprintstart_session_id', '123');
    await userService.logout();
    expect(localStorage.getItem('sprintstart_session_id')).toBeNull();
  });
});
