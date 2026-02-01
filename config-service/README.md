# FreqHub Config Service

Centralized configuration management service for FreqHub bots. This service provides:

- **Centralized Storage**: All bot configs stored in MongoDB
- **Version Control**: Full history of config changes with diff tracking
- **Draft System**: Edit configs locally before deploying
- **Deploy Management**: Track all deployments with audit trail
- **Rollback Support**: Easily rollback to any previous version

## Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ FreqHub      │      │ Config Service   │      │ MongoDB         │
│ Frontend     │◄────►│ (Port 3005)      │◄────►│ - bot_configs   │
└──────────────┘      │                  │      │ - config_history│
                      │ • CRUD configs   │      │ - deployments   │
┌──────────────┐      │ • Versioning     │      └─────────────────┘
│ FreqHub      │◄────►│ • Deploy to bot  │
│ Backend      │      │ • Diff/Compare   │
└──────────────┘      └────────┬─────────┘
                               │
                               │ HTTP (deploy config)
                               ▼
         ┌───────────────────────────────────────────────┐
         │              Bot Fleet                         │
         │  ┌─────────┐  ┌─────────┐       ┌─────────┐  │
         │  │ Bot 1   │  │ Bot 2   │  ...  │ Bot N   │  │
         └───────────────────────────────────────────────┘
```

## Quick Start

### With Docker Compose (Recommended)

The config service is included in `docker-compose.full.yml`:

```bash
# From the project root
docker compose -f docker-compose.full.yml up -d
```

This will start:
- MongoDB on port 27017
- Config Service on port 3005

### Local Development

```bash
cd config-service

# Install dependencies
npm install

# Copy environment file
cp env.example .env

# Edit .env with your settings
# - Set API_KEY (min 32 characters)
# - Set ENCRYPTION_KEY (min 32 characters)
# - Configure MongoDB URI if not using default

# Start MongoDB (if not using Docker)
# mongod --dbpath ./data

# Start in development mode
npm run dev
```

## API Endpoints

### Configs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/configs` | List all bot configs |
| GET | `/api/configs/:botId` | Get config for a bot |
| POST | `/api/configs` | Create new bot config |
| PUT | `/api/configs/:botId` | Update config (creates draft) |
| DELETE | `/api/configs/:botId` | Delete bot config |

### Draft Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/configs/:botId/draft` | Get draft config |
| POST | `/api/configs/:botId/draft/apply` | Apply draft to current |
| DELETE | `/api/configs/:botId/draft` | Discard draft |

### Quick Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/configs/:botId/quick-edit` | Edit a single field |
| POST | `/api/configs/:botId/runmode` | Set dry_run/live |

### Deploy

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/configs/:botId/deploy` | Deploy config to bot |
| POST | `/api/configs/:botId/rollback` | Rollback to version |

### Versioning

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/configs/:botId/versions` | Get version history |
| GET | `/api/configs/:botId/versions/:v` | Get specific version |
| GET | `/api/configs/:botId/diff` | Diff current vs draft |
| GET | `/api/configs/:botId/diff/:v1/:v2` | Diff two versions |

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deployments` | Get all deployments |
| GET | `/api/deployments/bot/:botId` | Get bot deployments |
| POST | `/api/deployments/bulk` | Bulk deploy to bots |

### Sync (with Config Agent)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/:botId/pull` | Pull config from bot via agent |
| POST | `/api/sync/:botId/push` | Push config to bot via agent |
| GET | `/api/sync/:botId/agent-health` | Check agent health |
| GET | `/api/sync/:botId/backups` | List agent backups |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/health/detailed` | Detailed stats |

## Authentication

All API endpoints (except health) require an API key:

```bash
curl -H "x-api-key: your-api-key" http://localhost:3005/api/configs
```

## Usage Examples

### Create a Config

```bash
curl -X POST http://localhost:3005/api/configs \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{
    "botId": "bot-uuid-here",
    "botName": "My Trading Bot",
    "config": {
      "dry_run": true,
      "stake_currency": "USDT",
      "stake_amount": 100,
      "strategy": "MyStrategy"
    }
  }'
```

### Change Runmode

```bash
# Change to live trading (creates draft)
curl -X POST http://localhost:3005/api/configs/bot-uuid/runmode \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"runmode": "live"}'

# Change and deploy immediately
curl -X POST http://localhost:3005/api/configs/bot-uuid/runmode \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"runmode": "live", "deploy": true}'
```

### View Diff

```bash
# Diff current vs draft
curl http://localhost:3005/api/configs/bot-uuid/diff \
  -H "x-api-key: your-api-key"

# Diff two versions
curl http://localhost:3005/api/configs/bot-uuid/diff/1/3 \
  -H "x-api-key: your-api-key"
```

### Rollback

```bash
curl -X POST http://localhost:3005/api/configs/bot-uuid/rollback \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"version": 2, "deploy": true}'
```

### Sync with Agent (PULL - Read from bot)

```bash
# Pull config from bot via agent and save to MongoDB
curl -X POST http://localhost:3005/api/sync/bot-uuid/pull \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"agentUrl": "http://bot-agent:3010"}'
```

### Sync with Agent (PUSH - Write to bot)

```bash
# Push config from MongoDB to bot via agent
curl -X POST http://localhost:3005/api/sync/bot-uuid/push \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"agentUrl": "http://bot-agent:3010", "reload": true}'
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3005 | Service port |
| `NODE_ENV` | development | Environment |
| `MONGODB_URI` | mongodb://localhost:27017 | MongoDB connection |
| `MONGODB_DATABASE` | freqhub_config | Database name |
| `API_KEY` | (required) | API key for auth |
| `ENCRYPTION_KEY` | (required) | Key for encrypting secrets |
| `FREQHUB_BACKEND_URL` | http://localhost:3001 | FreqHub backend URL |
| `LOG_LEVEL` | info | Log level |

## Data Model

### BotConfig

```typescript
{
  botId: string;           // UUID from FreqHub
  botName: string;         // Display name
  currentConfig: object;   // Active config
  currentVersion: number;  // Version number
  draftConfig?: object;    // Pending changes
  hasPendingChanges: boolean;
  agentUrl?: string;       // Optional config agent URL
  lastDeployedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### ConfigVersion

```typescript
{
  botId: string;
  version: number;
  config: object;
  changedFields: string[];
  previousValues?: object;
  createdAt: Date;
  createdBy?: string;
  comment?: string;
  source: 'manual' | 'import' | 'sync' | 'rollback';
}
```

### Deployment

```typescript
{
  botId: string;
  configVersion: number;
  status: 'pending' | 'deploying' | 'success' | 'failed';
  method: 'agent' | 'api_reload' | 'manual';
  botResponse?: object;
  errorMessage?: string;
  deployedAt: Date;
  deployedBy?: string;
  duration?: number;
}
```

## Sensitive Data

The following fields are automatically encrypted when stored:

- `exchange.key`
- `exchange.secret`
- `exchange.password`
- `api_server.password`
- `api_server.jwt_secret_key`
- `telegram.token`

When viewing configs via API, these fields are redacted as `********`.

## Future: Config Agent

For deploying configs to bots on remote hosts, you'll need a Config Agent. The agent is a lightweight service that runs alongside your bots and handles:

- Receiving config updates from the Config Service
- Writing config.json to the filesystem
- Triggering reload_config on the bot

See the roadmap for Config Agent development.

## License

GPL-3.0 - See [LICENSE](../LICENSE) for details.
