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

import { Request, Response, NextFunction } from 'express';
import { checkBotOwnership } from '../services/botOwnershipService.js';

/**
 * Middleware to require specific role(s)
 * Must be used after authenticate middleware
 */
export function requireRole(...roles: ('superadmin' | 'auditor' | 'user')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'Forbidden: Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require superadmin role
 */
export function requireSuperadmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.user.role !== 'superadmin') {
    res.status(403).json({ error: 'Forbidden: Superadmin access required' });
    return;
  }

  next();
}

/**
 * Middleware to require bot ownership or superadmin role
 * Must be used after authenticate middleware
 * Expects botId in req.params.id
 */
export function requireBotOwnershipOrSuperadmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const botId = req.params.id;
  if (!botId) {
    res.status(400).json({ error: 'Bot ID is required' });
    return;
  }

  // Superadmin can do everything
  if (req.user.role === 'superadmin') {
    next();
    return;
  }

  // Check if user owns the bot
  const isOwner = checkBotOwnership(botId, req.user.id);
  if (!isOwner) {
    res.status(403).json({ error: 'Forbidden: You do not own this bot' });
    return;
  }

  next();
}

/**
 * Middleware to require bot view access (owner, superadmin, or auditor)
 * Must be used after authenticate middleware
 * Expects botId in req.params.id
 */
export function requireBotViewAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const botId = req.params.id;
  if (!botId) {
    res.status(400).json({ error: 'Bot ID is required' });
    return;
  }

  // Superadmin and auditor can view everything
  if (req.user.role === 'superadmin' || req.user.role === 'auditor') {
    next();
    return;
  }

  // Check if user owns the bot
  const isOwner = checkBotOwnership(botId, req.user.id);
  if (!isOwner) {
    res.status(403).json({ error: 'Forbidden: You do not have access to this bot' });
    return;
  }

  next();
}

/**
 * Middleware to filter bots based on user role and ownership
 * For list endpoints, filters results based on permissions
 */
export function filterBotsByAccess(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Superadmin and auditor can see all bots
  // Regular users will see only their bots (handled in route logic)
  next();
}

