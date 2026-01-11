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

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.js';

const basePath = env.BASE_PATH || '';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FreqHub API',
      version: '0.1.0',
      description: 'API documentation for FreqHub - Multi-bot dashboard for Freqtrade',
      contact: {
        name: 'FreqHub',
        url: 'https://github.com/hrodrig/freqhub',
      },
      license: {
        name: 'GPL-3.0',
        url: 'https://www.gnu.org/licenses/gpl-3.0.html',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}${basePath}`,
        description: 'Development server (default)',
      },
      {
        url: `https://api.example.com${basePath}`,
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints',
      },
      {
        name: 'Bots',
        description: 'Bot management endpoints',
      },
      {
        name: 'Proxy',
        description: 'Proxy endpoints to Freqtrade instances',
      },
    ],
    components: {
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error',
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'success',
            },
            data: {
              type: 'object',
            },
          },
        },
        Bot: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            name: {
              type: 'string',
              example: 'My Trading Bot',
            },
            apiUrl: {
              type: 'string',
              format: 'uri',
              example: 'http://localhost:8080',
            },
            wsUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'ws://localhost:8080',
            },
            username: {
              type: 'string',
              example: 'freqtrader',
            },
            password: {
              type: 'string',
              format: 'password',
              example: '********',
              description: 'Password is stored encrypted and never returned in API responses. Shown here for structure reference only.',
              readOnly: true,
              writeOnly: false,
            },
            isEnabled: {
              type: 'boolean',
              example: true,
            },
            isSelected: {
              type: 'boolean',
              example: false,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreateBotRequest: {
          type: 'object',
          required: ['name', 'apiUrl', 'username', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              example: 'My Trading Bot',
            },
            apiUrl: {
              type: 'string',
              format: 'uri',
              example: 'http://localhost:8080',
            },
            wsUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'ws://localhost:8080',
            },
            username: {
              type: 'string',
              minLength: 1,
              example: 'freqtrader',
            },
            password: {
              type: 'string',
              minLength: 1,
              format: 'password',
              example: '********',
              description: 'Password for Freqtrade API authentication (will be encrypted)',
            },
          },
        },
        UpdateBotRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
            },
            apiUrl: {
              type: 'string',
              format: 'uri',
            },
            wsUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
            },
            username: {
              type: 'string',
              minLength: 1,
            },
            password: {
              type: 'string',
              minLength: 1,
              format: 'password',
              example: '********',
              description: 'Password for Freqtrade API authentication (will be encrypted if provided)',
            },
            isEnabled: {
              type: 'boolean',
            },
            isSelected: {
              type: 'boolean',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            uptime: {
              type: 'number',
              example: 1234.56,
            },
            database: {
              type: 'string',
              example: 'connected',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API files
};

export const swaggerSpec = swaggerJsdoc(options);

