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

import { useState, useEffect, useCallback, useRef, useMemo, type ChangeEvent } from 'react';
import { Plus, X, Edit, Trash2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Upload, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useBotStore } from '../stores/botStore.js';
import { botApi, proxyApi } from '../services/api/endpoints.js';
import { useAuth } from '../contexts/AuthContext.js';
import { config } from '../config/env.js';
import type { BotImportResult, CreateBotRequest, UpdateBotRequest } from '../types/bot.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

export function BotManagement() {
  const { user } = useAuth();
  const { bots, fetchBots, removeBot, updateBot: updateBotInStore } = useBotStore();
  const location = useLocation();
  const handledEditRef = useRef<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBot, setEditingBot] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateBotRequest & { isEnabled: boolean }>({
    name: '',
    apiUrl: '',
    wsUrl: '',
    username: '',
    password: '',
    notes: '',
    configMapName: '',
    configPath: '',
    agentUrl: '',
    isEnabled: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<BotImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [statusChecking, setStatusChecking] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<number | 'all'>(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [sortKey, setSortKey] = useState<'name' | 'apiUrl' | 'username' | 'isEnabled'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    setPageIndex(0);
  }, [searchQuery, pageSize]);

  const filteredBots = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return bots;
    return bots.filter((bot) => {
      const haystack = [
        bot.name,
        bot.apiUrl,
        bot.wsUrl,
        bot.username,
        bot.configMapName,
        bot.configPath,
        bot.agentUrl,
        bot.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [bots, searchQuery]);

  const sortedBots = useMemo(() => {
    const sorted = [...filteredBots];
    const dir = sortDir === 'asc' ? 1 : -1;
    sorted.sort((a, b) => {
      let aVal: string | number | boolean = '';
      let bVal: string | number | boolean = '';
      if (sortKey === 'name') {
        aVal = a.name || '';
        bVal = b.name || '';
      } else if (sortKey === 'apiUrl') {
        aVal = a.apiUrl || '';
        bVal = b.apiUrl || '';
      } else if (sortKey === 'username') {
        aVal = a.username || '';
        bVal = b.username || '';
      } else if (sortKey === 'isEnabled') {
        aVal = a.isEnabled ? 1 : 0;
        bVal = b.isEnabled ? 1 : 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * dir;
      }
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
    return sorted;
  }, [filteredBots, sortDir, sortKey]);

  const totalRows = sortedBots.length;
  const effectivePageSize = pageSize === 'all' ? totalRows || 1 : pageSize;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const startIndex = currentPage * effectivePageSize;
  const endIndex = startIndex + effectivePageSize;
  const pagedBots = sortedBots.slice(startIndex, endIndex);

  const formatUpdatedAt = (timestamp: number) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  };

  useEffect(() => {
    if (pageIndex !== currentPage) {
      setPageIndex(currentPage);
    }
  }, [currentPage, pageIndex]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingBot) {
        // Update existing bot
        const updateData: UpdateBotRequest = {
          name: formData.name,
          apiUrl: formData.apiUrl,
          wsUrl: formData.wsUrl || undefined,
          username: formData.username,
          notes: formData.notes,
          isEnabled: formData.isEnabled,
          agentUrl: formData.agentUrl || undefined,
          configMapName: formData.configMapName,
          configPath: formData.configPath,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        const updated = await botApi.update(editingBot, updateData);
        updateBotInStore(editingBot, updated);
        setEditingBot(null);
      } else {
        // Create new bot
        const createData: CreateBotRequest = {
          name: formData.name,
          apiUrl: formData.apiUrl,
          wsUrl: formData.wsUrl || undefined,
          username: formData.username,
          password: formData.password,
          notes: formData.notes,
          agentUrl: formData.agentUrl || undefined,
          configMapName: formData.configMapName,
          configPath: formData.configPath,
        };
        await botApi.create(createData);
        await fetchBots();
      }
      setShowForm(false);
      setFormData({
        name: '',
        apiUrl: '',
        wsUrl: '',
        username: '',
        password: '',
        notes: '',
        configMapName: '',
        configPath: '',
        agentUrl: '',
        isEnabled: true,
      });
      setShowPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkBotStopped = useCallback(async (botId: string, actionLabel: 'edit' | 'delete') => {
    setStatusChecking((prev) => ({ ...prev, [botId]: true }));
    try {
      const config = await proxyApi.get(botId, 'api/v1/show_config') as { state?: string } | null;
      const state = config?.state?.toUpperCase();
      if (!state) {
        return confirm(`Unable to verify bot state. Do you want to ${actionLabel} anyway?`);
      }
      if (state !== 'STOPPED') {
        alert(`The bot must be stopped before you can ${actionLabel}.`);
        return false;
      }
      return true;
    } catch (err) {
      return confirm(`Unable to verify bot state. Do you want to ${actionLabel} anyway?`);
    } finally {
      setStatusChecking((prev) => ({ ...prev, [botId]: false }));
    }
  }, []);

  const handleEdit = useCallback(async (bot: {
    id: string;
    name: string;
    apiUrl: string;
    wsUrl?: string | null;
    username: string;
    notes?: string;
    isEnabled: boolean;
    agentUrl?: string | null;
    configMapName?: string | null;
    configPath?: string | null;
  }) => {
    if (user?.role === 'auditor') {
      setError('Read-only: auditors cannot edit bots.');
      return;
    }
    const canEdit = await checkBotStopped(bot.id, 'edit');
    if (!canEdit) return;
    setEditingBot(bot.id);
    setFormData({
      name: bot.name,
      apiUrl: bot.apiUrl,
      wsUrl: bot.wsUrl || '',
      username: bot.username,
      password: '', // Don't pre-fill password
      notes: bot.notes || '',
      configMapName: bot.configMapName || '',
      configPath: bot.configPath || '',
      agentUrl: bot.agentUrl || '',
      isEnabled: bot.isEnabled,
    });
    setShowForm(true);
  }, [checkBotStopped, user?.role]);

  useEffect(() => {
    if (!bots.length) return;
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (!editId) return;
    if (handledEditRef.current === editId) return;
    handledEditRef.current = editId;
    const bot = bots.find((b) => b.id === editId);
    if (bot) {
      void handleEdit(bot);
    }
  }, [bots, handleEdit, location.search]);

  const handleCancel = () => {
    setShowForm(false);
    setEditingBot(null);
    setFormData({
      name: '',
      apiUrl: '',
      wsUrl: '',
      username: '',
      password: '',
      notes: '',
      configMapName: '',
      configPath: '',
      agentUrl: '',
      isEnabled: true,
    });
  };

  const handleDelete = async (id: string) => {
    const canDelete = await checkBotStopped(id, 'delete');
    if (!canDelete) return;
    if (confirm('Are you sure you want to delete this bot?')) {
      try {
        await botApi.delete(id);
        removeBot(id);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete bot');
      }
    }
  };

  const templateBasePath = config.basePath.replace(/\/?$/, '/');
  const templateDownloadUrl = `${templateBasePath}freqhub_example_bots_list.xlsx`;

  const handleImportClick = () => {
    if (user?.role === 'auditor') return;
    importFileRef.current?.click();
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    setImportError(null);
    try {
      const result = await botApi.importBots(file);
      setImportResult(result);
      await fetchBots();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import bots');
    } finally {
      setImportLoading(false);
      event.target.value = '';
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await botApi.exportBots();
      const url = window.URL.createObjectURL(blob);
      const now = new Date();
      const timestamp = [
        now.getUTCFullYear(),
        String(now.getUTCMonth() + 1).padStart(2, '0'),
        String(now.getUTCDate()).padStart(2, '0'),
        String(now.getUTCHours()).padStart(2, '0'),
        String(now.getUTCMinutes()).padStart(2, '0'),
      ].join('');
      const filename = `freqhub_bots_export_${timestamp}.xlsx`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to export bots');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Bot Management</h1>
            <p className="text-muted-foreground mt-2">Manage your Freqtrade bot connections</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleImportChange}
            />
            <a
              href={templateDownloadUrl}
              className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              download="freqhub_example_bots_list.xlsx"
            >
              <Download className="h-4 w-4" />
              example file
            </a>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export XLSX
                </>
              )}
            </button>
            <button
              onClick={handleImportClick}
              disabled={user?.role === 'auditor' || importLoading}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={user?.role === 'auditor' ? 'Read-only: auditors cannot import bots.' : undefined}
            >
              {importLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import XLSX
                </>
              )}
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              disabled={user?.role === 'auditor'}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={user?.role === 'auditor' ? 'Read-only: auditors cannot add bots.' : undefined}
            >
              {showForm ? (
                <>
                  <X className="h-4 w-4" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add Bot
                </>
              )}
            </button>
          </div>
        </div>

        {(importResult || importError) && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import results</CardTitle>
              <CardDescription>Upload summary for the latest XLSX file</CardDescription>
            </CardHeader>
            <CardContent>
              {importError ? (
                <div className="text-sm text-red-500">{importError}</div>
              ) : importResult ? (
                <div className="space-y-2 text-sm text-foreground">
                  <div>
                    Total: {importResult.total} · Created: {importResult.created} · Updated: {importResult.updated} · Skipped: {importResult.skipped} · Failed: {importResult.failed}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="text-xs text-red-500">
                      {importResult.errors.slice(0, 5).map((err) => (
                        <div key={`${err.row}-${err.message}`}>
                          Row {err.row}: {err.message}{err.identifier ? ` (${err.identifier})` : ''}
                        </div>
                      ))}
                      {importResult.errors.length > 5 && (
                        <div>And {importResult.errors.length - 5} more errors.</div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {showForm && user?.role !== 'auditor' && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{editingBot ? 'Edit Bot' : 'Add New Bot'}</CardTitle>
              <CardDescription>
                {editingBot ? 'Update bot configuration' : 'Configure a new Freqtrade bot connection'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., EMAC-RSI-EMA200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    API URL
                  </label>
                  <input
                    type="url"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="http://localhost:8080"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    WebSocket URL
                  </label>
                  <input
                    type="url"
                    value={formData.wsUrl || ''}
                    onChange={(e) => setFormData({ ...formData, wsUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="ws://localhost:8080"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Agent URL
                  </label>
                  <input
                    type="url"
                    value={formData.agentUrl}
                    onChange={(e) => setFormData({ ...formData, agentUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="http://localhost:3010"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="freqtrader"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={editingBot ? 'Leave empty to keep current password' : 'Enter password'}
                      required={!editingBot}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#a0a0a0',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.color = '#e0e0e0';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = '#a0a0a0';
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    placeholder="Add notes about this bot (e.g., strategy, configuration, etc.)"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    ConfigMap Name (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.configMapName || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({
                        ...formData,
                        configMapName: value,
                        configPath: value ? '' : formData.configPath,
                      });
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g., freqtrade-bot-1-config"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Kubernetes reference only. For runmode changes, set a writable Config Path (PVC).
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Config Path (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.configPath || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFormData({
                        ...formData,
                        configPath: value,
                        configMapName: value ? '' : formData.configMapName,
                      });
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                    placeholder="/freqtrade/user_data/config.json"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Required to enable dry-run/live changes (Docker and K8s via writable volume). Example: bot-1/config.json when RUNMODE_CONFIG_BASE_DIR is set.
                  </p>
                </div>
                <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    {formData.isEnabled ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <label htmlFor="isEnabled" className="text-sm font-medium text-foreground cursor-pointer block">
                        Bot Status
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {formData.isEnabled ? 'Bot will be enabled' : 'Bot will be disabled'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isEnabled: !formData.isEnabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.isEnabled ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {error && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  {editingBot && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 ring-1 ring-primary/40 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      'Saving...'
                    ) : editingBot ? (
                      'Update Bot'
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Bot
                      </>
                    )}
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="pt-4">
            {bots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No bots configured yet.</p>
                <p className="text-sm mt-2">Click "Add Bot" to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-1 items-center gap-3">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, URL, username, notes, config..."
                      className="w-full md:w-96 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="text-sm text-muted-foreground">
                      {totalRows} results
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground">Rows</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPageSize(value === 'all' ? 'all' : Number(value));
                      }}
                      className="px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value={10}>10</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value="all">All</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === 'name') {
                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortKey('name');
                                setSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-2 hover:text-foreground"
                          >
                            Name {sortKey === 'name' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === 'apiUrl') {
                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortKey('apiUrl');
                                setSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-2 hover:text-foreground"
                          >
                            API URL {sortKey === 'apiUrl' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">WS URL</th>
                        <th className="px-4 py-3 font-medium">Agent URL</th>
                        <th className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === 'username') {
                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortKey('username');
                                setSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-2 hover:text-foreground"
                          >
                            Username {sortKey === 'username' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium">Config</th>
                        <th className="px-4 py-3 font-medium">Last Update</th>
                        <th className="px-4 py-3 font-medium">
                          <button
                            type="button"
                            onClick={() => {
                              if (sortKey === 'isEnabled') {
                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                              } else {
                                setSortKey('isEnabled');
                                setSortDir('asc');
                              }
                            }}
                            className="flex items-center gap-2 hover:text-foreground"
                          >
                            Status {sortKey === 'isEnabled' ? (sortDir === 'asc' ? '^' : 'v') : ''}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedBots.map((bot) => (
                        <tr key={bot.id} className="group border-t border-border hover:bg-muted/30">
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <Link
                                to={`/bots/${bot.id}`}
                                className="font-medium text-foreground hover:text-primary transition-colors"
                              >
                                {bot.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-muted-foreground block max-w-[220px] truncate">
                              {bot.apiUrl}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-muted-foreground block max-w-[220px] truncate">
                              {bot.wsUrl || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-muted-foreground block max-w-[220px] truncate">
                              {bot.agentUrl || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-muted-foreground">{bot.username}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-muted-foreground space-y-1">
                              {bot.configMapName && (
                                <div className="font-mono text-xs block max-w-[160px] truncate">
                                  {bot.configMapName}
                                </div>
                              )}
                              {bot.configPath && (
                                <div className="font-mono text-xs block max-w-[160px] truncate">
                                  {bot.configPath}
                                </div>
                              )}
                              {!bot.configMapName && !bot.configPath && (
                                <div className="text-xs text-muted-foreground">—</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-muted-foreground">
                              {formatUpdatedAt(bot.updatedAt)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {bot.isEnabled ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-500">
                                <CheckCircle2 className="h-4 w-4" />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-500">
                                <XCircle className="h-4 w-4" />
                                Disabled
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
                              <button
                                onClick={() => void handleEdit(bot)}
                                disabled={user?.role === 'auditor' || statusChecking[bot.id]}
                                className="p-2 text-primary hover:bg-primary/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={
                                  statusChecking[bot.id]
                                    ? 'Checking bot state...'
                                    : user?.role === 'auditor'
                                    ? 'Read-only: auditors cannot edit bots.'
                                    : 'Edit Bot'
                                }
                              >
                                {statusChecking[bot.id] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Edit className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => void handleDelete(bot.id)}
                                disabled={statusChecking[bot.id]}
                                className="p-2 text-red-500 hover:bg-red-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title={statusChecking[bot.id] ? 'Checking bot state...' : 'Delete Bot'}
                              >
                                {statusChecking[bot.id] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div>
                    {pageSize === 'all'
                      ? `Showing ${totalRows} of ${totalRows}`
                      : `Showing ${Math.min(startIndex + 1, totalRows)}-${Math.min(endIndex, totalRows)} of ${totalRows}`}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                      disabled={pageSize === 'all' || currentPage === 0}
                      className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    <span>
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
                      disabled={pageSize === 'all' || currentPage >= totalPages - 1}
                      className="px-3 py-1 border border-border rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
