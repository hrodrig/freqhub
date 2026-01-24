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

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { env } from '../config/env.js';
import { eventBusService, FreqHubEvent } from './eventBus.service.js';
import { appLogger } from '../utils/logger.js';
import { verifyToken } from './authService.js';
import { getUserByIdDB } from './userService.js';
import { getBotsOwnedByUser } from './botOwnershipService.js';

type SocketUser = {
  id: string;
  username: string;
  role: 'superadmin' | 'auditor' | 'user';
};

/**
 * WebSocket Service
 * Handles real-time communication with the frontend
 */
class WebSocketService {
  private io: SocketServer | null = null;

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.io = new SocketServer(server, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/socket.io',
    });

    // Auth middleware (JWT required)
    this.io.use((socket, next) => {
      try {
        const token =
          (socket.handshake.auth && (socket.handshake.auth as any).token) ||
          (typeof socket.handshake.headers.authorization === 'string' &&
            socket.handshake.headers.authorization.startsWith('Bearer ')
            ? socket.handshake.headers.authorization.substring(7)
            : null);

        if (!token) {
          return next(new Error('Unauthorized'));
        }

        const payload = verifyToken(token);
        if (!payload) {
          return next(new Error('Unauthorized'));
        }

        const user = getUserByIdDB(payload.userId);
        if (!user || user.is_active === 0) {
          return next(new Error('Unauthorized'));
        }

        (socket.data as any).user = {
          id: user.id,
          username: user.username,
          role: user.role,
        } satisfies SocketUser;

        return next();
      } catch (err) {
        appLogger.warn('WebSocket: auth middleware error', err);
        return next(new Error('Unauthorized'));
      }
    });

    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      const user = (socket.data as any).user as SocketUser | undefined;
      appLogger.info(
        `WebSocket: Client connected [${clientId}] user=${user?.username || 'unknown'} role=${user?.role || 'unknown'}`
      );

      // Clients can join rooms to receive specific updates
      socket.on('subscribe:bot', (botId: string) => {
        if (!botId) return;

        const socketUser = (socket.data as any).user as SocketUser | undefined;
        if (!socketUser) {
          socket.emit('subscription_error', { message: 'Unauthorized' });
          return;
        }

        // Authorization: user must have view access to the bot
        const canView =
          socketUser.role === 'superadmin' ||
          socketUser.role === 'auditor' ||
          getBotsOwnedByUser(socketUser.id).includes(botId);

        if (!canView) {
          socket.emit('subscription_error', { message: 'Forbidden' });
          return;
        }

        socket.join(`bot:${botId}`);
        appLogger.info(`WebSocket: Client [${clientId}] subscribed to bot [${botId}]`);
        
        // Confirm subscription
        socket.emit('subscribed', { room: `bot:${botId}` });
      });

      socket.on('unsubscribe:bot', (botId: string) => {
        if (!botId) return;
        socket.leave(`bot:${botId}`);
        appLogger.info(`WebSocket: Client [${clientId}] unsubscribed from bot [${botId}]`);
        
        // Confirm unsubscription
        socket.emit('unsubscribed', { room: `bot:${botId}` });
      });

      // Global system subscription
      socket.on('subscribe:system', () => {
        const socketUser = (socket.data as any).user as SocketUser | undefined;
        if (!socketUser) {
          socket.emit('subscription_error', { message: 'Unauthorized' });
          return;
        }
        socket.join('system');
        appLogger.info(`WebSocket: Client [${clientId}] subscribed to system events`);
        socket.emit('subscribed', { room: 'system' });
      });

      socket.on('disconnect', (reason) => {
        appLogger.info(`WebSocket: Client disconnected [${clientId}]. Reason: ${reason}`);
      });

      socket.on('error', (error) => {
        appLogger.error(`WebSocket: Socket error [${clientId}]:`, error);
      });
    });

    // Wire up EventBus to WebSockets
    this.setupEventForwarding();

    appLogger.info('WebSocket: Service initialized and listening for events');
  }

  /**
   * Forward events from EventBus to connected WebSocket clients
   */
  private setupEventForwarding(): void {
    eventBusService.on('event', (event: FreqHubEvent) => {
      if (!this.io) return;

      // 1. Always broadcast to a global "events" channel if needed
      // (Be careful with volume of events)
      
      // 2. If it's a bot event, send to the bot room
      if (event.botId) {
        appLogger.debug(`WebSocket: Forwarding ${event.type} event for bot ${event.botId} to room bot:${event.botId}`);
        this.io.to(`bot:${event.botId}`).emit('bot_event', event);
      }

      // 3. If it's a system event, send to system room
      if (event.type.startsWith('system_')) {
        this.io.to('system').emit('system_event', event);
      }
      
      // 4. Critical updates might go to everyone
      if (event.type === 'alert' || event.type === 'notification') {
        this.io.emit('broadcast_event', event);
      }
    });
  }

  /**
   * Manually emit an event to all clients (use sparingly)
   */
  broadcast(eventName: string, data: any): void {
    if (this.io) {
      this.io.emit(eventName, data);
    }
  }

  /**
   * Get number of connected clients
   */
  getConnectedCount(): number {
    return this.io?.engine.clientsCount || 0;
  }

  /**
   * Get detailed statistics
   */
  getStats(): {
    initialized: boolean;
    connectedClients: number;
    rooms?: number;
  } {
    if (!this.io) {
      return {
        initialized: false,
        connectedClients: 0,
      };
    }

    // Count unique rooms
    const rooms = new Set<string>();
    this.io.sockets.adapter.rooms.forEach((_, roomName) => {
      rooms.add(roomName);
    });

    return {
      initialized: true,
      connectedClients: this.io.engine.clientsCount,
      rooms: rooms.size,
    };
  }
}

export const websocketService = new WebSocketService();

