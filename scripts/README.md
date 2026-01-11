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

# Utility Scripts

This directory contains helper scripts for setting up and testing the complete FreqHub stack.

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

## Available Scripts

### `setup-test-env.sh`

Initial test environment setup script.

**Usage:**
```bash
./scripts/setup-test-env.sh
```

**What it does:**
- Verifies that Docker is installed and running
- Creates necessary data directories
- Copies Freqtrade configurations to data directories
- Verifies and creates `.env` files if they don't exist
- Verifies port availability
- Shows a summary of next steps

**When to use it:**
- First time setting up the environment
- After cloning the repository
- When you need to reset the test environment

### `test-connection.sh`

Script to test connectivity between all services in the stack.

**Usage:**
```bash
./scripts/test-connection.sh
```

**What it does:**
- Tests that FreqHub backend responds
- Tests that FreqHub frontend responds
- Tests that all Freqtrade instances respond
- Verifies authentication with Freqtrade
- Verifies connectivity between Docker services
- Shows a summary of all tests

**When to use it:**
- After starting the complete stack
- When you suspect connectivity issues
- To verify everything works before starting development
- As part of your CI/CD workflow

**Optional environment variables:**
```bash
FREQTRADE_USERNAME=freqtrader \
FREQTRADE_PASSWORD=SuperSecret1! \
BACKEND_URL=http://localhost:3001 \
FRONTEND_URL=http://localhost:3000 \
FREQTRADE_1_URL=http://localhost:8080 \
FREQTRADE_2_URL=http://localhost:8081 \
./scripts/test-connection.sh
```

## Requirements

- Bash 4.0+
- Docker and Docker Compose
- `curl` (for test-connection.sh)
- `wget` (for health checks in Docker)
- `lsof` (optional, for port verification on macOS/Linux)

## Permissions

Scripts must have execute permissions. If they don't:

```bash
chmod +x scripts/*.sh
```

## Troubleshooting

### Error: "Permission denied"

```bash
chmod +x scripts/setup-test-env.sh
chmod +x scripts/test-connection.sh
```

### Error: "Docker is not running"

Make sure Docker Desktop (or Docker daemon) is running.

### Error: "Port X is in use"

Stop the service using the port or change the configuration in `docker-compose.full.yml`.

### Error: "curl: command not found"

Install curl:
- macOS: `brew install curl`
- Ubuntu/Debian: `sudo apt-get install curl`
- Fedora: `sudo dnf install curl`
