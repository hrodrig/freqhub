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

import { useReducer, FormEvent, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Settings, User, Lock, Shield } from 'lucide-react';
import { apiClient } from '../services/api/client.js';
import { useAuth, type User as AuthUser } from '../contexts/AuthContext.js';

const sectionStyle = {
  padding: '1.5rem',
  marginBottom: '1.5rem',
  backgroundColor: '#2a2a2a',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
} as const;

const labelStyle = {
  display: 'block' as const,
  marginBottom: '0.5rem',
  color: '#e0e0e0',
  fontSize: '0.875rem',
  fontWeight: '500' as const,
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  backgroundColor: '#1a1a1a',
  border: '1px solid #3a3a3a',
  borderRadius: '4px',
  color: '#e0e0e0',
  fontSize: '1rem',
  boxSizing: 'border-box' as const,
};

type ProfileFormState = {
  name: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showCurrentPassword: boolean;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
  error: string;
  success: string;
  loading: boolean;
};

type ProfileFormAction =
  | { type: 'SET_FIELD'; field: keyof ProfileFormState; value: string | boolean }
  | { type: 'RESET_PASSWORDS' }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; success: string }
  | { type: 'SUBMIT_ERROR'; error: string }
  | { type: 'SUBMIT_END' }
  | { type: 'CLEAR_SUCCESS' };

function profileFormReducer(state: ProfileFormState, action: ProfileFormAction): ProfileFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };
    case 'RESET_PASSWORDS':
      return {
        ...state,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      };
    case 'SUBMIT_START':
      return { ...state, loading: true, error: '', success: '' };
    case 'SUBMIT_SUCCESS':
      return { ...state, success: action.success };
    case 'SUBMIT_ERROR':
      return { ...state, error: action.error };
    case 'SUBMIT_END':
      return { ...state, loading: false };
    case 'CLEAR_SUCCESS':
      return { ...state, success: '' };
    default:
      return state;
  }
}

const initialFormState = (user: AuthUser): ProfileFormState => ({
  name: user.name || '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
  showCurrentPassword: false,
  showNewPassword: false,
  showConfirmPassword: false,
  error: '',
  success: '',
  loading: false,
});

function ProfileMessage({ type, message }: { type: 'success' | 'error'; message: string }) {
  const isSuccess = type === 'success';
  return (
    <div
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: isSuccess ? '#1a4d1a' : '#4d1a1a',
        border: `1px solid ${isSuccess ? '#2d7a2d' : '#7a2d2d'}`,
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        color: isSuccess ? '#90ee90' : '#ee9090',
      }}
    >
      {isSuccess ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
      <span>{message}</span>
    </div>
  );
}

function DisplayNameSection({
  name,
  dispatch,
}: {
  name: string;
  dispatch: React.Dispatch<ProfileFormAction>;
}) {
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <User size={20} color="#e0e0e0" />
        <h2 style={{ color: '#e0e0e0', margin: 0, fontSize: '1.125rem' }}>Display Name</h2>
      </div>
      <div>
        <label htmlFor="profile-name" style={labelStyle}>
          Name (optional)
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'name', value: e.target.value })}
          placeholder="Your display name"
          maxLength={100}
          style={inputStyle}
        />
        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#a0a0a0' }}>
          This name will be displayed instead of your username
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  show,
  onChange,
  onToggleShow,
  hint,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggleShow: () => void;
  hint?: string;
  minLength?: number;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        style={{ ...inputStyle, paddingRight: '2.5rem' }}
      />
      <button
        type="button"
        onClick={onToggleShow}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleShow();
          }
        }}
        aria-label={show ? 'Hide password' : 'Show password'}
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
        title={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
      {hint && (
        <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#a0a0a0' }}>{hint}</div>
      )}
    </div>
  );
}

function ChangePasswordSection({ state, dispatch }: { state: ProfileFormState; dispatch: React.Dispatch<ProfileFormAction> }) {
  return (
    <div style={sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Lock size={20} color="#e0e0e0" />
        <h2 style={{ color: '#e0e0e0', margin: 0, fontSize: '1.125rem' }}>Change Password</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <PasswordField
          id="currentPassword"
          label="Current Password"
          value={state.currentPassword}
          show={state.showCurrentPassword}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'currentPassword', value: v })}
          onToggleShow={() => dispatch({ type: 'SET_FIELD', field: 'showCurrentPassword', value: !state.showCurrentPassword })}
        />
        <PasswordField
          id="newPassword"
          label="New Password"
          value={state.newPassword}
          show={state.showNewPassword}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'newPassword', value: v })}
          onToggleShow={() => dispatch({ type: 'SET_FIELD', field: 'showNewPassword', value: !state.showNewPassword })}
          hint="Must be at least 8 characters long (leave empty to keep current password)"
          minLength={8}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm New Password"
          value={state.confirmPassword}
          show={state.showConfirmPassword}
          onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'confirmPassword', value: v })}
          onToggleShow={() => dispatch({ type: 'SET_FIELD', field: 'showConfirmPassword', value: !state.showConfirmPassword })}
          minLength={8}
        />
      </div>
    </div>
  );
}

function TwoFactorPlaceholder() {
  return (
    <div style={{ ...sectionStyle, opacity: 0.6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Shield size={20} color="#a0a0a0" />
        <h2 style={{ color: '#a0a0a0', margin: 0, fontSize: '1.125rem' }}>Two-Factor Authentication</h2>
      </div>
      <div style={{ color: '#a0a0a0', fontSize: '0.875rem' }}>
        2FA will be available in a future update
      </div>
    </div>
  );
}

function ProfileFormActions({
  loading,
  onCancel,
}: {
  loading: boolean;
  onCancel: () => void;
}) {
  return (
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
          fontWeight: 500,
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
        onClick={onCancel}
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
  );
}

function ProfileFormContent({
  user,
  refreshUser,
  navigate,
}: {
  user: AuthUser;
  refreshUser: () => Promise<void>;
  navigate: (to: string) => void;
}) {
  const [state, dispatch] = useReducer(profileFormReducer, user, initialFormState);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      dispatch({ type: 'SET_FIELD', field: 'error', value: '' });
      dispatch({ type: 'SET_FIELD', field: 'success', value: '' });

      if (state.newPassword && state.newPassword.length < 8) {
        dispatch({ type: 'SET_FIELD', field: 'error', value: 'New password must be at least 8 characters long' });
        return;
      }
      if (state.newPassword && state.newPassword !== state.confirmPassword) {
        dispatch({ type: 'SET_FIELD', field: 'error', value: 'New passwords do not match' });
        return;
      }
      if (state.newPassword && state.currentPassword === state.newPassword) {
        dispatch({ type: 'SET_FIELD', field: 'error', value: 'New password must be different from current password' });
        return;
      }

      dispatch({ type: 'SUBMIT_START' });

      try {
        const updateData: { name?: string | null; currentPassword?: string; newPassword?: string } = {};
        if (state.name !== (user.name || '')) {
          updateData.name = state.name || null;
        }
        if (state.newPassword) {
          updateData.currentPassword = state.currentPassword;
          updateData.newPassword = state.newPassword;
        }

        await apiClient.put('/auth/profile', updateData);

        dispatch({ type: 'SUBMIT_SUCCESS', success: 'Profile updated successfully' });
        dispatch({ type: 'RESET_PASSWORDS' });
        await refreshUser();
        setTimeout(() => dispatch({ type: 'CLEAR_SUCCESS' }), 3000);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { data?: { error?: string } } };
          dispatch({ type: 'SUBMIT_ERROR', error: axiosError.response?.data?.error || 'Failed to update profile' });
        } else {
          dispatch({ type: 'SUBMIT_ERROR', error: 'Failed to update profile' });
        }
      } finally {
        dispatch({ type: 'SUBMIT_END' });
      }
    },
    [user, state.name, state.currentPassword, state.newPassword, state.confirmPassword, refreshUser]
  );

  return (
    <>
      {state.success && <ProfileMessage type="success" message={state.success} />}
      {state.error && <ProfileMessage type="error" message={state.error} />}
      <form onSubmit={handleSubmit}>
        <DisplayNameSection name={state.name} dispatch={dispatch} />
        <ChangePasswordSection state={state} dispatch={dispatch} />
        <TwoFactorPlaceholder />
        <ProfileFormActions loading={state.loading} onCancel={() => navigate('/dashboard')} />
      </form>
    </>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  if (!user) {
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
      <ProfileFormContent key={user.id} user={user} refreshUser={refreshUser} navigate={navigate} />
    </div>
  );
}
