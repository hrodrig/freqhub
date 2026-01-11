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

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Settings, User, Lock, Shield } from 'lucide-react';
import { apiClient } from '../services/api/client.js';
import { useAuth } from '../contexts/AuthContext.js';

export function Profile() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setIsLoadingProfile(false);
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword && currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      const updateData: { name?: string | null; currentPassword?: string; newPassword?: string } = {};
      
      if (name !== (user?.name || '')) {
        updateData.name = name || null;
      }

      if (newPassword) {
        updateData.currentPassword = currentPassword;
        updateData.newPassword = newPassword;
      }

      await apiClient.put('/auth/profile', updateData);

      setSuccess('Profile updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Refresh user data
      await refreshUser();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setError(axiosError.response?.data?.error || 'Failed to update profile');
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingProfile || !user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#a0a0a0' }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Settings size={24} color="#e0e0e0" />
        <h1 style={{ color: '#e0e0e0', margin: 0 }}>My Profile</h1>
      </div>

      {success && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#1a4d1a',
            border: '1px solid #2d7a2d',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#90ee90',
          }}
        >
          <CheckCircle2 size={20} />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: '#4d1a1a',
            border: '1px solid #7a2d2d',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#ee9090',
          }}
        >
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Display Name Section */}
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <User size={20} color="#e0e0e0" />
            <h2 style={{ color: '#e0e0e0', margin: 0, fontSize: '1.125rem' }}>Display Name</h2>
          </div>
          <div>
            <label
              htmlFor="name"
              style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: '#e0e0e0',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              Name (optional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              maxLength={100}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #3a3a3a',
                borderRadius: '4px',
                color: '#e0e0e0',
                fontSize: '1rem',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#a0a0a0' }}>
              This name will be displayed instead of your username
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Lock size={20} color="#e0e0e0" />
            <h2 style={{ color: '#e0e0e0', margin: 0, fontSize: '1.125rem' }}>Change Password</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <label
                htmlFor="currentPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#e0e0e0',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Current Password
              </label>
              <input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '2.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a0a0a0',
                }}
                title={showCurrentPassword ? 'Hide password' : 'Show password'}
              >
                {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <label
                htmlFor="newPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#e0e0e0',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                New Password
              </label>
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '2.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a0a0a0',
                }}
                title={showNewPassword ? 'Hide password' : 'Show password'}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#a0a0a0' }}>
                Must be at least 8 characters long (leave empty to keep current password)
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <label
                htmlFor="confirmPassword"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#e0e0e0',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '4px',
                  color: '#e0e0e0',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '2.25rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a0a0a0',
                }}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* 2FA Section (Placeholder) */}
        <div
          style={{
            padding: '1.5rem',
            marginBottom: '1.5rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            opacity: 0.6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Shield size={20} color="#a0a0a0" />
            <h2 style={{ color: '#a0a0a0', margin: 0, fontSize: '1.125rem' }}>Two-Factor Authentication</h2>
          </div>
          <div style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
            2FA will be available in a future update
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#555' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#3a3a3a',
              color: '#e0e0e0',
              border: '1px solid #4a4a4a',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
