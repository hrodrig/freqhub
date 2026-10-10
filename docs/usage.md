# Usage

[← README](../README.md) · [Docs index](README.md)

## Adding a bot

1. Open **Bots** → **Add Bot**
2. Fill name, Freqtrade API URL, username, password, optional notes
3. Enable/disable monitoring as needed
4. Connection is tested before save

Each bot shows a UUID under the name (handy when matching backend logs).

## Bot configuration guide

API URL depends on **where FreqHub backend runs**, not where Freqtrade runs.

| FreqHub backend | Freqtrade | API URL | Port |
|-----------------|-----------|---------|------|
| Local (`npm run dev`) | Docker on host | `http://localhost:XXXX` | Exposed (8080, 8081…) |
| Docker Compose | Same compose network | `http://<service>:8080` | Internal **8080** |
| Kubernetes | K8s Service | `http://<svc>:8080` | Internal **8080** |

**Avoid:**

- Exposed host port as container service port (`freqtrade-2:8081`)
- `localhost` when FreqHub itself is inside Docker
- Wrong service name / password mismatch

Checklist: URL mode, service name, port, username, password.

Examples:

- [Docker Compose](../examples/docker/README.md#important-api-url-configuration-by-deployment-mode)
- [Kubernetes](../examples/kubernetes/README.md#important-api-url-configuration---service-names-and-ports)

## Dashboard

- Aggregated stats (bots, trades, profit + period)
- Per-bot cards: online/offline, run state, dry/live, strategy, open trades
- Quick actions: start / stop / pause / reload / refresh / settings
- Live updates over WebSocket

## Individual bot

Config, status, balance, open/closed trades, controls. Running bots cannot be edited or deleted — stop first.

## Product surfaces (0.2.24+)

- Bot comparison
- Trade management
- Backtest comparison
- Centralized alerts

<p align="right"><a href="#usage">⬆ back to top</a></p>
