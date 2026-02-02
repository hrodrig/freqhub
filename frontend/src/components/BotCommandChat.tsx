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

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { proxyApi } from '../services/api/endpoints';
import { appLogger } from '../utils/logger.js';

// Component to render help message with clickable commands
function HelpMessageContent({ 
  content, 
  onCommandClick 
}: { 
  content: string; 
  onCommandClick: (command: string) => void;
}) {
  // Split content by lines and process each line
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, lineIndex) => {
        // Handle empty lines - render them with a non-breaking space to preserve spacing
        if (line.trim() === '') {
          return <div key={lineIndex} className="h-3">&nbsp;</div>;
        }
        
        // Match only commands at the start of a line or after whitespace/colon
        // This prevents matching things like "/USDT" in trading pairs (BCH/USDT)
        // Commands must be at line start, after whitespace, or after a colon
        // The regex looks for: (start of line OR whitespace/colon) + slash + letters/underscores + (whitespace OR colon OR end of line)
        // We exclude matches where the slash is preceded by uppercase letters (like in "BCH/USDT")
        const commandRegex = /(?:^|[\s:])(\/[a-z_]+)(?=[\s:]|$)/gi;
        
        // Reset regex lastIndex to avoid issues with global regex
        commandRegex.lastIndex = 0;
        const parts: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = commandRegex.exec(line)) !== null) {
          // Check if the character before the slash is an uppercase letter (like in "BCH/USDT")
          // If so, skip this match as it's part of a trading pair, not a command
          const charBefore = match.index > 0 ? line[match.index - 1] : '';
          if (charBefore && /[A-Z]/.test(charBefore)) {
            continue; // Skip this match, it's part of a trading pair
          }
          
          // Add text before the command
          if (match.index > lastIndex) {
            parts.push(line.substring(lastIndex, match.index));
          }
          
          // Only make the base command clickable (without parameters)
          const baseCommand = match[1]; // e.g., /profit_short
          parts.push(
            <button
              key={`${lineIndex}-${match.index}`}
              onClick={(e) => {
                e.preventDefault();
                onCommandClick(baseCommand);
              }}
              className="text-blue-400 hover:text-blue-300 hover:underline cursor-pointer font-semibold"
            >
              {baseCommand}
            </button>
          );
          
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last command
        if (lastIndex < line.length) {
          parts.push(line.substring(lastIndex));
        }
        
        // If no commands found, return the line as-is
        if (parts.length === 0) {
          return <div key={lineIndex}>{line}</div>;
        }
        
        return <div key={lineIndex}>{parts}</div>;
      })}
    </>
  );
}

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  data?: unknown; // For bot responses with structured data
  command?: string; // The command that generated this message (for bot messages)
}

interface BotCommandChatProps {
  botId: string;
  botName: string;
  readOnly?: boolean;
}

// Common Freqtrade commands
const COMMON_COMMANDS = [
  { command: '/profit', description: 'Show profit summary' },
  { command: '/balance', description: 'Show balance' },
  { command: '/status', description: 'Show open trades (list)' },
  { command: '/status table', description: 'Show open trades (table)' },
  { command: '/config', description: 'Show bot configuration' },
  { command: '/daily', description: 'Show daily profits' },
  { command: '/performance', description: 'Show performance stats' },
  { command: '/count', description: 'Show trade count' },
  { command: '/start', description: 'Start the bot' },
  { command: '/stop', description: 'Stop the bot' },
  { command: '/pause', description: 'Pause the bot' },
  { command: '/help', description: 'Show available commands' },
];

export function BotCommandChat({ botId, botName, readOnly = false }: BotCommandChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isReadOnly = readOnly === true;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (isReadOnly) return;
    // Ensure input keeps focus after scroll
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [messages, isReadOnly]);

  // Focus input on mount
  useEffect(() => {
    if (!isReadOnly) {
      inputRef.current?.focus();
    }
  }, [isReadOnly]);

  // Parse command and execute
  const executeCommand = async (command: string): Promise<unknown> => {
    const trimmed = command.trim();
    if (!trimmed) return null;

    // Handle special POST commands
    if (trimmed === '/start') {
      return await proxyApi.post(botId, 'api/v1/start', {});
    }
    if (trimmed === '/stop') {
      return await proxyApi.post(botId, 'api/v1/stop', {});
    }
    if (trimmed === '/pause') {
      return await proxyApi.post(botId, 'api/v1/pause', {});
    }
    if (trimmed === '/stopentry') {
      return await proxyApi.post(botId, 'api/v1/stopentry', {});
    }
    if (trimmed === '/reload_config' || trimmed === '/reload') {
      return await proxyApi.post(botId, 'api/v1/reload_config', {});
    }
    
    // Handle POST commands with parameters
    if (trimmed.startsWith('/forceexit ') || trimmed.startsWith('/fx ')) {
      const tradeId = trimmed.split(' ')[1];
      const body = tradeId === 'all' ? { tradeid: 'all' } : { tradeid: parseInt(tradeId, 10) };
      return await proxyApi.post(botId, 'api/v1/forceexit', body);
    }
    if (trimmed.startsWith('/delete ')) {
      const tradeId = trimmed.split(' ')[1];
      // Freqtrade API uses DELETE /trades/{tradeid} (api_v1.py line 241)
      return await proxyApi.delete(botId, `api/v1/trades/${tradeId}`);
    }
    if (trimmed.startsWith('/reload_trade ')) {
      const tradeId = trimmed.split(' ')[1];
      return await proxyApi.post(botId, 'api/v1/reload_trade', { tradeid: parseInt(tradeId, 10) });
    }
    if (trimmed.startsWith('/cancel_open_order ') || trimmed.startsWith('/coo ')) {
      const tradeIdStr = trimmed.split(' ')[1];
      if (!tradeIdStr) {
        throw new Error('Trade-id not set.');
      }
      const tradeId = parseInt(tradeIdStr, 10);
      if (isNaN(tradeId)) {
        throw new Error('Trade-id not set.');
      }
      // Freqtrade API uses DELETE /trades/{tradeid}/open-order (api_v1.py line 246)
      return await proxyApi.delete(botId, `api/v1/trades/${tradeId}/open-order`);
    }
    if (trimmed.startsWith('/blacklist_delete ') || trimmed.startsWith('/bl_delete ')) {
      const pairs = trimmed.split(' ').slice(1);
      // Freqtrade uses DELETE /blacklist?pairs_to_delete=PAIR1&pairs_to_delete=PAIR2
      const queryParams = pairs.map(pair => `pairs_to_delete=${encodeURIComponent(pair)}`).join('&');
      const path = `api/v1/blacklist${queryParams ? `?${queryParams}` : ''}`;
      return await proxyApi.delete(botId, path);
    }
    // /unlock is now handled in the switch statement below
    // marketdir without args is handled in the switch below as GET
    if (trimmed.startsWith('/marketdir ') && trimmed.split(' ').length > 1) {
      const direction = trimmed.split(' ')[1];
      return await proxyApi.post(botId, 'api/v1/marketdir', { direction });
    }

    // Handle GET commands (info commands)
    if (trimmed.startsWith('/')) {
      const cmd = trimmed.substring(1).split(' ')[0];
      const params = trimmed.substring(1).split(' ').slice(1);

      switch (cmd) {
        case 'profit': {
          // /profit [<n>] - n is number of days (optional)
          const days = params[0] ? parseInt(params[0], 10) : undefined;
          const url = days ? `api/v1/profit?timescale=${days}` : 'api/v1/profit';
          return await proxyApi.get(botId, url);
        }
        case 'profit_long': {
          // /profit_long [<n>] - profit for long trades only
          const days = params[0] ? parseInt(params[0], 10) : undefined;
          const url = days ? `api/v1/profit?timescale=${days}&is_short=false` : 'api/v1/profit?is_short=false';
          return await proxyApi.get(botId, url);
        }
        case 'profit_short': {
          // /profit_short [<n>] - profit for short trades only
          const days = params[0] ? parseInt(params[0], 10) : undefined;
          const url = days ? `api/v1/profit?timescale=${days}&is_short=true` : 'api/v1/profit?is_short=true';
          return await proxyApi.get(botId, url);
        }
        case 'balance': {
          // /balance total - show full balance (all currencies, not just bot-managed)
          const full = params.includes('total') || params.includes('full');
          const url = full ? 'api/v1/balance?full=true' : 'api/v1/balance';
          return await proxyApi.get(botId, url);
        }
        case 'status': {
          // /status returns open trades (array)
          // /status table also returns open trades (same endpoint, just formatted differently)
          const statusData = await proxyApi.get(botId, 'api/v1/status');
          return { data: statusData, format: params.includes('table') ? 'table' : 'list' };
        }
        case 'config':
        case 'show_config':
          // /config or /show_config returns bot configuration
          return await proxyApi.get(botId, 'api/v1/show_config');
        case 'daily': {
          // /daily <n> - n is number of days
          const days = params[0] ? parseInt(params[0], 10) : 7;
          return await proxyApi.get(botId, `api/v1/daily?timescale=${days}`);
        }
        case 'weekly': {
          // /weekly <n> - n is number of weeks
          const weeks = params[0] ? parseInt(params[0], 10) : 4;
          return await proxyApi.get(botId, `api/v1/weekly?timescale=${weeks}`);
        }
        case 'monthly': {
          // /monthly <n> - n is number of months
          const months = params[0] ? parseInt(params[0], 10) : 6;
          return await proxyApi.get(botId, `api/v1/monthly?timescale=${months}`);
        }
        case 'performance':
          return await proxyApi.get(botId, 'api/v1/performance');
        case 'count':
          return await proxyApi.get(botId, 'api/v1/count');
        case 'trades': {
          // /trades [limit] - limit is optional
          const limit = params[0] ? parseInt(params[0], 10) : 10;
          return await proxyApi.get(botId, `api/v1/trades?limit=${limit}`);
        }
        case 'stats':
          return await proxyApi.get(botId, 'api/v1/stats');
        case 'version':
          return await proxyApi.get(botId, 'api/v1/version');
        case 'locks':
          return await proxyApi.get(botId, 'api/v1/locks');
        case 'unlock': {
          // /unlock without args: show current locks (so user can see IDs to unlock)
          // /unlock <pair|id>: unlock and show updated locks
          if (!params[0]) {
            // No parameter - just show current locks
            return await proxyApi.get(botId, 'api/v1/locks');
          }
          // Has parameter - unlock and show updated locks
          const arg = params[0];
          // Try to parse as number (lock id), otherwise treat as pair
          const lockId = parseInt(arg, 10);
          const body = !isNaN(lockId) ? { lockid: lockId } : { pair: arg };
          try {
            await proxyApi.post(botId, 'api/v1/unlock', body);
          } catch (error) {
            // If unlock fails (e.g., lock doesn't exist), just show current locks
            // This will show "No active locks." if there are no locks
          }
          // After unlocking (or if it failed), show updated locks (like Telegram)
          return await proxyApi.get(botId, 'api/v1/locks');
        }
        case 'logs': {
          // /logs [limit] - limit is optional, defaults to 10
          const limit = params[0] ? parseInt(params[0], 10) : 10;
          return await proxyApi.get(botId, `api/v1/logs?limit=${limit}`);
        }
        case 'health':
          return await proxyApi.get(botId, 'api/v1/health');
        case 'whitelist': {
          // /whitelist [sorted] [baseonly] - optional parameters
          const sorted = params.includes('sorted') ? '&sorted=true' : '';
          const baseonly = params.includes('baseonly') ? '&baseonly=true' : '';
          return await proxyApi.get(botId, `api/v1/whitelist${sorted}${baseonly}`);
        }
        case 'blacklist':
          return await proxyApi.get(botId, 'api/v1/blacklist');
        case 'blacklist_delete':
        case 'bl_delete': {
          // /blacklist_delete without args: show current blacklist (so user can see pairs to delete)
          // /blacklist_delete <pairs>: delete pairs and show updated blacklist
          if (!params[0]) {
            // No parameter - just show current blacklist
            return await proxyApi.get(botId, 'api/v1/blacklist');
          }
          // Has parameters - delete pairs and show updated blacklist
          const pairs = params;
          // Freqtrade uses DELETE /blacklist?pairs_to_delete=PAIR1&pairs_to_delete=PAIR2
          const queryParams = pairs.map(pair => `pairs_to_delete=${encodeURIComponent(pair)}`).join('&');
          const path = `api/v1/blacklist${queryParams ? `?${queryParams}` : ''}`;
          return await proxyApi.delete(botId, path);
        }
        case 'entries': {
          // /entries <pair|none> - pair is optional
          const pair = params[0] && params[0] !== 'none' ? params[0] : undefined;
          const url = pair ? `api/v1/entries?pair=${encodeURIComponent(pair)}` : 'api/v1/entries';
          return await proxyApi.get(botId, url);
        }
        case 'exits': {
          // /exits <pair|none> - pair is optional
          const pair = params[0] && params[0] !== 'none' ? params[0] : undefined;
          const url = pair ? `api/v1/exits?pair=${encodeURIComponent(pair)}` : 'api/v1/exits';
          return await proxyApi.get(botId, url);
        }
        case 'mix_tags': {
          // /mix_tags <pair|none> - pair is optional
          const pair = params[0] && params[0] !== 'none' ? params[0] : undefined;
          const url = pair ? `api/v1/mix_tags?pair=${encodeURIComponent(pair)}` : 'api/v1/mix_tags';
          return await proxyApi.get(botId, url);
        }
        case 'marketdir': {
          // /marketdir without args - GET current market direction
          // Note: Freqtrade may not have a GET endpoint, so we'll try POST with empty body or handle it differently
          // For now, if no args, we'll show a message asking for direction
          if (params.length === 0) {
            // Try to get current direction - if endpoint doesn't exist, show error
            try {
              return await proxyApi.get(botId, 'api/v1/marketdir');
            } catch {
              return { error: 'Please specify a direction: /marketdir [long | short | even | none]' };
            }
          }
          // With args, it's handled as POST above
          throw new Error('Invalid usage. Use /marketdir [long | short | even | none]');
        }
        case 'list_custom_data': {
          // /list_custom_data <trade_id> [key] - key is optional
          if (params.length === 0) {
            throw new Error('Trade ID required. Usage: /list_custom_data <trade_id> [key]');
          }
          const tradeId = params[0];
          const key = params[1];
          const url = key 
            ? `api/v1/list_custom_data?trade_id=${tradeId}&key=${encodeURIComponent(key)}`
            : `api/v1/list_custom_data?trade_id=${tradeId}`;
          return await proxyApi.get(botId, url);
        }
        case 'delete': {
          // /delete <trade_id> (like Freqtrade telegram.py line 1590-1592)
          // Freqtrade API uses DELETE /trades/{tradeid} (api_v1.py line 241)
          if (params.length === 0) {
            throw new Error('Trade-id not set.');
          }
          const tradeId = parseInt(params[0], 10);
          if (isNaN(tradeId)) {
            throw new Error('Trade-id not set.');
          }
          return await proxyApi.delete(botId, `api/v1/trades/${tradeId}`);
        }
        case 'reload_trade': {
          // /reload_trade <trade_id> (like Freqtrade telegram.py line 1397-1398)
          if (params.length === 0) {
            throw new Error('Trade-id not set.');
          }
          const tradeId = parseInt(params[0], 10);
          if (isNaN(tradeId)) {
            throw new Error('Trade-id not set.');
          }
          return await proxyApi.post(botId, 'api/v1/reload_trade', { tradeid: tradeId });
        }
        case 'cancel_open_order': {
          // /cancel_open_order <trade_id> (like Freqtrade telegram.py line 1608-1609)
          // Freqtrade API uses DELETE /trades/{tradeid}/open-order (api_v1.py line 246)
          if (params.length === 0) {
            throw new Error('Trade-id not set.');
          }
          const tradeId = parseInt(params[0], 10);
          if (isNaN(tradeId)) {
            throw new Error('Trade-id not set.');
          }
          return await proxyApi.delete(botId, `api/v1/trades/${tradeId}/open-order`);
        }
        case 'coo': {
          // /coo <trade_id> - alias to /cancel_open_order (like Freqtrade telegram.py line 1608-1609)
          // Freqtrade API uses DELETE /trades/{tradeid}/open-order (api_v1.py line 246)
          if (params.length === 0) {
            throw new Error('Trade-id not set.');
          }
          const tradeId = parseInt(params[0], 10);
          if (isNaN(tradeId)) {
            throw new Error('Trade-id not set.');
          }
          return await proxyApi.delete(botId, `api/v1/trades/${tradeId}/open-order`);
        }
        case 'forceexit':
        case 'fx': {
          // /forceexit <trade_id>|all or /fx <trade_id>|all (like Freqtrade telegram.py line 1413-1415)
          // If no params, show list of open trades (like Telegram line 1416-1438)
          if (params.length === 0) {
            // Get open trades to show list (like Telegram does)
            const statusData = await proxyApi.get(botId, 'api/v1/status');
            if (Array.isArray(statusData) && statusData.length > 0) {
              // Return formatted list of trades for user to see
              return { 
                forceexit_list: true,
                trades: statusData,
                message: 'Which trade? Use /forceexit <trade_id> or /forceexit all'
              };
            } else {
              throw new Error('No open trade found.');
            }
          }
          const tradeId = params[0];
          const body = tradeId === 'all' ? { tradeid: 'all' } : { tradeid: parseInt(tradeId, 10) };
          if (tradeId !== 'all' && isNaN(body.tradeid as number)) {
            throw new Error('Trade-id must be a number or "all".');
          }
          return await proxyApi.post(botId, 'api/v1/forceexit', body);
        }
        case 'help':
          return {
            help: true,
            commands: `Bot Control
------------
/start: Starts the trader
/pause: Pause the new entries for trader, but handles open trades gracefully
/stop: Stops the trader
/stopentry: Stops entering, but handles open trades gracefully 
/forceexit <trade_id>|all: Instantly exits the given trade or all trades, regardless of profit
/fx <trade_id>|all: Alias to /forceexit
/delete <trade_id>: Instantly delete the given trade in the database
/reload_trade <trade_id>: Reload trade from exchange Orders
/cancel_open_order <trade_id>: Cancels open orders for trade. Only valid when the trade has open orders.
/coo <trade_id>|all: Alias to /cancel_open_order
/whitelist [sorted] [baseonly]: Show current whitelist. Optionally in order and/or only displaying the base currency of each pairing.
/blacklist [pair]: Show current blacklist, or adds one or more pairs to the blacklist. 
/blacklist_delete [pairs]| /bl_delete [pairs]: Delete pair / pattern from blacklist. Will reset on reload_conf. 
/reload_config: Reload configuration file 
/unlock <pair|id>: Unlock this Pair (or this lock id if it's numeric)


Current state
------------
/show_config: Show running configuration 
/locks: Show currently locked pairs
/balance: Show bot managed balance per currency
/balance total: Show account balance per currency
/logs [limit]: Show latest logs - defaults to 10 
/count: Show number of active trades compared to allowed number of trades
/health: Show latest process timestamp - defaults to 1970-01-01 00:00:00 
/marketdir [long | short | even | none]: Updates the user managed variable that represents the current market direction.
  If no direction is provided the currently set market direction will be output. 
/list_custom_data <trade_id> <key>: List custom_data for Trade ID & Key combo.
  If no Key is supplied it will list all key-value pairs found for that Trade ID.

Statistics
------------
/status <trade_id>|[table]: Lists all open trades
         <trade_id> : Lists one or more specific trades.
                        Separate multiple <trade_id> with a blank space.
         table : will display trades in a table
                pending buy orders are marked with an asterisk (*)
                pending sell orders are marked with a double asterisk (**)
/entries <pair|none>: Shows the enter_tag performance
/exits <pair|none>: Shows the exit reason performance
/mix_tags <pair|none>: Shows combined entry tag + exit reason performance
/trades [limit]: Lists last closed trades (limited to 10 by default)
/profit [<n>]: Lists cumulative profit from all finished trades, over the last n days
/profit_long [<n>]: Lists cumulative profit from all finished long trades, over the last n days
/profit_short [<n>]: Lists cumulative profit from all finished short trades, over the last n days
/performance: Show performance of each finished trade grouped by pair
/daily <n>: Shows profit or loss per day, over the last n days
/weekly <n>: Shows statistics per week, over the last n weeks
/monthly <n>: Shows statistics per month, over the last n months
/stats: Shows Wins / losses by Sell reason as well as Avg. holding durations for buys and sells.
/help: This help message
/version: Show version`,
          };
        default:
          throw new Error(`Unknown command: ${cmd}. Type /help for available commands.`);
      }
    }

    return null;
  };

  // Format bot response for display
  const formatBotResponse = (data: unknown, command?: string): string => {
    if (data === null || data === undefined) {
      return 'No response';
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object') {
      // Handle status responses (from POST commands like start/stop/pause/reload_trade)
      if ('status' in data && typeof (data as { status: string }).status === 'string') {
        const statusValue = (data as { status: string }).status;
        // Format as "Status: <value>" (like Telegram)
        return `Status: ${statusValue}`;
      }

      // Handle result_msg responses (from POST commands like delete)
      if ('result_msg' in data && typeof (data as { result_msg: string }).result_msg === 'string') {
        const resultMsg = (data as { result_msg: string }).result_msg;
        // For delete command, add warning message
        if (command?.startsWith('/delete')) {
          return `${resultMsg}\nPlease make sure to take care of this asset on the exchange manually.`;
        }
        return resultMsg;
      }

      // Handle forceexit response (usually just success or error)
      if (command?.startsWith('/forceexit') || command?.startsWith('/fx')) {
        // If it's a list request (no params), show the trades
        if (typeof data === 'object' && data !== null && 'forceexit_list' in data) {
          const listData = data as { trades?: unknown[]; message?: string };
          if (listData.trades && Array.isArray(listData.trades) && listData.trades.length > 0) {
            // Format trades list (like Telegram shows "Which trade?")
            let result = 'Which trade? Use /forceexit <trade_id> or /forceexit all\n\n';
            result += formatStatusList(listData.trades);
            return result;
          }
          return listData.message || 'No open trades found.';
        }
        if ('status' in data || 'result' in data) {
          return 'Trade exit initiated.';
        }
        // If it's an error, it will be caught in the catch block
        return 'Trade exit initiated.';
      }

      // Handle cancel_open_order response
      if (command?.startsWith('/cancel_open_order') || command?.startsWith('/coo')) {
        return 'Open order canceled.';
      }

      // Handle blacklist_delete response (returns updated blacklist, same format as /blacklist)
      if (command?.startsWith('/blacklist_delete') || command?.startsWith('/bl_delete')) {
        // blacklist_delete returns the same format as /blacklist (with blacklist, length, errors)
        return formatBlacklist(data);
      }

      // Handle unlock response - after unlock, it shows updated locks
      // The formatLocks function will handle the display
      if (command?.startsWith('/unlock')) {
        // If the response is locks data, formatLocks will handle it
        // Otherwise, it's already formatted
        if (typeof data === 'object' && data !== null && 'locks' in data) {
          return formatLocks(data);
        }
        return 'Lock removed.';
      }

      // Handle marketdir response
      if (command?.startsWith('/marketdir')) {
        if ('error' in data && typeof (data as { error: string }).error === 'string') {
          return (data as { error: string }).error;
        }
        if ('direction' in data && typeof (data as { direction: string }).direction === 'string') {
          const direction = (data as { direction: string }).direction;
          return `Currently set market direction: ${direction}`;
        }
        if (typeof data === 'string') {
          return data;
        }
        // Check if it's a success message from POST
        if ('status' in data || 'result' in data) {
          return 'Market direction updated.';
        }
        return 'Market direction updated.';
      }

      // Handle list_custom_data response
      if (command?.startsWith('/list_custom_data')) {
        if (Array.isArray(data) && data.length > 0) {
          const result = data[0];
          if ('custom_data' in result && Array.isArray((result as { custom_data: unknown[] }).custom_data)) {
            const customData = (result as { custom_data: Array<{ key: string; type: string; value: unknown; created_at?: string; updated_at?: string }> }).custom_data;
            if (customData.length === 0) {
              return 'No custom data found for this trade.';
            }
            let output = `Found custom-data ${customData.length > 1 ? 'entries' : 'entry'}:\n\n`;
            customData.forEach((item) => {
              output += `Key: ${item.key}\n`;
              output += `Type: ${item.type}\n`;
              output += `Value: ${JSON.stringify(item.value)}\n`;
              if (item.created_at) {
                output += `Create Date: ${item.created_at}\n`;
              }
              if (item.updated_at) {
                output += `Update Date: ${item.updated_at}\n`;
              }
              output += '\n';
            });
            return output.trim();
          }
        }
        return 'No custom data found.';
      }

      // Handle status command with format option
      if ('data' in data && 'format' in data && Array.isArray((data as { data: unknown }).data)) {
        const trades = (data as { data: unknown[]; format: string }).data;
        const format = (data as { data: unknown[]; format: string }).format;
        
        if (trades.length === 0) {
          return 'No open trades';
        }

        if (format === 'table') {
          return formatStatusTable(trades);
        } else {
          return formatStatusList(trades);
        }
      }

      // Handle balance command specifically (including /balance total)
      if (command?.startsWith('/balance') && typeof data === 'object' && data !== null) {
        return formatBalance(data);
      }

      // Handle profit commands specifically (including with parameters like /profit_short 5)
      if ((command?.startsWith('/profit') || command?.startsWith('/profit_long') || command?.startsWith('/profit_short')) && typeof data === 'object' && data !== null) {
        return formatProfit(data, command);
      }

      // Handle count command specifically
      if (command === '/count' && typeof data === 'object' && data !== null) {
        return formatCount(data);
      }

      // Handle trades command specifically
      if (command?.startsWith('/trades') && typeof data === 'object' && data !== null) {
        if ('trades' in data && Array.isArray((data as { trades: unknown[] }).trades)) {
          return formatTrades(data);
        }
      }

      // Handle mix_tags command specifically
      if (command?.startsWith('/mix_tags') && Array.isArray(data)) {
        return formatMixTags(data);
      }

      // Handle exits command specifically
      if (command?.startsWith('/exits') && Array.isArray(data)) {
        return formatExits(data);
      }

      // Handle entries command specifically
      if (command?.startsWith('/entries') && Array.isArray(data)) {
        return formatEntries(data);
      }

      // Handle health command specifically
      if (command === '/health' && typeof data === 'object' && data !== null) {
        return formatHealth(data);
      }

      // Handle logs command specifically
      if (command?.startsWith('/logs') && typeof data === 'object' && data !== null) {
        if ('logs' in data && Array.isArray((data as { logs: unknown[] }).logs)) {
          return formatLogs(data);
        }
      }

      // Handle locks command specifically
      if (command === '/locks' && typeof data === 'object' && data !== null) {
        if ('locks' in data && Array.isArray((data as { locks: unknown[] }).locks)) {
          return formatLocks(data);
        }
      }

      // Handle blacklist command specifically
      if (command === '/blacklist' && typeof data === 'object' && data !== null) {
        return formatBlacklist(data);
      }

      // Handle whitelist command specifically
      if (command?.startsWith('/whitelist') && typeof data === 'object' && data !== null) {
        return formatWhitelist(data);
      }

      // Handle show_config/config command specifically
      if ((command === '/show_config' || command === '/config') && typeof data === 'object' && data !== null) {
        return formatShowConfig(data);
      }

      // Handle daily/weekly/monthly commands specifically
      if (command?.startsWith('/daily') && typeof data === 'object' && data !== null) {
        // Check if it's the daily format (has 'data' array)
        if ('data' in data && Array.isArray((data as { data: unknown[] }).data)) {
          return formatDaily(data);
        }
      }
      if (command?.startsWith('/weekly') && typeof data === 'object' && data !== null) {
        // Check if it's the weekly format (has 'data' array)
        if ('data' in data && Array.isArray((data as { data: unknown[] }).data)) {
          return formatWeekly(data);
        }
      }
      if (command?.startsWith('/monthly') && typeof data === 'object' && data !== null) {
        // Check if it's the monthly format (has 'data' array)
        if ('data' in data && Array.isArray((data as { data: unknown[] }).data)) {
          return formatMonthly(data);
        }
      }

      // Handle help command specifically
      if (command === '/help' && typeof data === 'object' && data !== null && 'help' in data) {
        return (data as { commands?: string }).commands || 'No help available';
      }

      // Handle stats command specifically
      if (command === '/stats' && typeof data === 'object' && data !== null) {
        return formatStats(data);
      }

      // Handle version command specifically
      if (command === '/version' && typeof data === 'object' && data !== null) {
        return formatVersion(data);
      }

      // Handle array responses (like trades from /status)
      if (Array.isArray(data)) {
        // Handle performance command specifically
        if (command === '/performance') {
          return formatPerformance(data);
        }
        if (data.length === 0) {
          if (command?.startsWith('/status')) {
            return 'No open trades';
          }
          return 'No data available';
        }
        
        // Format trades array nicely
        if (command?.startsWith('/status') && data.length > 0 && typeof data[0] === 'object' && 'pair' in data[0]) {
          return formatStatusList(data);
        }
        
        return JSON.stringify(data, null, 2);
      }

      // Handle object responses - format nicely
      return JSON.stringify(data, null, 2);
    }

    return String(data);
  };

  // Format status as table (like Telegram)
  const formatStatusTable = (trades: unknown[]): string => {
    if (!Array.isArray(trades) || trades.length === 0) {
      return 'No open trades';
    }

    const tradeList = trades as Array<{
      trade_id?: number;
      pair?: string;
      profit_abs?: number;
      profit_ratio?: number;
      profit_pct?: number;
      realized_profit?: number;
      open_date?: string;
      amount?: number;
      open_rate?: number;
    }>;

    // Calculate time since open
    const getTimeSince = (openDate: string | undefined): string => {
      if (!openDate) return 'Unknown';
      try {
        const open = new Date(openDate);
        const now = new Date();
        const diffMs = now.getTime() - open.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (diffDays > 0) {
          return `${diffDays} d ago`;
        } else if (diffHours > 0) {
          return `${diffHours} h ago`;
        } else {
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          return `${diffMins} m ago`;
        }
      } catch {
        return 'Unknown';
      }
    };

    // Calculate column widths (matching Telegram format)
    // Telegram uses tabulate with "simple" format, which aligns columns with proper spacing
    // Based on the image, the columns are: ID, Pair, Since, Profit (USD)
    const col1Width = 5;  // ID
    const col2Width = 24; // Pair
    const col3Width = 7;  // Since
    const col4Width = 18; // Profit (USD)

    // Format header - align headers to match Telegram's tabulate format
    // Headers are left-aligned, and each column is separated by 2 spaces
    const idHeader = 'ID'.padEnd(col1Width);
    const pairHeader = 'Pair'.padEnd(col2Width);
    const sinceHeader = 'Since'.padEnd(col3Width);
    const profitHeader = 'Profit (USD)'.padEnd(col4Width);
    
    let table = `${idHeader}  ${pairHeader}  ${sinceHeader}  ${profitHeader}\n`;
    // Separator line with dashes matching each column width, separated by 2 spaces
    table += `${'-'.repeat(col1Width)}  ${'-'.repeat(col2Width)}  ${'-'.repeat(col3Width)}  ${'-'.repeat(col4Width)}\n`;

    // Calculate totals
    let totalUnrealized = 0;
    let totalRealized = 0;

    // Format rows
    tradeList.forEach((trade) => {
      const id = (trade.trade_id || '?').toString();
      const pair = trade.pair || 'Unknown';
      const since = getTimeSince(trade.open_date);
      
      // Get profit values
      const profitAbs = Number(trade.profit_abs ?? 0);
      const profitRatio = Number(trade.profit_ratio ?? trade.profit_pct ?? 0);
      // profit_ratio is already a ratio (0.01 = 1%), so multiply by 100
      const profitPct = profitRatio * 100;
      const realized = Number(trade.realized_profit ?? 0);
      
      totalUnrealized += profitAbs;
      totalRealized += realized;
      
      // Format profit: percentage and USD value in parentheses
      const profitSign = profitPct >= 0 ? '' : '-';
      const profitPctStr = `${profitSign}${Math.abs(profitPct).toFixed(2)}%`;
      const profitUsdStr = `(${profitSign}${Math.abs(profitAbs).toFixed(2)})`;
      const profitStr = `${profitPctStr} ${profitUsdStr}`;
      
      const idCol = id.padEnd(col1Width);
      const pairCol = pair.padEnd(col2Width);
      const sinceCol = since.padEnd(col3Width);
      const profitCol = profitStr;
      
      table += `${idCol}  ${pairCol}  ${sinceCol}  ${profitCol}\n`;
    });

    // Add separator
    table += `${'-'.repeat(col1Width)}  ${'-'.repeat(col2Width)}  ${'-'.repeat(col3Width)}  ${'-'.repeat(col4Width)}\n`;
    
    // Add totals - align to the right of Profit (USD) column
    const totalUnrealizedStr = totalUnrealized >= 0 
      ? `${totalUnrealized.toFixed(2)} USD` 
      : `-${Math.abs(totalUnrealized).toFixed(2)} USD`;
    const totalWithRealized = totalUnrealized + totalRealized;
    const totalWithRealizedStr = totalWithRealized >= 0 
      ? `${totalWithRealized.toFixed(2)} USD` 
      : `-${Math.abs(totalWithRealized).toFixed(2)} USD`;
    
    // Calculate spacing to align totals with Profit (USD) column
    const totalStartCol = col1Width + col2Width + col3Width + 6; // 6 = 2 spaces * 3 gaps
    table += `Total${' '.repeat(totalStartCol - 5)}${totalUnrealizedStr}\n`;
    table += `Total  (incl. realized Profits)${' '.repeat(totalStartCol - 31)}${totalWithRealizedStr}\n`;
    
    return table;
  };

  // Format balance (like Telegram)
  const formatBalance = (balance: unknown): string => {
    if (!balance || typeof balance !== 'object') {
      return 'No balance data available';
    }

    // Log the full balance structure for debugging (can be removed in production if needed)

    const bal = balance as {
      starting_capital?: number;
      starting_capital_fiat?: number;
      starting_capital_pct?: number;
      currencies?: Array<{
        currency?: string;
        free?: number;
        used?: number;
        total?: number;
        available?: number;
        balance?: number;
        pending?: number;
        bot_owned?: number;
        est_stake?: number;
        est_stake_bot?: number;
      }>;
      total?: number;
      total_bot?: number;
      value?: number;
      value_bot?: number;
      stake?: string;
      symbol?: string;
      fiat_display_currency?: string;
      [key: string]: unknown;
    };

    let result = '';

    // Starting capital
    // Freqtrade returns:
    // - starting_capital: in stake currency (USDT)
    // - starting_capital_fiat: in fiat currency (USD)
    if (bal.starting_capital !== undefined) {
      const startingUSDT = bal.starting_capital;
      const startingUSD = bal.starting_capital_fiat ?? startingUSDT; // Use fiat if available, otherwise fallback to USDT
      result += `Starting capital: ${startingUSDT.toFixed(3)} ${bal.stake || 'USDT'}, ${startingUSD.toFixed(3)} USD.\n\n`;
    }

    // Find stake currency (usually USDT)
    const stakeCurrency = bal.stake || 'USDT';
    const stakeCurrencyData = bal.currencies?.find((c) => c.currency === stakeCurrency);

    if (stakeCurrencyData) {
      result += `${stakeCurrency}:\n`;
      result += `  Available: ${(stakeCurrencyData.free ?? 0).toFixed(8)}\n`;
      result += `  Balance: ${(stakeCurrencyData.balance ?? stakeCurrencyData.total ?? 0).toFixed(8)}\n`;
      result += `  Pending: ${(stakeCurrencyData.pending ?? 0).toFixed(8)}\n`;
      
      // Bot owned
      const botOwned = stakeCurrencyData.bot_owned ?? 0;
      result += `  Bot Owned: ${botOwned.toFixed(8)}\n`;
      
      // Estimated USDT (bot managed)
      const estUSDT = stakeCurrencyData.est_stake_bot ?? stakeCurrencyData.est_stake ?? botOwned;
      result += `  Est. ${stakeCurrency}: ${estUSDT.toFixed(3)}\n\n`;
    }

    // Estimated Value (Bot managed assets only)
    // Use total_bot and value_bot for bot-managed assets
    const currentValueBot = bal.total_bot ?? bal.total ?? 0;
    const currentValueBotUSD = bal.value_bot ?? bal.value ?? currentValueBot;
    const startingCapital = bal.starting_capital ?? currentValueBot;
    
    // Calculate profit percentage
    const profitPct = startingCapital > 0 
      ? ((currentValueBot - startingCapital) / startingCapital) * 100 
      : 0;
    
    result += 'Estimated Value (Bot managed assets only):\n';
    result += `  ${stakeCurrency}: ${currentValueBot.toFixed(3)} (${profitPct.toFixed(2)}%)\n`;
    result += `  USD: ${currentValueBotUSD.toFixed(3)} (${profitPct.toFixed(2)}%)\n`;

    return result;
  };

  // Format profit (like Telegram)
  const formatProfit = (profit: unknown, command?: string): string => {
    if (!profit || typeof profit !== 'object') {
      return 'No profit data available';
    }

    // Log profit structure for debugging

    try {
    // Extract timescale from command if present (e.g., "/profit_short 5" -> 5)
    let timescale: number | undefined = undefined;
    if (command) {
      const match = command.match(/\/(?:profit|profit_long|profit_short)\s+(\d+)/);
      if (match) {
        timescale = parseInt(match[1], 10);
      }
    }

    // Extract direction from command
    const direction = command?.includes('profit_long') ? 'long' : command?.includes('profit_short') ? 'short' : undefined;
    const directionLabel = direction ? ` ${direction}` : '';

    const prof = profit as {
      profit_closed_coin?: number;
      profit_closed_percent?: number;
      profit_closed_percent_mean?: number;
      profit_closed_ratio?: number;
      profit_closed_ratio_mean?: number;
      profit_closed_ratio_sum?: number;
      profit_closed_fiat?: number;
      profit_all_coin?: number;
      profit_all_percent?: number;
      profit_all_percent_mean?: number;
      profit_all_ratio?: number;
      profit_all_ratio_mean?: number;
      profit_all_ratio_sum?: number;
      profit_all_fiat?: number;
      trade_count?: number;
      closed_trade_count?: number;
      first_trade_timestamp?: number | string;
      first_trade_date?: string;
      first_trade_humanized?: string;
      latest_trade_timestamp?: number | string;
      latest_trade_date?: string;
      latest_trade_humanized?: string;
      bot_start_timestamp?: number | string;
      bot_start_date?: string;
      winning_trades?: number;
      losing_trades?: number;
      win_count?: number;
      loss_count?: number;
      winrate?: number;
      expectancy?: number;
      expectancy_ratio?: number;
      avg_duration?: string;
      avg_duration_seconds?: number;
      best_pair?: string;
      best_rate?: number;
      best_profit?: number;
      best_profit_abs?: number;
      best_pair_profit_abs?: number;
      trading_volume?: number;
      profit_factor?: number | null;
      max_drawdown?: number;
      max_drawdown_abs?: number;
      max_drawdown_start?: string;
      max_drawdown_start_timestamp?: number | string;
      max_drawdown_end?: string;
      max_drawdown_end_timestamp?: number | string;
      current_drawdown?: number;
      current_drawdown_abs?: number;
      current_drawdown_start?: string;
      current_drawdown_start_timestamp?: number | string;
      [key: string]: unknown;
    };

    let result = '';

    // Check if there are no trades
    if (prof.trade_count === 0) {
      return `No${directionLabel} trades yet.\nBot started: ${prof.bot_start_date || 'Unknown'}`;
    }

    // ROI: Closed trades
    // Check if there are closed trades
    if (prof.closed_trade_count !== undefined && prof.closed_trade_count > 0) {
      const closedCoin = Number(prof.profit_closed_coin ?? 0) || 0;
      // profit_closed_ratio_mean is a ratio (0.02039 = 2.039%), format_pct converts it to percentage
      const closedRatioMean = Number(prof.profit_closed_ratio_mean ?? 0) || 0;
      const closedPctMean = closedRatioMean * 100; // Convert ratio to percentage
      // profit_closed_percent is already a percentage (sum)
      const closedPctSum = Number(prof.profit_closed_percent ?? prof.profit_closed_percent_sum ?? 0) || 0;
      const closedFiat = Number(prof.profit_closed_fiat ?? closedCoin) || 0;
      result += `ROI: Closed${directionLabel} trades\n`;
      result += `  ${closedCoin.toFixed(3)} USDT (${closedPctMean.toFixed(2)}%) (${closedPctSum.toFixed(2)} Σ%)\n`;
      if (closedFiat !== 0) {
        result += `  ${closedFiat.toFixed(3)} USD\n`;
      }
      result += '\n';
    } else {
      result += `No closed${directionLabel} trade\n`;
    }

    // ROI: All trades (always show)
    const allCoin = Number(prof.profit_all_coin ?? 0) || 0;
    // profit_all_ratio_mean is a ratio, format_pct converts it to percentage
    const allRatioMean = Number(prof.profit_all_ratio_mean ?? 0) || 0;
    const allPctMean = allRatioMean * 100; // Convert ratio to percentage
    // profit_all_percent is already a percentage (sum)
    const allPctSum = Number(prof.profit_all_percent ?? prof.profit_all_percent_sum ?? 0) || 0;
    const allFiat = Number(prof.profit_all_fiat ?? allCoin) || 0;
    result += `ROI: All${directionLabel} trades\n`;
    result += `  ${allCoin.toFixed(3)} USDT (${allPctMean.toFixed(2)}%) (${allPctSum.toFixed(2)} Σ%)\n`;
    if (allFiat !== 0) {
      result += `  ${allFiat.toFixed(3)} USD\n`;
    }
    result += '\n';

    // Total Trade Count
    if (prof.trade_count !== undefined) {
      result += `Total Trade Count: ${prof.trade_count}\n`;
    }

    // Bot started
    const botStartDate = prof.bot_start_date;
    if (botStartDate) {
      result += `Bot started: ${botStartDate}\n`;
    }

    // First Trade opened / Showing Profit since
    const firstTradeDate = prof.first_trade_date;
    const firstTradeHumanized = prof.first_trade_humanized;
    if (firstTradeDate) {
      const label = timescale ? 'Showing Profit since' : 'First Trade opened';
      if (firstTradeHumanized) {
        result += ` ${label}: ${firstTradeHumanized} (${firstTradeDate})\n`;
      } else {
        result += ` ${label}: ${firstTradeDate}\n`;
      }
    }

    // Latest Trade opened
    const latestTradeDate = prof.latest_trade_date;
    const latestTradeHumanized = prof.latest_trade_humanized;
    if (latestTradeDate) {
      if (latestTradeHumanized) {
        result += `Latest Trade opened: ${latestTradeHumanized} (${latestTradeDate})\n`;
      } else {
        result += `Latest Trade opened: ${latestTradeDate}\n`;
      }
    }

    // Win / Loss
    const wins = prof.winning_trades ?? prof.win_count ?? 0;
    const losses = prof.losing_trades ?? prof.loss_count ?? 0;
    result += `Win / Loss: ${wins} / ${losses}\n`;

    // Winrate
    if (prof.winrate !== undefined && prof.winrate !== null) {
      // winrate is already a ratio (0.0 to 1.0), multiply by 100 for percentage
      const winratePct = Number(prof.winrate) * 100;
      result += `Winrate: ${winratePct.toFixed(2)}%\n`;
    }

    // Expectancy (Ratio)
    if ((prof.expectancy !== undefined && prof.expectancy !== null) || (prof.expectancy_ratio !== undefined && prof.expectancy_ratio !== null)) {
      const expectancy = Number(prof.expectancy ?? 0) || 0;
      // expectancy_ratio is already a number (e.g., 100 = 100)
      const ratio = Number(prof.expectancy_ratio ?? 0) || 0;
      result += `Expectancy (Ratio): ${expectancy.toFixed(2)} (${ratio.toFixed(2)})\n`;
    }

    // Avg. Duration (only show if there are closed trades)
    if (prof.closed_trade_count !== undefined && prof.closed_trade_count > 0) {
      if (prof.avg_duration) {
        result += `Avg. Duration: ${prof.avg_duration}\n`;
      } else if (prof.avg_duration_seconds !== undefined && prof.avg_duration_seconds !== null) {
        // Convert seconds to HH:MM:SS format
        const totalSeconds = Math.floor(prof.avg_duration_seconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        result += `Avg. Duration: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}\n`;
      }

      // Best Performing
      if (prof.best_pair) {
        const bestProfit = Number(prof.best_pair_profit_abs ?? prof.best_profit_abs ?? 0) || 0;
        // best_pair_profit_ratio is a ratio, need to multiply by 100
        const bestRatio = Number(prof.best_pair_profit_ratio ?? 0) || 0;
        const bestRate = bestRatio * 100;
        if (bestProfit !== 0 || bestRate !== 0) {
          result += `Best Performing: ${prof.best_pair}: ${bestProfit.toFixed(3)} USDT (${bestRate.toFixed(2)}%)\n`;
        }
      }

      // Trading volume
      if (prof.trading_volume !== undefined && prof.trading_volume !== null) {
        const volume = Number(prof.trading_volume) || 0;
        result += `Trading volume: ${volume.toFixed(3)} USDT\n`;
      }

      // Profit factor
      if (prof.profit_factor !== undefined && prof.profit_factor !== null) {
        const pf = Number(prof.profit_factor) || 0;
        result += `Profit factor: ${isFinite(pf) && pf > 0 ? pf.toFixed(2) : 'inf'}\n`;
      }

      // Max Drawdown
      if (prof.max_drawdown !== undefined && prof.max_drawdown !== null) {
        const maxDD = Number(prof.max_drawdown) || 0;
        const maxDDAbs = Number(prof.max_drawdown_abs ?? 0) || 0;
        result += `Max Drawdown: ${(maxDD * 100).toFixed(2)}% (${maxDDAbs.toFixed(3)} USDT)\n`;
        const maxDDStart = prof.max_drawdown_start ?? prof.max_drawdown_start_timestamp;
        const maxDDEnd = prof.max_drawdown_end ?? prof.max_drawdown_end_timestamp;
        if (maxDDStart && maxDDEnd) {
          result += `    from ${maxDDStart} (${maxDDAbs.toFixed(3)} USDT)\n`;
          result += `    to ${maxDDEnd} (${maxDDAbs.toFixed(3)} USDT)\n`;
        }
      }

      // Current Drawdown
      if (prof.current_drawdown !== undefined && prof.current_drawdown !== null) {
        const currDD = Number(prof.current_drawdown) || 0;
        const currDDAbs = Number(prof.current_drawdown_abs ?? 0) || 0;
        result += `Current Drawdown: ${(currDD * 100).toFixed(2)}% (${currDDAbs.toFixed(3)} USDT)\n`;
        const currDDStart = prof.current_drawdown_start ?? prof.current_drawdown_start_timestamp;
        if (currDDStart) {
          result += `    from ${currDDStart} (${currDDAbs.toFixed(3)} USDT)\n`;
        }
      }
    }

      return result || 'No profit data available';
    } catch (error) {
      appLogger.error('Error formatting profit:', error);
      return `Error formatting profit data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(profit, null, 2)}`;
    }
  };

  // Format trades (like Telegram)
  const formatTrades = (tradesData: unknown): string => {
    if (!tradesData || typeof tradesData !== 'object') {
      return 'No trades data available';
    }

    try {
      const data = tradesData as {
        trades?: Array<{
          trade_id?: number;
          pair?: string;
          close_timestamp?: number;
          close_date?: string;
          close_profit?: number;
          close_profit_pct?: number;
          close_profit_abs?: number;
          is_short?: boolean;
          [key: string]: unknown;
        }>;
        trades_count?: number;
        [key: string]: unknown;
      };

      if (!data.trades || data.trades.length === 0) {
        return 'No trades found.';
      }

      // Helper function to format relative time (e.g., "3 days ago")
      const formatRelativeTime = (timestamp: number | undefined, dateStr: string | undefined): string => {
        if (!timestamp && !dateStr) return 'Unknown';
        
        try {
          const date = timestamp 
            ? new Date(timestamp) 
            : new Date(dateStr!);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          
          if (diffDays > 0) {
            return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
          } else if (diffHours > 0) {
            return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
          } else if (diffMins > 0) {
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
          } else {
            return 'just now';
          }
        } catch {
          return 'Unknown';
        }
      };

      const trades = data.trades;
      const count = Math.min(trades.length, data.trades_count ?? trades.length);

      // Calculate column widths
      const col1Width = 15; // Close Date
      const col2Width = 20; // Pair (ID)
      const col3Width = 25; // Profit (USDT)

      // Format header
      let table = `Close Date${' '.repeat(col1Width - 8)}Pair (ID)${' '.repeat(col2Width - 7)}Profit (USDT)\n`;
      table += `${'-'.repeat(col1Width)}  ${'-'.repeat(col2Width)}  ${'-'.repeat(col3Width)}\n`;

      // Format rows
      trades.forEach((trade) => {
        const closeDate = formatRelativeTime(trade.close_timestamp, trade.close_date);
        const pair = trade.pair || 'Unknown';
        const tradeId = trade.trade_id ?? '?';
        const pairStr = `${pair} (#${tradeId})`;
        
        // close_profit is a ratio (0.020316412444025485), format_pct converts it to percentage (2.03%)
        // close_profit_pct is already a percentage (2.03)
        const profitRatio = Number(trade.close_profit ?? 0) || 0;
        // format_pct multiplies by 100 and formats with 2 decimals: f"{value:.2%}"
        const profitPct = trade.close_profit_pct ?? (profitRatio * 100);
        const profitAbs = Number(trade.close_profit_abs ?? 0) || 0;
        // Format profit: percentage with 2 decimals, absolute value with all decimals (up to 8)
        const profitPctStr = profitPct.toFixed(2);
        // Show absolute value with up to 8 decimals, but keep trailing zeros if they exist
        const profitAbsStr = profitAbs.toFixed(8);
        const profitStr = `${profitPctStr}% (${profitAbsStr})`;

        const closeDateCol = closeDate.padEnd(col1Width);
        const pairCol = pairStr.padEnd(col2Width);
        const profitCol = profitStr;

        table += `${closeDateCol}  ${pairCol}  ${profitCol}\n`;
      });

      return `${count} recent trades:\n${table}`;
    } catch (error) {
      appLogger.error('Error formatting trades:', error);
      return `Error formatting trades data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(tradesData, null, 2)}`;
    }
  };

  // Format mix_tags (like Telegram)
  const formatMixTags = (mixTags: unknown[]): string => {
    if (!Array.isArray(mixTags) || mixTags.length === 0) {
      return 'No mix tag data available';
    }

    try {
      let result = 'Mix Tag Performance:\n';
      
      mixTags.forEach((tag, index) => {
        const tagData = tag as {
          mix_tag?: string;
          profit_abs?: number;
          profit_ratio?: number;
          profit_pct?: number;
          count?: number;
          [key: string]: unknown;
        };

        const mixTag = (tagData.mix_tag || '').trim();
        const profitAbs = Number(tagData.profit_abs ?? 0) || 0;
        // profit_ratio is a ratio (0.04078 = 4.078%), format_pct converts it to percentage (4.08%)
        // Telegram uses format_pct(trade['profit_ratio']) which multiplies by 100 and formats with 2 decimals
        const profitRatio = Number(tagData.profit_ratio ?? 0) || 0;
        const profitPct = profitRatio * 100; // Convert ratio to percentage
        const count = tagData.count ?? 0;

        // Format: "1. {mix_tag} {profit_abs} USDT ({profit_pct}%) ({count})"
        // Telegram uses fmt_coin which formats with decimals_per_coin
        // For USDT, decimals_per_coin returns 3, so we format with 3 decimals and remove trailing zeros
        const profitAbsStr = profitAbs.toFixed(3).replace(/\.?0+$/, '');
        result += `${index + 1}. ${mixTag} ${profitAbsStr} USDT (${profitPct.toFixed(2)}%) (${count})\n`;
      });

      return result;
    } catch (error) {
      appLogger.error('Error formatting mix_tags:', error);
      return `Error formatting mix_tags data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(mixTags, null, 2)}`;
    }
  };

  // Format exits (like Telegram)
  const formatExits = (exits: unknown[]): string => {
    if (!Array.isArray(exits) || exits.length === 0) {
      return 'No exit reason data available';
    }

    try {
      let result = 'Exit Reason Performance:\n';
      
      exits.forEach((exit, index) => {
        const exitData = exit as {
          exit_reason?: string;
          profit_abs?: number;
          profit_ratio?: number;
          profit_pct?: number;
          count?: number;
          [key: string]: unknown;
        };

        const exitReason = (exitData.exit_reason || '').trim();
        const profitAbs = Number(exitData.profit_abs ?? 0) || 0;
        // profit_ratio is a ratio (0.02040 = 2.040%), format_pct converts it to percentage (2.04%)
        // Telegram uses format_pct(trade['profit_ratio']) which multiplies by 100 and formats with 2 decimals
        const profitRatio = Number(exitData.profit_ratio ?? 0) || 0;
        const profitPct = profitRatio * 100; // Convert ratio to percentage
        const count = exitData.count ?? 0;

        // Format: "1. {exit_reason} {profit_abs} USDT ({profit_pct}%) ({count})"
        // Telegram uses fmt_coin which formats with decimals_per_coin
        // For USDT, decimals_per_coin returns 3, so we format with 3 decimals and remove trailing zeros
        const profitAbsStr = profitAbs.toFixed(3).replace(/\.?0+$/, '');
        result += `${index + 1}. ${exitReason} ${profitAbsStr} USDT (${profitPct.toFixed(2)}%) (${count})\n`;
      });

      return result;
    } catch (error) {
      appLogger.error('Error formatting exits:', error);
      return `Error formatting exits data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(exits, null, 2)}`;
    }
  };

  // Format health (like Telegram)
  const formatHealth = (health: unknown): string => {
    if (!health || typeof health !== 'object') {
      return 'No health data available';
    }

    try {
      const healthData = health as {
        last_process?: string;
        last_process_ts?: number;
        bot_start?: string;
        bot_start_ts?: number;
        bot_startup?: string;
        bot_startup_ts?: number;
        [key: string]: unknown;
      };

      // Helper function to format ISO date to local format (YYYY-MM-DD HH:MM:SS)
      const formatDate = (dateStr: string | undefined, timestamp: number | undefined): string => {
        if (!dateStr && !timestamp) return 'Unknown';
        
        try {
          const date = dateStr 
            ? new Date(dateStr) 
            : timestamp 
              ? new Date(timestamp * 1000) 
              : null;
          
          if (!date || isNaN(date.getTime())) return 'Unknown';
          
          // Format as YYYY-MM-DD HH:MM:SS
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          
          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch {
          return 'Unknown';
        }
      };

      const lastProcess = formatDate(healthData.last_process, healthData.last_process_ts);
      const botStart = formatDate(healthData.bot_start, healthData.bot_start_ts);
      const botStartup = formatDate(healthData.bot_startup, healthData.bot_startup_ts);

      let result = `Last process: ${lastProcess}\n`;
      result += `Initial bot start: ${botStart}\n`;
      result += `Last bot restart: ${botStartup}`;

      return result;
    } catch (error) {
      appLogger.error('Error formatting health:', error);
      return `Error formatting health data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(health, null, 2)}`;
    }
  };

  // Format logs (like Telegram)
  const formatLogs = (logsData: unknown): string => {
    if (!logsData || typeof logsData !== 'object') {
      return 'No logs data available';
    }

    try {
      const data = logsData as {
        logs?: Array<[string, number, string, string, string]>;
        log_count?: number;
        [key: string]: unknown;
      };

      if (!data.logs || !Array.isArray(data.logs) || data.logs.length === 0) {
        return 'No logs available.';
      }

      // Format each log entry
      // Format: "{date} {module}: {level} - {message}"
      // Example: "2026-01-17 16:55:18 freqtrade.persistence.trade_model: INFO - Updating trade (id=5) ..."
      const formattedLogs = data.logs.map((log) => {
        // log is an array: [date, timestamp, module, level, message]
        const [date, , module, level, message] = log;
        return `${date} ${module}: ${level} - ${message}`;
      });

      return formattedLogs.join('\n');
    } catch (error) {
      appLogger.error('Error formatting logs:', error);
      return `Error formatting logs data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(logsData, null, 2)}`;
    }
  };

  // Format whitelist (like Telegram)
  const formatWhitelist = (whitelistData: unknown): string => {
    if (!whitelistData || typeof whitelistData !== 'object') {
      return 'No whitelist data available';
    }

    try {
      const data = whitelistData as {
        whitelist?: string[];
        method?: string[];
        length?: number;
        [key: string]: unknown;
      };

      const method = data.method || [];
      const length = data.length ?? 0;
      const pairs = data.whitelist || [];

      // Build message (like Freqtrade telegram.py line 1838-1839, but without backticks for web UI)
      let message = `Using whitelist ${JSON.stringify(method)} with ${length} pairs\n`;
      if (pairs.length > 0) {
        message += pairs.join(', ');
      }

      return message;
    } catch (error) {
      appLogger.error('Error formatting whitelist:', error);
      return `Error formatting whitelist data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(whitelistData, null, 2)}`;
    }
  };

  // Format blacklist (like Telegram)
  const formatBlacklist = (blacklistData: unknown): string => {
    if (!blacklistData || typeof blacklistData !== 'object') {
      return 'No blacklist data available';
    }

    try {
      const data = blacklistData as {
        blacklist?: string[];
        errors?: Record<string, { error_msg?: string }>;
        length?: number;
        [key: string]: unknown;
      };

      // Handle errors first (like Freqtrade does)
      const errmsgs: string[] = [];
      if (data.errors && typeof data.errors === 'object') {
        for (const error of Object.values(data.errors)) {
          if (error && typeof error === 'object' && 'error_msg' in error) {
            errmsgs.push(`Error: ${error.error_msg}`);
          }
        }
      }

      const length = data.length ?? 0;
      const pairs = data.blacklist || [];

      // Build message (like Freqtrade telegram.py line 1859-1860, but without backticks for web UI)
      let message = `Blacklist contains ${length} pairs\n`;
      if (pairs.length > 0) {
        message += pairs.join(', ');
      }

      // Prepend errors if any
      if (errmsgs.length > 0) {
        return `${errmsgs.join('\n')}\n${message}`;
      }

      return message;
    } catch (error) {
      appLogger.error('Error formatting blacklist:', error);
      return `Error formatting blacklist data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(blacklistData, null, 2)}`;
    }
  };

  // Format locks (like Telegram)
  const formatLocks = (locksData: unknown): string => {
    if (!locksData || typeof locksData !== 'object') {
      return 'No locks data available';
    }

    try {
      const data = locksData as {
        locks?: Array<{
          id?: number;
          pair?: string;
          lock_end_time?: string;
          reason?: string;
          [key: string]: unknown;
        }>;
        lock_count?: number;
        [key: string]: unknown;
      };

      if (!data.locks || !Array.isArray(data.locks) || data.locks.length === 0) {
        return 'No active locks.';
      }

      // Calculate column widths
      const col1Width = 5;  // ID
      const col2Width = 20; // Pair
      const col3Width = 20; // Until
      const col4Width = 20; // Reason

      // Format header
      const idHeader = 'ID'.padEnd(col1Width);
      const pairHeader = 'Pair'.padEnd(col2Width);
      const untilHeader = 'Until'.padEnd(col3Width);
      const reasonHeader = 'Reason'.padEnd(col4Width);
      
      let table = `${idHeader}  ${pairHeader}  ${untilHeader}  ${reasonHeader}\n`;
      table += `${'-'.repeat(col1Width)}  ${'-'.repeat(col2Width)}  ${'-'.repeat(col3Width)}  ${'-'.repeat(col4Width)}\n`;

      // Format rows
      data.locks.forEach((lock) => {
        const id = (lock.id ?? '?').toString();
        const pair = lock.pair || 'Unknown';
        const until = lock.lock_end_time || 'Unknown';
        const reason = lock.reason || '';

        const idCol = id.padEnd(col1Width);
        const pairCol = pair.padEnd(col2Width);
        const untilCol = until.padEnd(col3Width);
        const reasonCol = reason.padEnd(col4Width);

        table += `${idCol}  ${pairCol}  ${untilCol}  ${reasonCol}\n`;
      });

      return table;
    } catch (error) {
      appLogger.error('Error formatting locks:', error);
      return `Error formatting locks data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(locksData, null, 2)}`;
    }
  };

  // Format show_config (like Telegram)
  const formatShowConfig = (config: unknown): string => {
    if (!config || typeof config !== 'object') {
      return 'No config data available';
    }

    try {
      const val = config as {
        dry_run?: boolean;
        exchange?: string;
        trading_mode?: string;
        stake_amount?: string | number;
        stake_currency?: string;
        max_open_trades?: number;
        minimal_roi?: Record<string, number> | string;
        stoploss?: number;
        trailing_stop?: boolean;
        trailing_stop_positive?: number | null;
        trailing_stop_positive_offset?: number;
        trailing_only_offset_is_reached?: boolean;
        position_adjustment_enable?: boolean;
        max_entry_position_adjustment?: number;
        timeframe?: string;
        strategy?: string;
        state?: string;
        entry_pricing?: Record<string, unknown>;
        exit_pricing?: Record<string, unknown>;
        [key: string]: unknown;
      };

      let result = '';

      // Mode
      const mode = val.dry_run ? 'Dry-run' : 'Live';
      result += `Mode: ${mode}\n`;

      // Exchange
      if (val.exchange) {
        result += `Exchange: ${val.exchange}\n`;
      }

      // Market
      if (val.trading_mode) {
        result += `Market: ${val.trading_mode}\n`;
      }

      // Stake per trade
      if (val.stake_amount !== undefined && val.stake_currency) {
        result += `Stake per trade: ${val.stake_amount} ${val.stake_currency}\n`;
      }

      // Max open Trades
      if (val.max_open_trades !== undefined) {
        result += `Max open Trades: ${val.max_open_trades}\n`;
      }

      // Minimum ROI
      if (val.minimal_roi) {
        const roiStr = typeof val.minimal_roi === 'string' 
          ? val.minimal_roi 
          : JSON.stringify(val.minimal_roi);
        result += `Minimum ROI: ${roiStr}\n`;
      }

      // Entry strategy
      if (val.entry_pricing) {
        result += `Entry strategy: ${JSON.stringify(val.entry_pricing, null, 2)}\n`;
      }

      // Exit strategy
      if (val.exit_pricing) {
        result += `Exit strategy: ${JSON.stringify(val.exit_pricing, null, 2)}\n`;
      }

      // Stoploss
      if (val.trailing_stop) {
        result += `Initial Stoploss: ${val.stoploss}\n`;
        if (val.trailing_stop_positive !== null && val.trailing_stop_positive !== undefined) {
          result += `Trailing stop positive: ${val.trailing_stop_positive}\n`;
        }
        result += `Trailing stop offset: ${val.trailing_stop_positive_offset ?? 0}\n`;
        result += `Only trail above offset: ${val.trailing_only_offset_is_reached ?? false}\n`;
      } else {
        if (val.stoploss !== undefined) {
          result += `Stoploss: ${val.stoploss}\n`;
        }
      }

      // Position adjustment
      if (val.position_adjustment_enable) {
        result += `Position adjustment: On\n`;
        if (val.max_entry_position_adjustment !== undefined && val.max_entry_position_adjustment >= 0) {
          result += `Max enter position adjustment: ${val.max_entry_position_adjustment}\n`;
        }
      } else {
        result += `Position adjustment: Off\n`;
      }

      // Timeframe
      if (val.timeframe) {
        result += `Timeframe: ${val.timeframe}\n`;
      }

      // Strategy
      if (val.strategy) {
        result += `Strategy: ${val.strategy}\n`;
      }

      // Current state
      if (val.state) {
        result += `Current state: ${val.state}`;
      }

      return result;
    } catch (error) {
      appLogger.error('Error formatting show_config:', error);
      return `Error formatting config data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(config, null, 2)}`;
    }
  };

  // Format entries (like Telegram)
  const formatEntries = (entries: unknown[]): string => {
    if (!Array.isArray(entries) || entries.length === 0) {
      return 'No entry tag data available';
    }

    try {
      let result = 'Entry Tag Performance:\n';
      
      entries.forEach((entry, index) => {
        const entryData = entry as {
          enter_tag?: string;
          profit_abs?: number;
          profit_ratio?: number;
          profit_pct?: number;
          count?: number;
          [key: string]: unknown;
        };

        // enter_tag can be an empty string, if empty just show the profit without the tag
        const enterTag = (entryData.enter_tag || '').trim();
        const profitAbs = Number(entryData.profit_abs ?? 0) || 0;
        // profit_ratio is a ratio (0.02040 = 2.040%), format_pct converts it to percentage (2.04%)
        // Telegram uses format_pct(trade['profit_ratio']) which multiplies by 100 and formats with 2 decimals
        const profitRatio = Number(entryData.profit_ratio ?? 0) || 0;
        const profitPct = profitRatio * 100; // Convert ratio to percentage
        const count = entryData.count ?? 0;

        // Format: "1. {enter_tag} {profit_abs} USDT ({profit_pct}%) ({count})"
        // If enter_tag is empty, Telegram just shows the profit without the tag
        // Telegram uses fmt_coin which formats with decimals_per_coin
        // For USDT, decimals_per_coin returns 3, so we format with 3 decimals and remove trailing zeros
        const profitAbsStr = profitAbs.toFixed(3).replace(/\.?0+$/, '');
        const tagPart = enterTag ? `${enterTag} ` : '';
        result += `${index + 1}. ${tagPart}${profitAbsStr} USDT (${profitPct.toFixed(2)}%) (${count})\n`;
      });

      return result;
    } catch (error) {
      appLogger.error('Error formatting entries:', error);
      return `Error formatting entries data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(entries, null, 2)}`;
    }
  };

  // Format count (like Telegram)
  const formatCount = (count: unknown): string => {
    if (!count || typeof count !== 'object') {
      return 'No count data available';
    }

    try {
      const cnt = count as {
        current?: number;
        max?: number;
        total_stake?: number;
        [key: string]: unknown;
      };

      const current = Number(cnt.current ?? 0);
      const max = Number(cnt.max ?? 0);
      const totalStake = Number(cnt.total_stake ?? 0);

      // Format as table (like Telegram) with proper spacing
      const currentStr = current.toString();
      const maxStr = max.toString();
      const totalStakeStr = totalStake.toFixed(4);
      
      // Fixed column widths for consistent alignment
      const col1Width = 12; // "current" = 7 chars, add padding
      const col2Width = 8;  // "max" = 3 chars, add padding
      const col3Width = 15; // "total stake" = 11 chars, add padding
      
      // Format header with proper spacing between columns
      const header = `current${' '.repeat(col1Width - 7)}max${' '.repeat(col2Width - 3)}total stake\n`;
      // Format separator line with dashes
      const separator = `${'-'.repeat(col1Width)}${'-'.repeat(col2Width)}${'-'.repeat(col3Width)}\n`;
      // Format values with proper alignment
      const values = `${currentStr.padEnd(col1Width)}${maxStr.padEnd(col2Width)}${totalStakeStr.padEnd(col3Width)}`;

      return `${header}${separator}${values}`;
    } catch (error) {
      appLogger.error('Error formatting count:', error);
      return `Error formatting count data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(count, null, 2)}`;
    }
  };

  // Format daily profit (like Telegram)
  const formatDaily = (daily: unknown): string => {
    if (!daily || typeof daily !== 'object') {
      return 'No daily data available';
    }

    try {
      const dailyData = daily as {
        data?: Array<{
          date?: string;
          abs_profit?: number;
          rel_profit?: number;
          fiat_value?: number;
          trade_count?: number;
          [key: string]: unknown;
        }>;
        fiat_display_currency?: string;
        stake_currency?: string;
        [key: string]: unknown;
      };

      if (!dailyData.data || !Array.isArray(dailyData.data) || dailyData.data.length === 0) {
        return 'No daily data available';
      }

      const stakeCurrency = dailyData.stake_currency || 'USDT';
      const fiatCurrency = dailyData.fiat_display_currency || 'USD';

      let result = `Daily Profit over the last ${dailyData.data.length} days:\n\n`;

      // Calculate column widths
      const col1Width = 20; // Day (count)
      const col2Width = 12; // USDT
      const col3Width = 12; // USD
      const col4Width = 10; // Profit %

      // Table headers
      const header = `Day (count)${' '.repeat(col1Width - 11)}${stakeCurrency}${' '.repeat(col2Width - stakeCurrency.length)}${fiatCurrency}${' '.repeat(col3Width - fiatCurrency.length)}Profit %\n`;
      const separator = `${'-'.repeat(col1Width)}${'-'.repeat(col2Width)}${'-'.repeat(col3Width)}${'-'.repeat(col4Width)}\n`;
      result += header + separator;

      // Table rows
      for (const day of dailyData.data) {
        const date = day.date || 'Unknown';
        const tradeCount = day.trade_count ?? 0;
        const absProfit = Number(day.abs_profit ?? 0);
        const fiatValue = Number(day.fiat_value ?? 0);
        const relProfit = Number(day.rel_profit ?? 0) * 100; // Convert ratio to percentage

        const dayCol = `${date} (${tradeCount})`.padEnd(col1Width);
        const usdtCol = absProfit.toFixed(3).padEnd(col2Width);
        const usdCol = fiatValue.toFixed(2).padEnd(col3Width);
        const profitCol = relProfit.toFixed(2) + '%';

        result += `${dayCol}${usdtCol}${usdCol}${profitCol}\n`;
      }

      return result;
    } catch (error) {
      appLogger.error('Error formatting daily:', error);
      return `Error formatting daily data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(daily, null, 2)}`;
    }
  };

  // Format weekly profit (like Telegram)
  const formatWeekly = (weekly: unknown): string => {
    if (!weekly || typeof weekly !== 'object') {
      return 'No weekly data available';
    }

    try {
      const weeklyData = weekly as {
        data?: Array<{
          date?: string;
          abs_profit?: number;
          rel_profit?: number;
          fiat_value?: number;
          trade_count?: number;
          [key: string]: unknown;
        }>;
        fiat_display_currency?: string;
        stake_currency?: string;
        [key: string]: unknown;
      };

      if (!weeklyData.data || !Array.isArray(weeklyData.data) || weeklyData.data.length === 0) {
        return 'No weekly data available';
      }

      const stakeCurrency = weeklyData.stake_currency || 'USDT';
      const fiatCurrency = weeklyData.fiat_display_currency || 'USD';

      let result = `Weekly Profit over the last ${weeklyData.data.length} weeks (starting from Monday):\n\n`;

      // Table headers (like Telegram)
      result += `Monday (count)  ${stakeCurrency}  ${fiatCurrency}  Profit %\n`;
      result += `---------  ---------  ---------  ---------\n`;

      // Table rows
      for (const week of weeklyData.data) {
        const date = week.date || 'Unknown';
        const tradeCount = week.trade_count ?? 0;
        const absProfit = Number(week.abs_profit ?? 0);
        const fiatValue = Number(week.fiat_value ?? 0);
        const relProfit = Number(week.rel_profit ?? 0) * 100; // Convert ratio to percentage

        // Format like Telegram: "2026-01-12 (0)  0 USDT  0.00 USD  0.00%"
        const weekCol = `${date} (${tradeCount})`;
        const usdtCol = `${absProfit.toFixed(0)} ${stakeCurrency}`;
        const usdCol = `${fiatValue.toFixed(2)} ${fiatCurrency}`;
        const profitCol = `${relProfit.toFixed(2)}%`;

        result += `${weekCol}  ${usdtCol}  ${usdCol}  ${profitCol}\n`;
      }

      return result;
    } catch (error) {
      appLogger.error('Error formatting weekly:', error);
      return `Error formatting weekly data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(weekly, null, 2)}`;
    }
  };

  // Format monthly profit (like Telegram)
  const formatMonthly = (monthly: unknown): string => {
    if (!monthly || typeof monthly !== 'object') {
      return 'No monthly data available';
    }

    try {
      const monthlyData = monthly as {
        data?: Array<{
          date?: string;
          abs_profit?: number;
          rel_profit?: number;
          fiat_value?: number;
          trade_count?: number;
          [key: string]: unknown;
        }>;
        fiat_display_currency?: string;
        stake_currency?: string;
        [key: string]: unknown;
      };

      if (!monthlyData.data || !Array.isArray(monthlyData.data) || monthlyData.data.length === 0) {
        return 'No monthly data available';
      }

      const stakeCurrency = monthlyData.stake_currency || 'USDT';
      const fiatCurrency = monthlyData.fiat_display_currency || 'USD';

      let result = `Monthly Profit over the last ${monthlyData.data.length} months:\n\n`;

      // Calculate column widths
      const col1Width = 20; // Month (count)
      const col2Width = 12; // USDT
      const col3Width = 12; // USD
      const col4Width = 10; // Profit %

      // Table headers
      const header = `Month (count)${' '.repeat(col1Width - 12)}${stakeCurrency}${' '.repeat(col2Width - stakeCurrency.length)}${fiatCurrency}${' '.repeat(col3Width - fiatCurrency.length)}Profit %\n`;
      const separator = `${'-'.repeat(col1Width)}${'-'.repeat(col2Width)}${'-'.repeat(col3Width)}${'-'.repeat(col4Width)}\n`;
      result += header + separator;

      // Table rows
      for (const month of monthlyData.data) {
        const date = month.date || 'Unknown';
        const tradeCount = month.trade_count ?? 0;
        const absProfit = Number(month.abs_profit ?? 0);
        const fiatValue = Number(month.fiat_value ?? 0);
        const relProfit = Number(month.rel_profit ?? 0) * 100; // Convert ratio to percentage

        const monthCol = `${date} (${tradeCount})`.padEnd(col1Width);
        const usdtCol = absProfit.toFixed(3).padEnd(col2Width);
        const usdCol = fiatValue.toFixed(2).padEnd(col3Width);
        const profitCol = relProfit.toFixed(2) + '%';

        result += `${monthCol}${usdtCol}${usdCol}${profitCol}\n`;
      }

      return result;
    } catch (error) {
      appLogger.error('Error formatting monthly:', error);
      return `Error formatting monthly data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(monthly, null, 2)}`;
    }
  };

  // Format stats (like Telegram)
  const formatStats = (stats: unknown): string => {
    if (!stats || typeof stats !== 'object') {
      return 'No stats data available';
    }

    try {
      const statsData = stats as {
        exit_reasons?: Record<string, unknown>;
        durations?: {
          wins?: string | null;
          draws?: string | null;
          losses?: string | null;
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };

      let result = '';

      // Check if there are any trades
      const hasExitReasons = statsData.exit_reasons && Object.keys(statsData.exit_reasons).length > 0;
      const hasDurations = statsData.durations && (
        statsData.durations.wins !== null ||
        statsData.durations.draws !== null ||
        statsData.durations.losses !== null
      );

      if (!hasExitReasons && !hasDurations) {
        result += 'No trades yet.\n\n';
      }

      // Format durations table
      if (statsData.durations) {
        const col1Width = 7;  // "Wins" / "Losses" column
        const col2Width = 15; // Duration value column
        
        // Align "Avg. Duration" header to the second column
        result += `${' '.repeat(col1Width + 2)}Avg. Duration\n`;
        result += `${'-'.repeat(col1Width)}  ${'-'.repeat(col2Width)}\n`;
        
        const wins = statsData.durations.wins;
        const draws = statsData.durations.draws;
        const losses = statsData.durations.losses;

        if (wins !== null && wins !== undefined) {
          result += `Wins${' '.repeat(col1Width - 4)}  ${wins}\n`;
        } else {
          result += `Wins${' '.repeat(col1Width - 4)}  N/A\n`;
        }

        if (draws !== null && draws !== undefined) {
          result += `Draws${' '.repeat(col1Width - 5)}  ${draws}\n`;
        } else {
          result += `Draws${' '.repeat(col1Width - 5)}  N/A\n`;
        }

        if (losses !== null && losses !== undefined) {
          result += `Losses${' '.repeat(col1Width - 6)}  ${losses}\n`;
        } else {
          result += `Losses${' '.repeat(col1Width - 6)}  N/A\n`;
        }
      }

      // Format exit reasons if available
      if (hasExitReasons && statsData.exit_reasons) {
        result += '\n';
        result += 'Exit Reasons\n';
        result += '----------\n';
        
        for (const [reason, data] of Object.entries(statsData.exit_reasons)) {
          if (data && typeof data === 'object') {
            const reasonData = data as {
              trades?: number;
              profit_abs?: number;
              profit_ratio?: number;
              [key: string]: unknown;
            };
            const trades = reasonData.trades ?? 0;
            const profit = reasonData.profit_abs ?? 0;
            const profitPct = ((reasonData.profit_ratio ?? 0) * 100).toFixed(2);
            result += `${reason}: ${trades} trades, ${profit.toFixed(3)} USDT (${profitPct}%)\n`;
          }
        }
      }

      return result || 'No stats data available';
    } catch (error) {
      appLogger.error('Error formatting stats:', error);
      return `Error formatting stats data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(stats, null, 2)}`;
    }
  };

  // Format version (like Telegram)
  const formatVersion = (version: unknown): string => {
    if (!version || typeof version !== 'object') {
      return 'No version data available';
    }

    try {
      const versionData = version as {
        version?: string;
        [key: string]: unknown;
      };

      const versionStr = versionData.version || 'Unknown';
      return `Version: ${versionStr}`;
    } catch (error) {
      appLogger.error('Error formatting version:', error);
      return `Error formatting version data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(version, null, 2)}`;
    }
  };

  // Format performance (like Telegram)
  const formatPerformance = (performance: unknown[]): string => {
    if (!Array.isArray(performance) || performance.length === 0) {
      return 'No performance data available';
    }

    try {
      const perfList = performance as Array<{
        pair?: string;
        profit_abs?: number;
        profit_pct?: number;
        profit_ratio?: number;
        count?: number;
        profit?: number;
        [key: string]: unknown;
      }>;

      let result = 'Performance:\n';

      perfList.forEach((item, index) => {
        const pair = item.pair || 'Unknown';
        const profitAbs = Number(item.profit_abs ?? 0);
        // profit_pct seems to be already a percentage (e.g., 2.05 = 2.05%)
        const profitPct = Number(item.profit_pct ?? item.profit ?? (item.profit_ratio ?? 0) * 100) || 0;
        const count = item.count ?? 0;

        // Format: "1. LTC/USDT 0.327 USDT (2.05%) (1)"
        result += `${index + 1}. ${pair} ${profitAbs.toFixed(3)} USDT (${profitPct.toFixed(2)}%) (${count})\n`;
      });

      return result;
    } catch (error) {
      appLogger.error('Error formatting performance:', error);
      return `Error formatting performance data: ${error instanceof Error ? error.message : 'Unknown error'}\n\nRaw data:\n${JSON.stringify(performance, null, 2)}`;
    }
  };

  // Format status as detailed list (like Telegram)
  const formatStatusList = (trades: unknown[]): string => {
    if (!Array.isArray(trades) || trades.length === 0) {
      return 'No open trades';
    }

    const tradeList = trades as Array<{
      trade_id?: number;
      pair?: string;
      is_open?: boolean;
      amount?: number;
      stake_amount?: number;
      open_rate?: number;
      current_rate?: number;
      profit_abs?: number;
      profit_ratio?: number;
      profit_pct?: number;
      realized_profit?: number;
      open_date?: string;
      stoploss?: number;
      stoploss_abs?: number;
      stoploss_pct?: number;
      stoploss_current_dist?: number;
      stoploss_current_dist_pct?: number;
      leverage?: number;
      direction?: string;
    }>;
    
    return tradeList.map((trade) => {
      const id = trade.trade_id || '?';
      const opened = trade.open_date || 'Unknown';
      const pair = trade.pair || 'Unknown';
      const direction = trade.direction || 'Long';
      const leverage = trade.leverage ? `${trade.leverage}x` : '1.0x';
      const amount = trade.amount || 0;
      const stakeAmount = trade.stake_amount || 0;
      const openRate = trade.open_rate || 0;
      const currentRate = trade.current_rate || openRate;
      const unrealizedProfit = trade.profit_abs !== undefined ? trade.profit_abs : 0;
      const unrealizedProfitPct = trade.profit_pct !== undefined 
        ? trade.profit_pct 
        : (trade.profit_ratio !== undefined ? trade.profit_ratio * 100 : 0);
      const realizedProfit = trade.realized_profit || 0;
      const totalProfit = unrealizedProfit + realizedProfit;
      const totalProfitPct = unrealizedProfitPct + (realizedProfit !== 0 ? (realizedProfit / stakeAmount) * 100 : 0);
      const stoploss = trade.stoploss || 0;
      const stoplossDist = trade.stoploss_current_dist || 0;
      const stoplossDistPct = trade.stoploss_current_dist_pct || 0;

      let result = `Trade ID ${id}:\n`;
      result += `  Opened: ${opened}\n`;
      result += `  Current Pair: ${pair}\n`;
      result += `  Direction: ${direction} (${leverage} leverage)\n`;
      result += `  Amount: ${amount} (equivalent to ${stakeAmount.toFixed(2)} USDT)\n`;
      result += `  Open Rate: ${openRate}\n`;
      if (currentRate !== openRate) {
        result += `  Current Rate: ${currentRate}\n`;
      }
      result += `  Unrealized Profit: ${unrealizedProfitPct.toFixed(2)}% (${unrealizedProfit.toFixed(3)} USDT)\n`;
      if (realizedProfit !== 0) {
        result += `  Realized Profit: ${((realizedProfit / stakeAmount) * 100).toFixed(2)}% (${realizedProfit.toFixed(3)} USDT)\n`;
      }
      result += `  Total Profit: ${totalProfitPct.toFixed(2)}% (${totalProfit.toFixed(3)} USDT)\n`;
      if (stoploss !== 0) {
        result += `  Stoploss: ${stoploss.toFixed(2)} (${(trade.stoploss_pct || 0).toFixed(2)}%)\n`;
        if (stoplossDist !== 0) {
          result += `  Stoploss distance: ${stoplossDist.toFixed(2)} (${stoplossDistPct.toFixed(2)}%)\n`;
        }
      }
      
      return result;
    }).join('\n');
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      const readOnlyMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Read-only mode: auditors can view data but cannot execute commands.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, readOnlyMessage]);
      return;
    }
    if (!input.trim() || isLoading) return;

    const command = input.trim();
    // Keep the input text so user can easily resend the same command
    setIsLoading(true);

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: command,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await executeCommand(command);
      
      // For reload_config, handle it separately with multiple messages
      if (command === '/reload_config' || command === '/reload') {
        // Don't show the initial API response, we'll show our own sequence
        // Show initial status immediately (this replaces the API response)
        const baseTime = Date.now();
        const initialStatusMessage: Message = {
          id: (baseTime + 1).toString(),
          type: 'bot',
          content: 'Status: Reloading config ...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, initialStatusMessage]);

        // After a short delay, query the actual status
        setTimeout(async () => {
          try {
            const statusResponse = await proxyApi.get(botId, 'api/v1/show_config');
            if (statusResponse && typeof statusResponse === 'object' && 'state' in statusResponse) {
              const currentState = (statusResponse as { state?: string }).state;
              if (currentState) {
                const reloadStatusMessage: Message = {
                  id: `${baseTime + 2}`,
                  type: 'bot',
                  content: `Status: ${currentState}`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, reloadStatusMessage]);
              }
            }
          } catch (err) {
            appLogger.error('Failed to get status during reload:', err);
            // Fallback to static message if query fails
            const reloadStatusMessage: Message = {
              id: `${baseTime + 2}`,
              type: 'bot',
              content: 'Status: reload_config',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, reloadStatusMessage]);
          }
        }, 500);

        // After reload completes, show final status and config
        setTimeout(async () => {
          try {
            const configResponse = await proxyApi.get(botId, 'api/v1/show_config');
            if (configResponse && typeof configResponse === 'object' && 'state' in configResponse) {
              const finalState = (configResponse as { state?: string }).state;
              if (finalState) {
                // Show final status
                const finalStatusMessage: Message = {
                  id: `${baseTime + 3}`,
                  type: 'bot',
                  content: `Status: ${finalState} after config reloaded`,
                  timestamp: new Date(),
                };
                setMessages((prev) => [...prev, finalStatusMessage]);

                // Show updated config
                const configMessage: Message = {
                  id: `${baseTime + 4}`,
                  type: 'bot',
                  content: formatBotResponse(configResponse, '/show_config'),
                  timestamp: new Date(),
                  data: configResponse,
                  command: '/show_config',
                };
                setMessages((prev) => [...prev, configMessage]);
              }
            }
          } catch (err) {
            appLogger.error('Failed to get config after reload:', err);
          }
        }, 2000); // Wait 2 seconds for reload to complete
      } else {
        // For other commands, show the response normally
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: formatBotResponse(response, command),
          timestamp: new Date(),
          data: response,
          command: command, // Store the command for conditional rendering
        };
        setMessages((prev) => [...prev, botMessage]);

        // For stop/start/pause commands, check final state after a delay (like Telegram)
        if (['/stop', '/start', '/pause'].includes(command)) {
          setTimeout(async () => {
            try {
              const configResponse = await proxyApi.get(botId, 'api/v1/show_config');
              if (configResponse && typeof configResponse === 'object' && 'state' in configResponse) {
                const finalState = (configResponse as { state?: string }).state;
                if (finalState) {
                  // Map Freqtrade states to Telegram-like status messages
                  let statusMessage = '';
                  if (command === '/stop') {
                    statusMessage = finalState === 'stopped' ? 'stopped' : `stopping trader ...`;
                  } else if (command === '/start') {
                    statusMessage = finalState === 'running' ? 'started' : `starting trader ...`;
                  } else if (command === '/pause') {
                    statusMessage = finalState === 'paused' ? 'paused' : `pausing trader ...`;
                  }

                  if (statusMessage) {
                    const finalMessage: Message = {
                      id: (Date.now() + 2).toString(),
                      type: 'bot',
                      content: `Status: ${statusMessage}`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, finalMessage]);
                  }
                }
              }
            } catch (err) {
              // Silently fail - we already showed the initial response
              appLogger.error('Failed to get final state:', err);
            }
          }, 1500); // Wait 1.5 seconds before checking final state
        }
      }
    } catch (err) {
      // Extract more detailed error message if available
      let errorMsg = 'Unknown error';
      if (err instanceof Error) {
        errorMsg = err.message;
        // If it's an axios error, try to extract the Freqtrade error message
        if ('response' in err && err.response && typeof err.response === 'object') {
          const response = err.response as { 
            data?: { 
              message?: string; 
              detail?: string;
              error?: string;
            }; 
            status?: number;
          };
          // Try different possible error message fields from Freqtrade/FastAPI
          if (response.data?.detail) {
            errorMsg = response.data.detail;
          } else if (response.data?.message) {
            // Backend formats as "Freqtrade API error: {status} - {message}"
            // Try to extract just the Freqtrade message part
            const msg = response.data.message;
            if (msg.includes('Freqtrade API error:')) {
              // Extract the part after the status code
              const match = msg.match(/Freqtrade API error: \d+ - (.+)/);
              if (match && match[1]) {
                errorMsg = match[1];
              } else {
                errorMsg = msg;
              }
            } else {
              errorMsg = msg;
            }
          } else if (response.data?.error) {
            errorMsg = response.data.error;
          } else if (response.status === 502) {
            errorMsg = 'Bad Gateway: Unable to connect to Freqtrade bot. The bot may be offline or unreachable.';
          } else if (response.status === 500) {
            errorMsg = 'Internal server error. The trade may not have open orders.';
          } else if (response.status) {
            errorMsg = `Request failed with status code ${response.status}`;
          }
        }
        
        // Enhance error messages for cancel_open_order/coo commands with trade_id
        if ((command?.startsWith('/cancel_open_order') || command?.startsWith('/coo')) && 
            errorMsg.includes('trade_id') && !errorMsg.match(/\d+/)) {
          // Extract trade_id from command
          const tradeIdMatch = command.match(/(?:cancel_open_order|coo)\s+(\d+)/);
          if (tradeIdMatch && tradeIdMatch[1]) {
            errorMsg = errorMsg.replace(/trade_id/g, `trade_id ${tradeIdMatch[1]}`);
          }
        }
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `❌ Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Use requestAnimationFrame to ensure focus happens after React updates the DOM
      if (!isReadOnly) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        });
      }
    }
  };

  const handleCommandClick = async (command: string) => {
    if (isReadOnly) {
      const readOnlyMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Read-only mode: auditors can view data but cannot execute commands.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, readOnlyMessage]);
      return;
    }
    // Commands that should execute immediately (no parameters needed or with optional parameters)
    const immediateCommands = [
      '/profit',
      '/profit_long',
      '/profit_short',
      '/balance',
      '/status',
      '/status table',
      '/config',
      '/show_config',
      '/daily',
      '/weekly',
      '/monthly',
      '/performance',
      '/count',
      '/start',
      '/stop',
      '/pause',
      '/stopentry',
      '/reload_config',
      '/reload',
      '/help',
      '/version',
      '/stats',
      '/trades',
      '/logs',
      '/locks',
      '/health',
      '/whitelist',
      '/blacklist',
      '/entries',
      '/exits',
      '/mix_tags',
    ];

    // If it's an immediate command, execute it right away
    if (immediateCommands.includes(command)) {
      // Place command in input field so user can see it and resend easily
      setInput(command);
      setIsLoading(true);

      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: command,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const response = await executeCommand(command);
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: formatBotResponse(response, command),
          timestamp: new Date(),
          data: response,
          command: command, // Store the command for conditional rendering
        };
        setMessages((prev) => [...prev, botMessage]);

        // For stop/start/pause commands, check final state after a delay (like Telegram)
        if (['/stop', '/start', '/pause'].includes(command)) {
          setTimeout(async () => {
            try {
              const configResponse = await proxyApi.get(botId, 'api/v1/show_config');
              if (configResponse && typeof configResponse === 'object' && 'state' in configResponse) {
                const finalState = (configResponse as { state?: string }).state;
                if (finalState) {
                  // Map Freqtrade states to Telegram-like status messages
                  let statusMessage = '';
                  if (command === '/stop') {
                    statusMessage = finalState === 'stopped' ? 'stopped' : `stopping trader ...`;
                  } else if (command === '/start') {
                    statusMessage = finalState === 'running' ? 'started' : `starting trader ...`;
                  } else if (command === '/pause') {
                    statusMessage = finalState === 'paused' ? 'paused' : `pausing trader ...`;
                  }

                  if (statusMessage) {
                    const finalMessage: Message = {
                      id: (Date.now() + 2).toString(),
                      type: 'bot',
                      content: `Status: ${statusMessage}`,
                      timestamp: new Date(),
                    };
                    setMessages((prev) => [...prev, finalMessage]);
                  }
                }
              }
            } catch (err) {
              // Silently fail - we already showed the initial response
              appLogger.error('Failed to get final state:', err);
            }
          }, 1500); // Wait 1.5 seconds before checking final state
        }
      } catch (err) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
        // Use requestAnimationFrame to ensure focus happens after React updates the DOM
        requestAnimationFrame(() => {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        });
      }
    } else {
      // For other commands (with parameters), insert in input
      setInput(command);
      if (!isReadOnly) {
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-background border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-foreground">{botName}</div>
          <div className="text-xs text-muted-foreground">bot</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Send a command to interact with the bot</p>
            <p className="text-xs mt-2">Try: /profit, /balance, /status</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-gray-200" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.type === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-700 text-gray-100'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap break-words font-mono text-xs">
                  {message.type === 'bot' && message.command === '/help' ? (
                    <HelpMessageContent 
                      content={message.content} 
                      onCommandClick={isReadOnly ? () => undefined : handleCommandClick}
                    />
                  ) : (
                    message.content
                  )}
                </div>
                <div className={`text-xs mt-1 ${
                  message.type === 'user' ? 'text-blue-100' : 'text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Command Buttons */}
      <div className="px-4 py-2 border-t border-border bg-muted/30">
        {isReadOnly && (
          <div className="mb-2 text-xs text-muted-foreground">
            Read-only mode: auditors can view data but cannot execute commands.
          </div>
        )}
        <div className="grid grid-cols-4 gap-2 mb-2">
          {COMMON_COMMANDS.slice(0, 8).map((cmd) => (
            <div key={cmd.command}>
              <button
                onClick={() => handleCommandClick(cmd.command)}
                disabled={isReadOnly || isLoading}
                className="w-full px-2 py-1 text-xs bg-background hover:bg-gray-700 border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cmd.command}
              </button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {COMMON_COMMANDS.slice(8).map((cmd) => (
            <div key={cmd.command}>
              <button
                onClick={() => handleCommandClick(cmd.command)}
                disabled={isReadOnly || isLoading}
                className="w-full px-2 py-1 text-xs bg-background hover:bg-gray-700 border border-border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cmd.command}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="border-t border-border p-4 bg-muted/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isReadOnly ? 'Read-only mode (auditor)' : 'Write a message... (e.g., /profit, /balance)'}
            className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            disabled={isLoading || isReadOnly}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isReadOnly}
            onMouseDown={(e) => {
              // Prevent button from stealing focus
              e.preventDefault();
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
