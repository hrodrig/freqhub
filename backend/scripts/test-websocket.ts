#!/usr/bin/env node
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

/**
 * Simple WebSocket test client
 * 
 * Usage:
 *   npm run test:websocket
 *   or
 *   tsx scripts/test-websocket.ts [botId]
 * 
 * This script connects to the WebSocket server and listens for events.
 * You can publish test events using: POST /api/test/event
 */

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const BASE_PATH = process.env.BASE_PATH || '';

console.log('🔌 Connecting to WebSocket server...');
console.log(`   URL: ${SERVER_URL}${BASE_PATH}/socket.io`);

const socket: Socket = io(`${SERVER_URL}${BASE_PATH}`, {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log(`   Socket ID: ${socket.id}`);
  console.log('\n📡 Listening for events...\n');

  // Subscribe to a test bot
  const testBotId = process.argv[2] || 'test-bot-1';
  console.log(`📌 Subscribing to bot: ${testBotId}`);
  socket.emit('subscribe:bot', testBotId);

  // Subscribe to system events
  socket.emit('subscribe:system');
});

socket.on('subscribed', (data: { room: string }) => {
  console.log(`✅ Subscribed to room: ${data.room}`);
});

socket.on('unsubscribed', (data: { room: string }) => {
  console.log(`❌ Unsubscribed from room: ${data.room}`);
});

socket.on('bot_event', (event: any) => {
  console.log('📨 Bot Event Received:');
  console.log(JSON.stringify(event, null, 2));
  console.log('');
});

socket.on('system_event', (event: any) => {
  console.log('📨 System Event Received:');
  console.log(JSON.stringify(event, null, 2));
  console.log('');
});

socket.on('broadcast_event', (event: any) => {
  console.log('📢 Broadcast Event Received:');
  console.log(JSON.stringify(event, null, 2));
  console.log('');
});

socket.on('disconnect', (reason: string) => {
  console.log(`\n❌ Disconnected: ${reason}`);
  process.exit(0);
});

socket.on('connect_error', (error: Error) => {
  console.error('❌ Connection error:', error.message);
  console.error('\n💡 Make sure the backend server is running:');
  console.error('   cd backend && npm run dev');
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});

// Instructions
setTimeout(() => {
  console.log('\n💡 To test events, run in another terminal:');
  console.log(`   curl -X POST ${SERVER_URL}${BASE_PATH}/api/test/event \\`);
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"type":"test_event","botId":"test-bot-1","data":{"message":"Hello!"}}\'');
  console.log('\n   Or visit: http://localhost:3001/api-docs');
  console.log('   and use the POST /api/test/event endpoint\n');
}, 1000);

