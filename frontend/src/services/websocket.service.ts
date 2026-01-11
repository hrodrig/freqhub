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

import { io, type Socket } from 'socket.io-client';
import { config } from '../config/env.js';

export interface FreqHubEvent {
  type: string;
  botId?: string;
  data?: any;
  timestamp?: number;
}

type EventCallback = (event: FreqHubEvent) => void;

/**
 * WebSocket Service for real-time updates
 */
class WebSocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      return;
    }

    // Socket.io automatically handles http/https to ws/wss conversion
    this.socket = io(config.apiUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('[WebSocket] Connected');
      
      // Subscribe to system events by default
      this.socket?.emit('subscribe:system');
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('[WebSocket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Listen for bot events
    this.socket.on('bot_event', (event: FreqHubEvent) => {
      console.log('[WebSocket] Received bot_event:', event.type, 'for bot:', event.botId, event);
      this.handleEvent('bot_event', event);
      this.handleEvent(`bot_event:${event.botId}`, event);
    });

    // Listen for system events
    this.socket.on('system_event', (event: FreqHubEvent) => {
      this.handleEvent('system_event', event);
    });

    // Listen for broadcast events
    this.socket.on('broadcast_event', (event: FreqHubEvent) => {
      this.handleEvent('broadcast_event', event);
    });

    // Listen for subscription confirmations
    this.socket.on('subscribed', (data: { room: string }) => {
      console.log('[WebSocket] Subscribed to:', data.room);
    });

    this.socket.on('unsubscribed', (data: { room: string }) => {
      console.log('[WebSocket] Unsubscribed from:', data.room);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.eventListeners.clear();
    }
  }

  /**
   * Subscribe to events for a specific bot
   */
  subscribeToBot(botId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:bot', botId);
    }
  }

  /**
   * Unsubscribe from events for a specific bot
   */
  unsubscribeFromBot(botId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('unsubscribe:bot', botId);
    }
  }

  /**
   * Subscribe to system events
   */
  subscribeToSystem(): void {
    if (this.socket?.connected) {
      this.socket.emit('subscribe:system');
    }
  }

  /**
   * Add event listener
   */
  on(eventType: string, callback: EventCallback): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Remove event listener
   */
  off(eventType: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * Handle incoming event
   */
  private handleEvent(eventType: string, event: FreqHubEvent): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[WebSocket] Error in event callback:', error);
        }
      });
    }

    // Also trigger wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[WebSocket] Error in wildcard callback:', error);
        }
      });
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }
}

export const websocketService = new WebSocketService();

