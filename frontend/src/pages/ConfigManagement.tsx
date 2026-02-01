/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Upload,
  Save,
  RotateCcw,
  History,
  GitCompare,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Settings,
  FileJson,
  Server,
} from 'lucide-react';
import { useBotStore } from '../stores/botStore.js';
import { configServiceApi, type BotConfig, type ConfigVersion, type ConfigDiff, type FreqtradeConfig } from '../services/api/configService.js';
import { configAgentApi } from '../services/api/configAgent.js';
import { proxyApi } from '../services/api/endpoints.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.js';
import { useAuth } from '../contexts/AuthContext.js';

// Monaco Editor - lazy loaded
import Editor from '@monaco-editor/react';

type ConfigMode = 'local' | 'service';

export function ConfigManagement() {
  const { user } = useAuth();
  const { bots, fetchBots } = useBotStore();
  const navigate = useNavigate();
  
  // State
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [pendingBotId, setPendingBotId] = useState<string>('');
  const [botSearch, setBotSearch] = useState('');
  const lastAutoLoadedRef = useRef<string | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<BotConfig | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [versions, setVersions] = useState<ConfigVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [diffs, setDiffs] = useState<ConfigDiff[]>([]);
  const [configMode, setConfigMode] = useState<ConfigMode>('local');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [agentUrl, setAgentUrl] = useState('');
  const [agentStatus, setAgentStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');
  const [botState, setBotState] = useState<string>('UNKNOWN');
  const [isCheckingBotState, setIsCheckingBotState] = useState(false);
  const [isStoppingBot, setIsStoppingBot] = useState(false);
  
  const editorRef = useRef<unknown>(null);
  const isLocalMode = configMode === 'local';
  const activeConfig = isLocalMode ? localConfig : botConfig;
  const isBotRunning = botState === 'RUNNING';
  const agentUrlConflicts = useMemo(() => {
    if (!agentUrl || !selectedBotId) return [];
    return bots.filter((bot) => {
      if (bot.id === selectedBotId) return false;
      const storedUrl = localStorage.getItem(`config_agent_url_${bot.id}`) || '';
      return storedUrl && storedUrl === agentUrl;
    });
  }, [agentUrl, bots, selectedBotId]);
  const hasAgentUrlConflict = agentUrlConflicts.length > 0;
  const filteredBots = useMemo(() => {
    const term = botSearch.trim().toLowerCase();
    if (!term) return bots;
    return bots.filter((bot) =>
      bot.name.toLowerCase().includes(term) || bot.id.toLowerCase().includes(term)
    );
  }, [botSearch, bots]);

  useEffect(() => {
    if (!botSearch.trim()) return;
    if (filteredBots.length === 1) {
      setPendingBotId(filteredBots[0].id);
    }
  }, [botSearch, filteredBots]);
  const setupClipboardShortcuts = (editor: any, monaco: any) => {
    const writeClipboardText = async (text: string) => {
      if (!text) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          return;
        }
      } catch {
        // Fall through to legacy copy
      }
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // Ignore copy failures
      }
      document.body.removeChild(textarea);
    };

    const readClipboardText = async () => {
      try {
        if (navigator.clipboard?.readText) {
          return await navigator.clipboard.readText();
        }
      } catch {
        // Ignore read failures
      }
      return '';
    };

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyC, async () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;
      const text = model.getValueInRange(selection);
      await writeClipboardText(text);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyX, async () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      if (!selection || !model) return;
      const text = model.getValueInRange(selection);
      if (!text) return;
      await writeClipboardText(text);
      editor.executeEdits('cut', [{ range: selection, text: '', forceMoveMarkers: true }]);
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, async () => {
      const text = await readClipboardText();
      if (!text) return;
      const selection = editor.getSelection();
      if (!selection) return;
      editor.executeEdits('paste', [{ range: selection, text, forceMoveMarkers: true }]);
    });
  };

  // Load bots on mount
  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  useEffect(() => {
    if (selectedBotId) {
      setPendingBotId(selectedBotId);
    }
  }, [selectedBotId]);

  // Load config when bot is selected
  const loadBotConfig = useCallback(async (botId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const config = await configServiceApi.getConfig(botId);
      setBotConfig(config);
      
      if (config) {
        const content = JSON.stringify(config.currentConfig, null, 2);
        setEditorContent(content);
        setOriginalContent(content);
        const resolvedAgentUrl = config.agentUrl || '';
        setAgentUrl(resolvedAgentUrl);
        if (resolvedAgentUrl) {
          localStorage.setItem(`config_agent_url_${botId}`, resolvedAgentUrl);
        }
        
        // Load versions
        const vers = await configServiceApi.getVersions(botId);
        setVersions(vers);
        
        // Check for pending changes
        if (config.hasPendingChanges) {
          const diffResult = await configServiceApi.getDiff(botId);
          setDiffs(diffResult.diffs);
        } else {
          setDiffs([]);
        }
      } else {
        setEditorContent('');
        setOriginalContent('');
        setVersions([]);
        setDiffs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLocalConfigFromAgent = useCallback(async (botId: string, url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await configAgentApi.readConfig(url);
      const content = JSON.stringify(response.config, null, 2);
      setEditorContent(content);
      setOriginalContent(content);
      setLocalConfig({
        botId,
        botName: bots.find((bot) => bot.id === botId)?.name || 'Bot',
        currentConfig: response.config as FreqtradeConfig,
        currentVersion: 0,
        hasPendingChanges: false,
        agentUrl: url,
        lastSyncedAt: response.readAt,
        createdAt: response.readAt || new Date().toISOString(),
        updatedAt: response.readAt || new Date().toISOString(),
      });
      setVersions([]);
      setDiffs([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config from agent');
    } finally {
      setIsLoading(false);
    }
  }, [bots]);

  const loadBotState = useCallback(async (botId: string) => {
    setIsCheckingBotState(true);
    try {
      const configData = await proxyApi.get(botId, 'api/v1/show_config');
      const state = configData && typeof configData === 'object'
        ? (configData as { state?: string }).state
        : undefined;
      setBotState(state ? String(state).toUpperCase() : 'UNKNOWN');
    } catch {
      setBotState('UNKNOWN');
    } finally {
      setIsCheckingBotState(false);
    }
  }, []);

  const stopBot = useCallback(async () => {
    if (!selectedBotId) return false;
    setIsStoppingBot(true);
    setError(null);
    try {
      await proxyApi.post(selectedBotId, 'api/v1/stop');
      setBotState('STOPPED');
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop bot');
      return false;
    } finally {
      setIsStoppingBot(false);
    }
  }, [selectedBotId]);

  const handleEditBot = useCallback(async () => {
    if (!selectedBotId) return;
    if (isBotRunning) {
      const stopped = await stopBot();
      if (!stopped) return;
    }
    navigate(`/bots?edit=${selectedBotId}`);
  }, [isBotRunning, navigate, selectedBotId, stopBot]);

  // Handle bot selection
  const handleBotSelect = (botId: string) => {
    setSelectedBotId(botId);
    setSelectedVersion(null);
    setShowVersions(false);
    setShowDiff(false);
    const storedAgentUrl = localStorage.getItem(`config_agent_url_${botId}`) || '';
    setAgentUrl(storedAgentUrl);
    setLocalConfig(null);
    if (!isLocalMode) {
      loadBotConfig(botId);
    } else {
      setEditorContent('');
      setOriginalContent('');
      setVersions([]);
      setDiffs([]);
    }
  };

  useEffect(() => {
    if (!botSearch.trim()) return;
    if (filteredBots.length !== 1) return;
    const onlyBot = filteredBots[0];
    if (!onlyBot || selectedBotId === onlyBot.id) return;
    if (lastAutoLoadedRef.current === onlyBot.id) return;
    lastAutoLoadedRef.current = onlyBot.id;
    handleBotSelect(onlyBot.id);
  }, [botSearch, filteredBots, selectedBotId]);

  // Check if content has changed
  const hasChanges = editorContent !== originalContent;
  const hasEditorContent = editorContent.trim().length > 0;

  // Save config (creates draft)
  const handleSave = async () => {
    if (!selectedBotId || !hasChanges || isLocalMode) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      const config = JSON.parse(editorContent);
      await configServiceApi.updateConfig(selectedBotId, { config });
      setSuccess('Config saved as draft');
      await loadBotConfig(selectedBotId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  // Apply draft
  const handleApplyDraft = async () => {
    if (!selectedBotId || !botConfig?.hasPendingChanges || isLocalMode) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await configServiceApi.applyDraft(selectedBotId, 'Applied from UI');
      setSuccess('Draft applied successfully');
      await loadBotConfig(selectedBotId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply draft');
    } finally {
      setIsSaving(false);
    }
  };

  // Discard draft
  const handleDiscardDraft = async () => {
    if (!selectedBotId || !botConfig?.hasPendingChanges || isLocalMode) return;
    
    if (!confirm('Discard pending changes?')) return;
    
    setIsSaving(true);
    try {
      await configServiceApi.discardDraft(selectedBotId);
      setSuccess('Draft discarded');
      await loadBotConfig(selectedBotId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discard draft');
    } finally {
      setIsSaving(false);
    }
  };

  // PULL from agent
  const handlePull = async () => {
    if (!selectedBotId || !agentUrl) return;
    if (hasAgentUrlConflict) {
      const names = agentUrlConflicts.map((bot) => bot.name).join(', ');
      setError(`Agent URL already used by: ${names}. Use a unique agent URL.`);
      return;
    }
    
    setIsPulling(true);
    setError(null);
    
    try {
      if (isLocalMode) {
        await loadLocalConfigFromAgent(selectedBotId, agentUrl);
        setSuccess('Config pulled from agent');
      } else {
        const result = await configServiceApi.pull(selectedBotId, agentUrl);
        setSuccess(`Config pulled from ${result.path}`);
        await loadBotConfig(selectedBotId);
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pull config');
    } finally {
      setIsPulling(false);
    }
  };

  // PUSH to agent
  const handlePush = async () => {
    if (!selectedBotId || !agentUrl) return;
    if (hasAgentUrlConflict) {
      const names = agentUrlConflicts.map((bot) => bot.name).join(', ');
      setError(`Agent URL already used by: ${names}. Use a unique agent URL.`);
      return;
    }
    
    const isDryRun = activeConfig?.currentConfig?.dry_run;
    if (isDryRun === false) {
      if (!confirm('⚠️ This bot is in LIVE mode. Are you sure you want to push the config?')) {
        return;
      }
    }
    
    setIsPushing(true);
    setError(null);
    
    try {
      if (isLocalMode) {
        let parsedConfig: Record<string, unknown>;
        try {
          parsedConfig = JSON.parse(editorContent) as Record<string, unknown>;
        } catch {
          setError('Invalid JSON - fix before pushing');
          return;
        }
        await configAgentApi.pushConfig(agentUrl, parsedConfig, true);
        setSuccess('Config pushed to agent and bot reloaded');
        setOriginalContent(editorContent);
        setLocalConfig((prev) => prev ? {
          ...prev,
          currentConfig: parsedConfig as FreqtradeConfig,
          updatedAt: new Date().toISOString(),
        } : prev);
      } else {
        await configServiceApi.push(selectedBotId, agentUrl, true);
        setSuccess('Config pushed and bot reloaded');
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push config');
    } finally {
      setIsPushing(false);
    }
  };

  // Check agent status
  const checkAgentStatus = async () => {
    if (!selectedBotId || !agentUrl) {
      setAgentStatus('unknown');
      return;
    }
    
    try {
      if (isLocalMode) {
        const health = await configAgentApi.health(agentUrl);
        setAgentStatus(health ? 'online' : 'offline');
      } else {
        const health = await configServiceApi.checkAgentHealth(selectedBotId, agentUrl);
        setAgentStatus(health ? 'online' : 'offline');
      }
    } catch {
      setAgentStatus('offline');
    }
  };

  const handleRefreshConfig = async () => {
    if (!selectedBotId) return;
    if (isLocalMode) {
      if (!agentUrl) {
        setError('Agent URL is required to refresh');
        return;
      }
      await handlePull();
    } else {
      await loadBotConfig(selectedBotId);
    }
  };

  // Load version
  const handleLoadVersion = async (version: number) => {
    if (!selectedBotId || isLocalMode) return;
    
    setIsLoading(true);
    try {
      const ver = await configServiceApi.getVersion(selectedBotId, version);
      if (ver) {
        setEditorContent(JSON.stringify(ver.config, null, 2));
        setSelectedVersion(version);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version');
    } finally {
      setIsLoading(false);
    }
  };

  // Rollback to version
  const handleRollback = async (version: number) => {
    if (!selectedBotId || isLocalMode) return;
    
    if (!confirm(`Rollback to version ${version}?`)) return;
    
    setIsLoading(true);
    try {
      await configServiceApi.rollback(selectedBotId, version, false, `Rollback to v${version} from UI`);
      setSuccess(`Rolled back to version ${version}`);
      setSelectedVersion(null);
      await loadBotConfig(selectedBotId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick toggle dry_run
  const handleToggleRunmode = async () => {
    if (!selectedBotId || !activeConfig) return;
    
    if (isLocalMode) {
      try {
        const parsedConfig = JSON.parse(editorContent || '{}') as Record<string, unknown>;
        const currentMode = Boolean(parsedConfig.dry_run);
        parsedConfig.dry_run = !currentMode;
        setEditorContent(JSON.stringify(parsedConfig, null, 2));
        setSuccess('Runmode updated in editor. Push to apply.');
        setTimeout(() => setSuccess(null), 3000);
      } catch {
        setError('Invalid JSON - fix before changing runmode');
      }
      return;
    }

    const currentMode = activeConfig.currentConfig.dry_run;
    const newMode = currentMode ? 'live' : 'dry_run';
    
    if (newMode === 'live') {
      if (!confirm('⚠️ Switch to LIVE trading mode? This will use REAL money.')) {
        return;
      }
    }
    
    setIsSaving(true);
    try {
      await configServiceApi.setRunmode(selectedBotId, newMode);
      setSuccess(`Switched to ${newMode === 'dry_run' ? 'Dry Run' : 'Live'} mode`);
      await loadBotConfig(selectedBotId);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change runmode');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset editor to original
  const handleReset = () => {
    setEditorContent(originalContent);
    setSelectedVersion(null);
  };

  // Format JSON
  const handleFormat = () => {
    try {
      const parsed = JSON.parse(editorContent);
      setEditorContent(JSON.stringify(parsed, null, 2));
    } catch {
      setError('Invalid JSON - cannot format');
    }
  };

  const isReadOnly = user?.role === 'auditor';

  useEffect(() => {
    if (!selectedBotId) return;
    if (!isLocalMode) {
      loadBotConfig(selectedBotId);
    } else {
      setBotConfig(null);
      setLocalConfig(null);
      setEditorContent('');
      setOriginalContent('');
      setVersions([]);
      setDiffs([]);
      const storedAgentUrl = localStorage.getItem(`config_agent_url_${selectedBotId}`) || '';
      setAgentUrl(storedAgentUrl);
    }
    loadBotState(selectedBotId);
  }, [isLocalMode, loadBotConfig, loadBotState, selectedBotId]);

  return (
    <div className="min-h-screen bg-background dark">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FileJson className="h-8 w-8" />
            Config Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage Freqtrade bot configurations with version control
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Bot Selector */}
          <div className="col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bots</CardTitle>
                <CardDescription>Select a bot to manage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Select bot</label>
                    <input
                      type="text"
                      value={botSearch}
                      onChange={(e) => setBotSearch(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <select
                      value={pendingBotId}
                      onChange={(e) => setPendingBotId(e.target.value)}
                      className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">Choose a bot...</option>
                      {filteredBots.map((bot) => (
                        <option key={bot.id} value={bot.id}>
                          {bot.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-muted-foreground mt-1">
                      {filteredBots.length} of {bots.length}
                    </div>
                  </div>
                  <button
                    onClick={() => pendingBotId && handleBotSelect(pendingBotId)}
                    disabled={!pendingBotId}
                    className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    Ok
                  </button>
                  {bots.length === 0 && (
                    <p className="text-muted-foreground text-sm">No bots found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Agent Connection */}
            {selectedBotId && (
              <Card className="mt-4">
              <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    Config Agent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Mode:</span>
                      <button
                        onClick={() => setConfigMode('local')}
                        className={`px-2 py-1 rounded ${
                          isLocalMode
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Local (Agent)
                      </button>
                      <button
                        onClick={() => setConfigMode('service')}
                        className={`px-2 py-1 rounded ${
                          !isLocalMode
                            ? 'bg-green-500 text-white'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        Config Service
                      </button>
                    </div>
                    <span className="text-muted-foreground">
                      Local edits the bot config directly (no drafts/versioning). Config Service stores drafts/versions in Mongo and then pushes to the bot.
                    </span>
                  </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Agent URL</label>
                      <input
                        type="text"
                        value={agentUrl}
                      onChange={(e) => {
                        const value = e.target.value;
                        setAgentUrl(value);
                        if (selectedBotId) {
                          localStorage.setItem(`config_agent_url_${selectedBotId}`, value);
                        }
                      }}
                        placeholder="http://agent:3010"
                        className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={checkAgentStatus}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Check Status
                      </button>
                      {agentStatus === 'online' && (
                        <span className="flex items-center gap-1 text-xs text-green-500">
                          <CheckCircle2 className="h-3 w-3" /> Online
                        </span>
                      )}
                      {agentStatus === 'offline' && (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle className="h-3 w-3" /> Offline
                        </span>
                      )}
                    </div>
                    {agentUrlConflicts.length > 0 && (
                      <div className="text-xs text-yellow-500">
                        This agent URL is also used by: {agentUrlConflicts.map((bot) => bot.name).join(', ')}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handlePull}
                        disabled={isPulling || !agentUrl || isReadOnly || hasAgentUrlConflict}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
                      >
                        {isPulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {isLocalMode ? 'Pull (Local)' : 'Pull'}
                      </button>
                      <button
                        onClick={handlePush}
                        disabled={isPushing || !agentUrl || isReadOnly || !hasEditorContent || hasAgentUrlConflict}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                      >
                        {isPushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {isLocalMode ? 'Push (Local)' : 'Push'}
                      </button>
                    </div>
                    {!hasEditorContent && (
                      <span className="text-xs text-muted-foreground">
                        Load config first (use Pull).
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Editor */}
          <div className="col-span-9">
            {selectedBotId ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {bots.find((b) => b.id === selectedBotId)?.name || 'Config'}
                        {activeConfig && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {isLocalMode ? 'local' : `v${activeConfig.currentVersion}`}
                          </span>
                        )}
                        {!isLocalMode && selectedVersion && (
                          <span className="text-sm font-normal text-yellow-500">
                            (viewing v{selectedVersion})
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-1">
                        {activeConfig && (
                          activeConfig.currentConfig.dry_run ? (
                            <span className="text-yellow-500">🔶 Dry Run</span>
                          ) : (
                            <span className="text-green-500">💰 Live Trading</span>
                          )
                        )}
                        {!isLocalMode && activeConfig?.hasPendingChanges && (
                          <span className="text-orange-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Pending changes
                          </span>
                        )}
                        {hasChanges && (
                          <span className="text-blue-500">• Unsaved changes</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleRunmode}
                        disabled={isSaving || isReadOnly || !activeConfig}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          activeConfig?.currentConfig.dry_run
                            ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                        } disabled:opacity-50`}
                      >
                        {activeConfig?.currentConfig.dry_run ? 'Go Live' : 'Go Dry'}
                      </button>
                      {!isLocalMode && (
                        <button
                        onClick={() => setShowVersions(!showVersions)}
                        className="p-2 hover:bg-muted rounded-lg"
                        title="Version History"
                        >
                          <History className="h-4 w-4" />
                        </button>
                      )}
                      {!isLocalMode && (
                        <button
                        onClick={() => setShowDiff(!showDiff)}
                        className="p-2 hover:bg-muted rounded-lg"
                        title="Show Diff"
                        disabled={diffs.length === 0}
                        >
                          <GitCompare className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={handleRefreshConfig}
                        className="p-2 hover:bg-muted rounded-lg"
                        title="Refresh"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Messages */}
                  {error && (
                    <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      {error}
                    </div>
                  )}
                  {success && (
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {success}
                    </div>
                  )}

                  {/* Diff Panel */}
                  {!isLocalMode && showDiff && diffs.length > 0 && (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium mb-2">Pending Changes</h4>
                      <div className="space-y-1 text-sm font-mono">
                        {diffs.map((diff, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={
                              diff.type === 'added' ? 'text-green-500' :
                              diff.type === 'removed' ? 'text-red-500' :
                              'text-yellow-500'
                            }>
                              {diff.type === 'added' ? '+' : diff.type === 'removed' ? '-' : '~'}
                            </span>
                            <span>{diff.field}:</span>
                            {diff.type !== 'added' && (
                              <span className="text-red-400 line-through">{JSON.stringify(diff.oldValue)}</span>
                            )}
                            {diff.type !== 'removed' && (
                              <span className="text-green-400">{JSON.stringify(diff.newValue)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleApplyDraft}
                          disabled={isSaving || isReadOnly}
                          className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                        >
                          Apply Changes
                        </button>
                        <button
                          onClick={handleDiscardDraft}
                          disabled={isSaving || isReadOnly}
                          className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Version History Panel */}
                  {!isLocalMode && showVersions && (
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
                      <h4 className="font-medium mb-2">Version History</h4>
                      <div className="space-y-2">
                        {versions.map((ver) => (
                          <div
                            key={ver.version}
                            className="flex items-center justify-between p-2 bg-background rounded"
                          >
                            <div>
                              <span className="font-medium">v{ver.version}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                {new Date(ver.createdAt).toLocaleString()}
                              </span>
                              {ver.comment && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  - {ver.comment}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleLoadVersion(ver.version)}
                                className="px-2 py-1 text-xs bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30"
                              >
                                View
                              </button>
                              {ver.version !== botConfig?.currentVersion && (
                                <button
                                  onClick={() => handleRollback(ver.version)}
                                  disabled={isReadOnly}
                                  className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-500 rounded hover:bg-yellow-500/30 disabled:opacity-50"
                                >
                                  Rollback
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monaco Editor */}
                  {isLoading ? (
                    <div className="h-[500px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : activeConfig ? (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <Editor
                        height="500px"
                        language="json"
                        theme="vs-dark"
                        value={editorContent}
                        onChange={(value) => setEditorContent(value || '')}
                        onMount={(editor, monaco) => {
                          editorRef.current = editor;
                          setupClipboardShortcuts(editor, monaco);
                        }}
                        options={{
                          minimap: { enabled: false },
                          fontSize: 14,
                          lineNumbers: 'on',
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          tabSize: 2,
                          readOnly: isReadOnly,
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-[500px] flex flex-col items-center justify-center text-muted-foreground">
                      <FileJson className="h-16 w-16 mb-4 opacity-50" />
                      <p>No config found for this bot.</p>
                      {isBotRunning ? (
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <button
                            onClick={stopBot}
                            disabled={isStoppingBot || isCheckingBotState}
                            className="text-red-500 hover:underline disabled:opacity-60"
                          >
                            Stop this bot
                          </button>
                          <button
                            onClick={handleEditBot}
                            disabled={isStoppingBot || isCheckingBotState}
                            className="text-primary hover:underline disabled:opacity-60"
                          >
                            Edit this bot
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleEditBot}
                          disabled={isStoppingBot || isCheckingBotState}
                          className="text-primary hover:underline mt-2 text-sm disabled:opacity-60"
                        >
                          Edit this bot
                        </button>
                      )}
                      <p className="text-sm mt-2">Use Pull to import config from the bot</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      <button
                        onClick={handleFormat}
                        className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg"
                      >
                        Format JSON
                      </button>
                      {selectedVersion && (
                        <button
                          onClick={handleReset}
                          className="px-3 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg flex items-center gap-1"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Reset to Current
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {hasChanges && (
                        <button
                          onClick={handleReset}
                          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
                        >
                          Discard Changes
                        </button>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving || isReadOnly || isLocalMode}
                        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Draft
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="h-[600px] flex flex-col items-center justify-center text-muted-foreground">
                  <Settings className="h-16 w-16 mb-4 opacity-50" />
                  <p className="text-lg">Select a bot to manage its configuration</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
