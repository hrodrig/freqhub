/*
 * FreqHub - Multi-bot dashboard for Freqtrade
 * Copyright (C) 2025 - 2026  FreqHub Contributors
 */

# Contributing to FreqHub

Thanks for helping. The project is early (alpha); small, focused changes are easiest to review.

## Code of Conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security issues

Report vulnerabilities privately — see [SECURITY.md](SECURITY.md). Do not file public issues for security bugs.

## Development setup

Prerequisites and install steps: [README.md](README.md) and [ENV_SETUP.md](ENV_SETUP.md). Testing notes: [TESTING.md](TESTING.md).

Typical local layout:

```bash
git clone https://github.com/hrodrig/freqhub.git
cd freqhub
# backend / frontend / config-* each have their own package.json
cd backend && npm ci && npm run dev
cd ../frontend && npm ci && npm run dev
```

## Branch strategy

| Branch | Role |
|--------|------|
| `main` | Production-ready / shipped |
| `develop` | Integration default |
| `feature/*`, `fix/*` | Work branches |

1. Fork (or use a branch on a clone with write access)
2. Branch from **`develop`**
3. Make changes; keep PRs focused
4. Open a pull request **into `develop`**

## Pull requests

- Describe **why** and what was tested
- Prefer conventional-style titles (`feat:`, `fix:`, `docs:`, `security:`)
- Update [CHANGELOG.md](CHANGELOG.md) `[Unreleased]` when the change is user-visible
- CI runs `npm run build` for backend and frontend on PRs to `main`/`develop`
- Lint is not yet a hard CI gate (known debt); still fix new lint issues in files you touch when practical

## Coding notes

- TypeScript throughout; match existing patterns in the package you edit
- Backend routes that call bots: auth + ownership (or auditor/superadmin) + rate limits where applicable
- Do not commit secrets, `.env`, or local `.planning/` notes
- Copyright header on new source files — see [COPYRIGHT_GUIDE.md](COPYRIGHT_GUIDE.md)

## License

Contributions are under the same license as the project: [GPL-3.0](LICENSE).
