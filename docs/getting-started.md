# Getting started

[← README](../README.md) · [Docs index](README.md)

## Prerequisites

**End users:** Docker only.

**Developers:**

- Node.js 18+ and npm/pnpm/yarn
- One or more [Freqtrade](https://github.com/freqtrade/freqtrade) instances with API enabled
- Modern browser
- Optional: Valkey/Redis (recommended with many bots)

## End users (Docker — recommended)

```bash
docker compose -f docker-compose.published.yml up -d

# Or pin tags
FREQHUB_BACKEND_IMAGE=freqhub/freqhub-backend:v0.2.24 \
FREQHUB_FRONTEND_IMAGE=freqhub/freqhub-frontend:v0.2.24 \
docker compose -f docker-compose.published.yml up -d
```

Build from source:

```bash
./freqhub start   # or: docker compose -f docker-compose.full.yml up -d
./freqhub stop
./freqhub logs
```

## Developers (CLI)

`./freqhub` works on macOS, Linux, and Windows (Git Bash).

```bash
./freqhub setup          # deps, .env, example DB
./freqhub dev-bots       # Valkey + sample Freqtrade bots
./freqhub dev            # backend + frontend
./freqhub dev-bots-stop
./freqhub help
```

Useful commands: `install`, `dev-backend`, `dev-frontend`, `build`, `docker-up`, `lint`, `format`, `test-websocket`, `test-polling`, `status`.

### Manual setup

```bash
git clone https://github.com/hrodrig/freqhub.git
cd freqhub

cd backend
cp env.example .env   # set ENCRYPTION_KEY and JWT_SECRET
npm install
cp ../data/freqhub.db.example ../data/freqhub.db   # optional seed
npm run dev

# other terminal
cd frontend
cp env.example .env
npm install
npm run dev
```

- Backend: `http://localhost:3001`
- Frontend: `http://localhost:3000`

Use the **same `ENCRYPTION_KEY`** in local and Docker. See [ENV_SETUP.md](../ENV_SETUP.md).

If you open the UI at `http://127.0.0.1:3000`, set `CORS_ORIGIN` in `backend/.env` to that origin (or stick to `localhost`).

### Local bots + Valkey

Before `./freqhub dev`:

```bash
./freqhub dev-bots
# or: cd examples/docker && docker compose -f docker-compose-bots-valkey.yml up -d
```

Starts Valkey (`6379`) and three Freqtrade bots (`8080`–`8082`).

### Production build

```bash
./freqhub build
# or npm run build in backend/ and frontend/
```

## Valkey (optional, recommended)

Included in `docker-compose.full.yml`. Local:

```bash
# macOS: brew install valkey && valkey-server
# Ubuntu: sudo apt-get install valkey && valkey-server
```

```env
VALKEY_ENABLED=true
VALKEY_HOST=localhost
VALKEY_PORT=6379
```

If Valkey is down or disabled, FreqHub falls back to in-memory cache.

More examples: [examples/docker/README.md](../examples/docker/README.md).

<p align="right"><a href="#getting-started">⬆ back to top</a></p>
