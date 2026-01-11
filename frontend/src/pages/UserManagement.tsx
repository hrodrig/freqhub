/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { useState, useEffect } from 'react';
import { Plus, X, Edit, Trash2, Eye, EyeOff, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../services/api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string;
  role: 'superadmin' | 'auditor' | 'user';
  isActive: boolean;
  mustChangePassword: boolean;
  lastLogin: number | null;
  createdAt: number;
}

interface UserFormData {
  username: string;
  name: string;
  email: string;
  password: string;
  role: 'superadmin' | 'auditor' | 'user';
  isActive: boolean;
  mustChangePassword: boolean;
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'user',
    isActive: true,
    mustChangePassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userBots, setUserBots] = useState<Record<string, any[]>>({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/users');
      setUsers(response.data.data || []);
    } catch (err: unknown) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserBots = async (userId: string) => {
    try {
      const response = await apiClient.get(`/users/${userId}/bots`);
      setUserBots((prev) => ({
        ...prev,
        [userId]: response.data.data || [],
      }));
    } catch (err) {
      console.error('Failed to fetch user bots:', err);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setFormData({
      username: user.username,
      name: user.name || '',
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    });
    setShowForm(true);
    setError(null);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      await apiClient.delete(`/users/${userId}`);
      await fetchUsers();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || 'Failed to delete user');
      } else {
        setError('Failed to delete user');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (editingUser) {
        // Update user
        const updateData: Partial<UserFormData & { name: string | null }> = {
          username: formData.username,
          name: formData.name || null, // Convert empty string to null
          email: formData.email,
          role: formData.role,
          isActive: formData.isActive,
          mustChangePassword: formData.mustChangePassword,
        };

        // Only include password if it's provided
        if (formData.password) {
          updateData.password = formData.password;
        }

        await apiClient.put(`/users/${editingUser}`, updateData);
      } else {
        // Create user
        if (!formData.password) {
          setError('Password is required for new users');
          setIsSubmitting(false);
          return;
        }

        const createData = {
          ...formData,
          name: formData.name || null, // Convert empty string to null
        };
        await apiClient.post('/users', createData);
      }

      await fetchUsers();
      handleCancel();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || 'Failed to save user');
      } else {
        setError('Failed to save user');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      username: '',
      name: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true,
      mustChangePassword: false,
    });
    setError(null);
    setShowPassword(false);
  };

  const toggleUserExpansion = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      if (!userBots[userId]) {
        fetchUserBots(userId);
      }
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return { bg: '#4d1a1a', border: '#7a2d2d', text: '#ee9090' };
      case 'auditor':
        return { bg: '#1a3d4d', border: '#2d5d7a', text: '#90c0ee' };
      case 'user':
        return { bg: '#1a4d1a', border: '#2d7a2d', text: '#90ee90' };
      default:
        return { bg: '#3a3a3a', border: '#4a4a4a', text: '#e0e0e0' };
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#e0e0e0' }}>User Management</h1>
        <button
          onClick={() => {
            handleCancel();
            setShowForm(true);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#4d1a1a',
            border: '1px solid #7a2d2d',
            borderRadius: '4px',
            color: '#ee9090',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ color: '#e0e0e0' }}>{editingUser ? 'Edit User' : 'Create User'}</h2>
            <button
              onClick={handleCancel}
              style={{
                background: 'none',
                border: 'none',
                color: '#a0a0a0',
                cursor: 'pointer',
                padding: '0.25rem',
              }}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '4px',
                    color: '#e0e0e0',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="User's display name"
                  maxLength={100}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '4px',
                    color: '#e0e0e0',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                Password {editingUser ? '(leave empty to keep current)' : '*'}
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!editingUser}
                minLength={8}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  paddingRight: '2.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '2rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#a0a0a0',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'superadmin' | 'auditor' | 'user' })
                  }
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #3a3a3a',
                    borderRadius: '4px',
                    color: '#e0e0e0',
                  }}
                >
                  <option value="user">User</option>
                  <option value="auditor">Auditor</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#e0e0e0', fontSize: '0.875rem' }}>
                  Status
                </label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e0e0e0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e0e0e0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.mustChangePassword}
                      onChange={(e) => setFormData({ ...formData, mustChangePassword: e.target.checked })}
                    />
                    Must Change Password
                  </label>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: isSubmitting ? '#555' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} style={{ display: 'inline-block', marginRight: '0.5rem', animation: 'spin 1s linear infinite' }} />
                    Saving...
                  </>
                ) : (
                  editingUser ? 'Update User' : 'Create User'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: '#3a3a3a',
                  color: '#e0e0e0',
                  border: '1px solid #4a4a4a',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#a0a0a0' }}>
          <Loader2 size={32} style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
          <div style={{ marginTop: '1rem' }}>Loading users...</div>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#a0a0a0' }}>
          No users found. Create your first user to get started.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {users.map((user) => {
            const roleColors = getRoleBadgeColor(user.role);
            const isCurrentUser = currentUser?.id === user.id;

            return (
              <div
                key={user.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#2a2a2a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ color: '#e0e0e0', margin: 0 }}>{user.name || user.username}</h3>
                        {user.name && (
                          <div style={{ color: '#a0a0a0', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            @{user.username}
                          </div>
                        )}
                      </div>
                      <span
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: roleColors.bg,
                          border: `1px solid ${roleColors.border}`,
                          borderRadius: '4px',
                          color: roleColors.text,
                          fontSize: '0.75rem',
                          fontWeight: '500',
                        }}
                      >
                        {user.role}
                      </span>
                      {user.isActive ? (
                        <CheckCircle2 size={16} color="#90ee90" />
                      ) : (
                        <XCircle size={16} color="#ee9090" />
                      )}
                      {user.mustChangePassword && (
                        <span style={{ fontSize: '0.75rem', color: '#ffa500' }}>⚠ Must change password</span>
                      )}
                    </div>
                    <div style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
                      <div>Email: {user.email}</div>
                      {user.lastLogin && (
                        <div>Last login: {new Date(user.lastLogin).toLocaleString()}</div>
                      )}
                      <div>Created: {new Date(user.createdAt).toLocaleString()}</div>
                    </div>
                    {expandedUser === user.id && userBots[user.id] && (
                      <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
                        <div style={{ color: '#e0e0e0', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Assigned Bots ({userBots[user.id].length})
                        </div>
                        {userBots[user.id].length === 0 ? (
                          <div style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>No bots assigned</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {userBots[user.id].map((bot: any) => (
                              <div key={bot.id} style={{ color: '#e0e0e0', fontSize: '0.875rem' }}>
                                • {bot.name} ({bot.id.substring(0, 8)}...)
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => toggleUserExpansion(user.id)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#3a3a3a',
                        color: '#e0e0e0',
                        border: '1px solid #4a4a4a',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title="View assigned bots"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: '#3a3a3a',
                        color: '#e0e0e0',
                        border: '1px solid #4a4a4a',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title="Edit user"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      disabled={isCurrentUser}
                      style={{
                        padding: '0.5rem',
                        backgroundColor: isCurrentUser ? '#2a2a2a' : '#4d1a1a',
                        color: isCurrentUser ? '#555' : '#ee9090',
                        border: `1px solid ${isCurrentUser ? '#3a3a3a' : '#7a2d2d'}`,
                        borderRadius: '4px',
                        cursor: isCurrentUser ? 'not-allowed' : 'pointer',
                        opacity: isCurrentUser ? 0.5 : 1,
                      }}
                      title={isCurrentUser ? 'Cannot delete your own account' : 'Delete user'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
