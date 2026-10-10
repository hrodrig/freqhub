# Testing & health checks

[← README](../README.md) · [Docs index](README.md)

Swagger: `http://localhost:3001/api-docs`

## WebSocket

```bash
cd backend
npm run test:websocket [botId]
```

Dev helpers:

- `POST /api/test/event` — publish test event
- `GET /api/test/websocket` — connection stats
- `GET /api/healthz/websocket` — WS health

## Polling

- `GET /api/test/polling` / `POST /api/test/polling`
- `GET /api/healthz/polling`

```bash
curl http://localhost:3001/api/healthz/polling | jq
cd backend && ./scripts/test-polling.sh
```

Expect `"enabled": true`, `"running": true`, recent `lastPollTimes`.

## Rate limit

- `GET /api/test/ratelimit`
- `POST /api/test/ratelimit/reset` with `{"botId":"..."}`
- `GET /api/healthz/ratelimit`

## Health

- `GET /api/healthz`
- `GET /api/healthz/cache`
- `GET /api/healthz/websocket`
- `GET /api/healthz/polling`
- `GET /api/healthz/ratelimit`

CLI wrappers: `./freqhub test-websocket`, `./freqhub test-polling`.

<p align="right"><a href="#testing--health-checks">⬆ back to top</a></p>
