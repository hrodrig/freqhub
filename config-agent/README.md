# FreqHub Config Agent

A lightweight sidecar agent that runs alongside Freqtrade bots to enable remote configuration management.

## Purpose

The Config Agent provides a simple HTTP API for:
- **Reading** the bot's `config.json` from the filesystem
- **Writing** new configurations to the filesystem
- **Triggering** `reload_config` on the bot

This enables the FreqHub Config Service to manage bot configurations remotely, whether the bots are running in Docker or Kubernetes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Pod / Container Group                                          │
│  ┌─────────────────┐      ┌─────────────────────────────┐      │
│  │ Config Agent    │      │ Freqtrade Bot               │      │
│  │ (Sidecar)       │      │                             │      │
│  │ :3010           │      │ :8080                       │      │
│  │                 │      │                             │      │
│  │ GET  /config    │◄────►│ /freqtrade/user_data/       │      │
│  │ PUT  /config    │      │   config.json               │      │
│  │ POST /reload    │─────►│ POST /api/v1/reload_config  │      │
│  └─────────────────┘      └─────────────────────────────┘      │
│         │                            ▲                          │
│         │     Shared Volume          │                          │
│         └────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth) |
| GET | `/config` | Read config.json |
| PUT | `/config` | Write config.json |
| POST | `/reload` | Trigger bot's reload_config |
| POST | `/config/push` | Write config + reload (convenience) |
| GET | `/backups` | List available backups |

## Quick Start

### With Docker Compose

See `examples/docker/docker-compose-bot-with-agent.yml` for a complete example:

```bash
cd examples/docker
docker compose -f docker-compose-bot-with-agent.yml up -d
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3010 | Agent port |
| `CONFIG_PATH` | /freqtrade/user_data/config.json | Path to config file |
| `BOT_API_URL` | http://localhost:8080 | Bot API URL |
| `BOT_API_USERNAME` | freqtrader | Bot API username |
| `BOT_API_PASSWORD` | (required) | Bot API password |
| `API_KEY` | (optional) | API key to protect agent |
| `BACKUP_ENABLED` | true | Enable config backups |
| `BACKUP_COUNT` | 5 | Number of backups to keep |
| `LOG_LEVEL` | info | Log level |

## Usage Examples

### Read Config (PULL)

```bash
curl http://localhost:3010/config \
  -H "x-api-key: your-api-key"
```

Response:
```json
{
  "status": "success",
  "data": {
    "config": { "dry_run": true, "strategy": "MyStrategy", ... },
    "path": "/freqtrade/user_data/config.json",
    "readAt": "2026-01-26T10:00:00.000Z"
  }
}
```

### Write Config (PUSH)

```bash
curl -X PUT http://localhost:3010/config \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"config": {"dry_run": false, "strategy": "MyStrategy", ...}}'
```

### Write + Reload (PUSH with reload)

```bash
curl -X POST http://localhost:3010/config/push \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"config": {"dry_run": false, ...}, "reload": true}'
```

### Trigger Reload Only

```bash
curl -X POST http://localhost:3010/reload \
  -H "x-api-key: your-api-key"
```

### List Backups

```bash
curl http://localhost:3010/backups \
  -H "x-api-key: your-api-key"
```

## Kubernetes Deployment

In Kubernetes, deploy the agent as a sidecar container in the same Pod as the Freqtrade bot:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: freqtrade-bot-1
spec:
  replicas: 1
  template:
    spec:
      containers:
        # Main bot container
        - name: freqtrade
          image: freqtradeorg/freqtrade:stable
          volumeMounts:
            - name: config-volume
              mountPath: /freqtrade/user_data
          # ... bot config ...

        # Sidecar agent
        - name: config-agent
          image: freqhub/config-agent:latest
          ports:
            - containerPort: 3010
          env:
            - name: CONFIG_PATH
              value: /freqtrade/user_data/config.json
            - name: BOT_API_URL
              value: http://localhost:8080
            - name: BOT_API_USERNAME
              value: freqtrader
            - name: BOT_API_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: bot-secrets
                  key: api-password
            - name: API_KEY
              valueFrom:
                secretKeyRef:
                  name: agent-secrets
                  key: api-key
          volumeMounts:
            - name: config-volume
              mountPath: /freqtrade/user_data

      volumes:
        - name: config-volume
          emptyDir: {}
          # Or use PVC for persistence:
          # persistentVolumeClaim:
          #   claimName: bot-config-pvc
```

## Integration with Config Service

The FreqHub Config Service uses the agent for:

1. **PULL** - Sync config from bot to MongoDB:
   ```bash
   POST /api/sync/{botId}/pull
   { "agentUrl": "http://bot-agent:3010" }
   ```

2. **PUSH** - Deploy config from MongoDB to bot:
   ```bash
   POST /api/sync/{botId}/push
   { "agentUrl": "http://bot-agent:3010", "reload": true }
   ```

## Security

- Always set `API_KEY` in production
- Use HTTPS in production (via ingress/load balancer)
- The agent should only be accessible from the Config Service network
- Bot API credentials are stored in the agent, not sent over the network

## License

GPL-3.0 - See [LICENSE](../LICENSE) for details.
