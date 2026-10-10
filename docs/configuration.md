# Configuration

[← README](../README.md) · [Docs index](README.md) · [ENV_SETUP.md](../ENV_SETUP.md)

## Backend (`backend/.env`)

```bash
cd backend && cp env.example .env
```

Key variables:

```env
PORT=3001
NODE_ENV=production
DATABASE_PATH=./data/freqhub.db
ENCRYPTION_KEY=your-secret-encryption-key-min-32-characters
JWT_SECRET=change-this-jwt-secret-in-production-min-32-chars
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info

VALKEY_ENABLED=true
VALKEY_HOST=localhost
VALKEY_PORT=6379
VALKEY_PASSWORD=

POLLING_ENABLED=true
POLLING_INTERVAL=10000

RATE_LIMIT_ENABLED=true
RATE_LIMIT_DEFAULT=60
RATE_LIMIT_WINDOW=60

DEFAULT_ADMIN_USERNAME=freqhub
DEFAULT_ADMIN_EMAIL=admin@freqhub.local
```

**Production:**

- Never ship example `ENCRYPTION_KEY` / `JWT_SECRET`
- Set explicit `CORS_ORIGIN` (no `*`)
- Prefer K8s `Secret` / secret manager over baking secrets into images

Polling keeps bot cache warm; it does **not** consume the per-bot rate limit. Frontend API traffic does.

## Frontend (`frontend/.env`)

```bash
cd frontend && cp env.example .env
```

```env
VITE_BASE_PATH=/
VITE_API_PROXY_TARGET=http://localhost:3001
```

### Base path (reverse proxy / Ingress)

```bash
VITE_BASE_PATH=/freqhub/ pnpm dev
docker run -e BASE_PATH=/freqhub/ freqhub
```

## Freqtrade API

Each bot needs API + CORS:

```json
{
  "api_server": {
    "enabled": true,
    "listen_ip_address": "0.0.0.0",
    "listen_port": 8080,
    "CORS_origins": ["https://your-freqhub-domain.com"],
    "username": "your_username",
    "password": "your_password"
  }
}
```

API URL format depends on **where the FreqHub backend runs** — see [Usage → Bot configuration](usage.md#bot-configuration-guide).

<p align="right"><a href="#configuration">⬆ back to top</a></p>
