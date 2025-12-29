# Base Path Configuration

The FreqHub backend supports a configurable base path for all API routes. This is useful when deploying behind a reverse proxy (such as Nginx, Kubernetes Ingress, etc.) where the application needs to be at a specific path.

## Configuration

The `BASE_PATH` can be configured in three ways:

### 1. Environment Variable

```bash
export BASE_PATH=/freqhub
npm run dev
```

### 2. .env File

Create or edit `backend/.env`:

```env
BASE_PATH=/freqhub
```

### 3. Command Line

```bash
BASE_PATH=/freqhub npm run dev
BASE_PATH=/freqhub npm start
```

## Examples

### Without Base Path (default)

```bash
# Don't configure BASE_PATH or leave it empty
npm run dev
```

Available routes:
- `http://localhost:3001/api/healthz`
- `http://localhost:3001/api/bots`

### With Base Path

```bash
BASE_PATH=/freqhub npm run dev
```

Available routes:
- `http://localhost:3001/freqhub/api/healthz`
- `http://localhost:3001/freqhub/api/bots`

### Automatic Normalization

The system automatically normalizes the base path:

- `freqhub` → `/freqhub`
- `/freqhub` → `/freqhub`
- `/freqhub/` → `/freqhub` (removes trailing slash)

## Use Cases

### Kubernetes Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: freqhub-ingress
spec:
  rules:
    - host: example.com
      http:
        paths:
          - path: /freqhub
            pathType: Prefix
            backend:
              service:
                name: freqhub-backend
                port:
                  number: 3001
```

Backend configuration:
```env
BASE_PATH=/freqhub
```

### Nginx Reverse Proxy

```nginx
location /freqhub {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Backend configuration:
```env
BASE_PATH=/freqhub
```

### Docker Compose

```yaml
services:
  backend:
    environment:
      - BASE_PATH=/freqhub
```

## Notes

- The base path applies to **all** API routes
- Don't include `/api` in the BASE_PATH, as internal routes already include it
- The base path must start with `/` (automatically added if missing)
- The trailing slash is automatically removed
