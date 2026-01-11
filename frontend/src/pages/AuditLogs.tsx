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
import { apiClient } from '../services/api/client.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.js';
import { Calendar, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string;
  username: string | null;
  action: string;
  actionCategory: 'data_change' | 'data_access' | 'system_action' | 'auth';
  resourceType: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  changedFields: string[] | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: number;
}

interface AuditLogsResponse {
  status: string;
  data: AuditLog[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(50);
  
  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');

  useEffect(() => {
    loadLogs();
  }, [currentPage, actionFilter, categoryFilter, resourceTypeFilter]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((currentPage - 1) * limit).toString());
      
      if (actionFilter) params.append('action', actionFilter);
      if (categoryFilter) params.append('actionCategory', categoryFilter);
      if (resourceTypeFilter) params.append('resourceType', resourceTypeFilter);

      const response = await apiClient.get<AuditLogsResponse>(`/audit?${params.toString()}`);
      setLogs(response.data.data);
      setTotal(response.data.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDetails = (details: unknown): string => {
    if (!details) return '-';
    try {
      if (typeof details === 'string') return details;
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'data_change':
        return 'text-blue-400';
      case 'data_access':
        return 'text-green-400';
      case 'system_action':
        return 'text-yellow-400';
      case 'auth':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Audit Logs</h1>
        <p className="text-muted-foreground mt-2">
          View all system actions and changes. Only superadmin and auditor can access.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter size={20} />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Action</label>
              <input
                type="text"
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g., create, update, delete"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              >
                <option value="">All Categories</option>
                <option value="data_change">Data Change</option>
                <option value="data_access">Data Access</option>
                <option value="system_action">System Action</option>
                <option value="auth">Authentication</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Resource Type</label>
              <input
                type="text"
                value={resourceTypeFilter}
                onChange={(e) => {
                  setResourceTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="e.g., bot, user"
                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-md text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total} logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`font-semibold ${getCategoryColor(log.actionCategory)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        on {log.resourceType}
                        {log.resourceId && ` (${log.resourceId.substring(0, 8)}...)`}
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        by {log.username || log.userId.substring(0, 8) || 'system'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded ${getCategoryColor(log.actionCategory)} bg-opacity-20`}>
                        {log.actionCategory}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar size={14} />
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>
                  
                  {log.details != null && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        View Details
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                        {formatDetails(log.details)}
                      </pre>
                    </details>
                  )}

                  {log.changedFields && log.changedFields.length > 0 && (
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Changed fields: </span>
                      <span className="text-foreground">{log.changedFields.join(', ')}</span>
                    </div>
                  )}

                  {log.ipAddress && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      IP: {log.ipAddress}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

