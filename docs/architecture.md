# Architecture

[← README](../README.md) · [Docs index](README.md)

```text
┌─────────────┐     HTTP/WS      ┌──────────────────┐     HTTPS      ┌────────────┐
│  React UI   │ ◄──────────────► │  Express backend │ ◄────────────► │ Freqtrade  │
│  (Vite)     │                  │  JWT · proxy     │                │ instances  │
└─────────────┘                  │  SQLite · Valkey │                └────────────┘
                                 └──────────────────┘
```

## Frontend

- React 18, TypeScript, Vite
- React Router, Zustand, Axios
- Socket.io-client, Tailwind, Recharts, Zod

## Backend

- Node.js 18+, Express, TypeScript
- SQLite (migration path to Postgres/MySQL planned)
- AES-256-CBC for bot credentials; bcrypt + JWT for users
- Valkey/Redis cache + Pub/Sub event bus (in-memory fallback)
- Socket.io WebSocket server
- Polling service for cache freshness and online/offline events
- Per-bot rate limiting toward Freqtrade APIs
- AAA: auth, RBAC, audit

## Design goals

1. **One UI, many bots** — credentials stay on the server
2. **Proxy** — browser never talks CORS-directly to every Freqtrade
3. **Deploy-friendly** — base path, Docker, Kubernetes Ingress
4. **Realtime** — cache + events + WS for snappy dashboards

<p align="right"><a href="#architecture">⬆ back to top</a></p>
