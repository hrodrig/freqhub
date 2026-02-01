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

import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { getBotWithCredentials } from './botService.js';
import { proxyRequest } from './proxyService.js';
import { appLogger } from '../utils/logger.js';

export type BotRunmode = 'dry_run' | 'live';

interface RunmodeResult {
  runmode: BotRunmode;
  previousRunmode: BotRunmode | null;
  configPath: string;
}

function assertConfigPathAllowed(configPath: string): string {
  const baseDir = env.RUNMODE_CONFIG_BASE_DIR?.trim();
  if (!baseDir) {
    return path.resolve(configPath);
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedPath = path.isAbsolute(configPath)
    ? path.resolve(configPath)
    : path.resolve(path.join(resolvedBase, configPath));

  if (resolvedPath !== resolvedBase && !resolvedPath.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error('Config path is not allowed');
  }
  return resolvedPath;
}

function normalizeRunmode(dryRunValue: unknown): BotRunmode | null {
  if (typeof dryRunValue !== 'boolean') {
    return null;
  }
  return dryRunValue ? 'dry_run' : 'live';
}

export async function setBotRunmode(botId: string, targetRunmode: BotRunmode): Promise<RunmodeResult> {
  if (!env.RUNMODE_EDITOR_ENABLED) {
    throw new Error('Runmode editor is disabled');
  }

  const bot = getBotWithCredentials(botId);
  if (!bot) {
    throw new Error('Bot not found');
  }

  const configPath = bot.config_path?.trim();
  if (!configPath) {
    throw new Error('Bot config path is not set');
  }

  const resolvedPath = assertConfigPathAllowed(configPath);

  if (targetRunmode === 'live') {
    const configState = await proxyRequest(botId, 'GET', 'api/v1/show_config', undefined, true);
    const stateValue = (configState as { state?: string } | null)?.state;
    const normalizedState = typeof stateValue === 'string' ? stateValue.toUpperCase() : undefined;
    if (normalizedState !== 'STOPPED') {
      throw new Error('Bot must be stopped before switching to live');
    }
  }
  const rawConfig = await fs.readFile(resolvedPath, 'utf-8');

  let config: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawConfig);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Config JSON must be an object');
    }
    config = parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Failed to parse config.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const previousRunmode = normalizeRunmode(config.dry_run);
  config.dry_run = targetRunmode === 'dry_run';

  const serialized = JSON.stringify(config, null, 2);
  const tempPath = `${resolvedPath}.tmp`;
  await fs.writeFile(tempPath, serialized, 'utf-8');
  await fs.rename(tempPath, resolvedPath);

  appLogger.info(`Updated runmode for bot ${botId} to ${targetRunmode} via ${resolvedPath}`);

  await proxyRequest(botId, 'POST', 'api/v1/reload_config', undefined, true);

  return {
    runmode: targetRunmode,
    previousRunmode,
    configPath: resolvedPath,
  };
}
