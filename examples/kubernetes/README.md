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

# Kubernetes Deployment for FreqHub

This directory contains Kubernetes manifests to deploy FreqHub in your cluster.

## ⚖️ Disclaimer

**USE AT YOUR OWN RISK**

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

**Trading cryptocurrencies involves substantial risk of loss and is not suitable for every investor.** The value of cryptocurrencies may fluctuate, and you may lose some or all of your investment. Past performance is not indicative of future results. You should carefully consider whether trading cryptocurrencies is suitable for you in light of your circumstances, knowledge, and financial resources.

By using this software, you acknowledge that:
- You understand the risks involved in cryptocurrency trading
- You are solely responsible for any trading decisions made
- The authors and contributors are not responsible for any financial losses
- You will not hold the authors liable for any damages arising from the use of this software

## Structure

- `valkey-pvc.yaml` - PersistentVolumeClaim for Valkey data (MicroK8s local storage)
- `valkey-configmap.yaml` - ConfigMap for Valkey configuration
- `backend-pvc.yaml` - PersistentVolumeClaim for Backend SQLite database (MicroK8s local storage)
- `valkey.yaml` - Valkey cache service (Redis-compatible)
- `backend.yaml` - FreqHub Backend
- `frontend-nginx-configmap.yaml` - ConfigMap with Nginx configuration for Frontend (points to freqhub-backend:3001)
- `frontend.yaml` - FreqHub Frontend
- `ingressroute.example.yaml` - Example IngressRoute for Traefik (reference)

**Note**: All manifests are configured to use the `main` namespace by default, assuming your Freqtrade pods are also in `main`. If the `main` namespace doesn't exist, create it with: `kubectl create namespace main`

## Prerequisites

1. Working Kubernetes cluster
2. `kubectl` configured and connected to the cluster
3. Traefik as Ingress Controller (optional, you can use another)
4. FreqHub Docker images available in your registry:
   - Update the image references in `backend.yaml` and `frontend.yaml` to match your registry
   - Example: `your-registry.com/freqhub/freqhub-backend:dev-latest`
   - Or use Docker Hub: `docker.io/freqhub/freqhub-backend:latest`

## Deployment

**Note**: All resources will be deployed in the `main` namespace. If the `main` namespace doesn't exist, create it first:

```bash
kubectl create namespace main
```

### 1. Deploy Valkey (cache)

First, create the PersistentVolumeClaim for Valkey data:

```bash
kubectl apply -f valkey-pvc.yaml
```

Then, create the ConfigMap for Valkey configuration:

```bash
kubectl apply -f valkey-configmap.yaml
```

**Optional**: Edit `valkey-configmap.yaml` to customize Valkey settings (memory limits, persistence options, etc.)

Finally, deploy Valkey:

```bash
kubectl apply -f valkey.yaml
```

**Note**: The PVC uses the default storage class of your cluster. If you need a specific storage class, edit `valkey-pvc.yaml` and add `storageClassName: <your-storage-class>`.

### 2. Create backend PersistentVolumeClaim

First, create the PVC for the backend database:

```bash
kubectl apply -f backend-pvc.yaml
```

**Note**: The PVC uses the default storage class of your cluster. If you need a specific storage class, edit `backend-pvc.yaml` and add `storageClassName: <your-storage-class>`.

### 3. Configure backend secrets and image tags

**IMPORTANT**: Edit `backend.yaml` and:

1. Update the Secret with real values:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: freqhub-backend-secrets
  namespace: main
type: Opaque
stringData:
  ENCRYPTION_KEY: "your-encryption-key-minimum-32-characters"
```

2. (Optional) Update the image registry and tag if needed:

```yaml
# Example: Use a specific version or different registry
image: your-registry.com/freqhub/freqhub-backend:dev-latest
# Or: docker.io/freqhub/freqhub-backend:v0.2.4
```

Then deploy the backend:

```bash
kubectl apply -f backend.yaml
```

### 4. Deploy Frontend

First, create the Nginx configuration ConfigMap:

```bash
kubectl apply -f frontend-nginx-configmap.yaml
```

This ConfigMap contains the Nginx configuration that points to `http://freqhub-backend:3001`. The default image uses `localhost:3001` for local development, but in Kubernetes this ConfigMap overrides it.

**Optional**: Edit `frontend.yaml` to use a specific image registry and tag if needed:

```yaml
# Example: Use a specific version or different registry
image: your-registry.com/freqhub/freqhub-frontend:dev-latest
# Or: docker.io/freqhub/freqhub-frontend:v0.2.4
```

Then deploy:

```bash
kubectl apply -f frontend.yaml
```

### 5. Configure Ingress/IngressRoute (according to your infrastructure)

**Each user must configure their own Ingress/IngressRoute** according to their infrastructure:

- **Traefik with IngressRoute**: See example in `ingressroute.example.yaml`
- **Traefik with standard Ingress**: Use Kubernetes Ingress resource
- **Nginx Ingress**: Use standard Ingress resource with Nginx annotations
- **Others**: Configure according to your Ingress Controller

**Example for Traefik (IngressRoute):**

Edit `ingressroute.example.yaml` and change the host to your domain, then:

```bash
kubectl apply -f ingressroute.example.yaml
```

**Note**: Services are exposed as ClusterIP, so you need an Ingress/IngressRoute to access from outside the cluster.

## Connect to Existing Freqtrade Instances

Since all resources are deployed in the `main` namespace (same as your Freqtrade pods), connecting them is straightforward:

### Option 1: Use Kubernetes Services

If your Freqtrade pods have Services, you can use the Service name directly (since everything is in the `main` namespace):

**Example:**
- If you have a Service named `freqtrade-bollinger-ema200` in the `main` namespace
- Use: `http://freqtrade-bollinger-ema200:8080` (simple, same namespace)

**Quick way to find Services:**

```bash
kubectl get svc -n main
```

### Option 2: Use Pod IPs directly

You can get a pod's IP:

```bash
kubectl get pod <pod-name> -n <namespace> -o jsonpath='{.status.podIP}'
```

And use: `http://<pod-ip>:8080`

**Note**: This option is not recommended because pod IPs change.

### Option 3: Create Services for your Freqtrade pods

If your Freqtrade pods don't have Services, you can create them:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: freqtrade-bollinger-ema200
  namespace: main
spec:
  selector:
    # Use the labels from your freqtrade pods
    app: freqtrade
    strategy: bollinger-ema200
  ports:
    - port: 8080
      targetPort: 8080
      protocol: TCP
```

Then use: `http://freqtrade-bollinger-ema200:8080` (same namespace, simple!)

## Access FreqHub and Get Login Credentials

### Default Login Credentials

On first startup, FreqHub automatically creates a superadmin user. The credentials are displayed **ONCE** in the backend logs.

**To find the credentials:**

```bash
# View backend logs to find the superadmin credentials
kubectl logs -n main deployment/freqhub-backend | grep -A 5 "SUPERADMIN CREATED"

# Or view all backend logs
kubectl logs -n main deployment/freqhub-backend
```

**Default credentials format:**
- **Username**: `freqhub` (configurable via `DEFAULT_ADMIN_USERNAME` env var)
- **Email**: `admin@freqhub.local` (configurable via `DEFAULT_ADMIN_EMAIL` env var)
- **Password**: Randomly generated secure password (16+ characters) - shown in logs

**⚠️ Important:**
- The credentials are displayed **ONCE** in the server logs on first startup
- Copy the credentials immediately
- Change the password after first login
- Store the credentials securely

**Example log output:**
```
================================================================================
⚠️  SUPERADMIN CREATED AUTOMATICALLY
================================================================================
👤 Username: freqhub
🔑 Password: [randomly generated]
📧 Email: admin@freqhub.local
================================================================================
⚠️  IMPORTANT: Change the password after the first login
⚠️  These credentials are only shown ONCE
================================================================================
```

## Configure Bots in FreqHub

Once deployed and logged in, access FreqHub and add your bots:

1. **Name**: A descriptive name (e.g., "Bollinger EMA200")
2. **API URL**: 
   - Use the **Kubernetes service name** (e.g., `http://freqtrade-service-name:8080`)
   - Or use the **pod name** if no service exists (e.g., `http://freqtrade-pod-name:8080`)
   - **Do NOT use `localhost`** - the backend runs inside Kubernetes and `localhost` refers to the pod itself
3. **Username**: The username configured in Freqtrade
4. **Password**: The password configured in Freqtrade

**Note**: Since everything is in the `main` namespace, you can use simple service names without namespace prefix (e.g., `http://freqtrade-bollinger-ema200:8080`).

## ⚠️ IMPORTANT: API URL Configuration - Service Names and Ports

**CRITICAL**: Pay special attention to service names and ports when configuring bots in FreqHub.

### Understanding Ports in Kubernetes

Each Freqtrade pod:
- **Container port**: Always `8080` (the port Freqtrade listens on inside the container)
- **Service port**: Usually `8080` (the port exposed by the Kubernetes Service)

### Common Mistakes to Avoid

1. ❌ **Using wrong service name**: Check your Kubernetes Services with `kubectl get svc -n main` to get the exact service name
2. ❌ **Using wrong port**: Always use port `8080` (the container port), not any NodePort or LoadBalancer port
3. ❌ **Using localhost**: Never use `localhost` when FreqHub is running in Kubernetes - use the Kubernetes service name
4. ❌ **Wrong password**: Ensure the password matches what's configured in Freqtrade's `config.json` or environment variables
5. ❌ **Wrong namespace**: If services are in different namespaces, use the full format: `http://<service-name>.<namespace>:8080`

### How to Find the Correct Service Name

```bash
# List all services in the main namespace
kubectl get svc -n main

# Example output:
# NAME                      TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
# freqtrade-bollinger-ema200   ClusterIP   10.152.183.45   <none>        8080/TCP   5d
# freqtrade-rsi-momentum      ClusterIP   10.152.183.46   <none>        8080/TCP   5d

# Use the NAME column in your API URL: http://freqtrade-bollinger-ema200:8080
```

### Verification Checklist

Before adding a bot in FreqHub, verify:
- [ ] Service name is correct (check with `kubectl get svc`)
- [ ] Port is `8080` (container port)
- [ ] Username matches Freqtrade configuration
- [ ] Password matches Freqtrade configuration (check `config.json` or environment variables)
- [ ] Service is in the same namespace as FreqHub (or use full namespace format)

## Verify Deployment

```bash
# View pods
kubectl get pods -n main

# View services
kubectl get svc -n main

# View backend logs
kubectl logs -f deployment/freqhub-backend -n main

# View frontend logs
kubectl logs -f deployment/freqhub-frontend -n main
```

## Data Persistence

**Valkey**: Configured with a PersistentVolumeClaim (`valkey-pvc.yaml`) using the default storage class of your cluster. If you need a specific storage class, edit the PVC and add `storageClassName`.

**Backend**: Configured with a PersistentVolumeClaim (`backend-pvc.yaml`) for SQLite database persistence. This ensures data survives pod restarts. The PVC uses the default storage class of your cluster. If you need a specific storage class, edit the PVC and add `storageClassName`.

## Scaling

To scale the backend (if needed):

```bash
kubectl scale deployment freqhub-backend -n main --replicas=2
```

## Troubleshooting

### Backend cannot connect to Valkey

Verify that Valkey is running:

```bash
kubectl get pods -n main | grep valkey
```

### Frontend cannot connect to Backend

Verify that the ConfigMap has the correct backend URL. Since everything is in the same namespace, use the simple service name:

```
VITE_API_PROXY_TARGET=http://freqhub-backend:3001
```

### Ingress/IngressRoute Issues

Verify that your Ingress Controller is working and routes are configured correctly:

**For Traefik with IngressRoute:**
```bash
kubectl get ingressroute -n main
kubectl describe ingressroute freqhub-ingressroute -n main
```

**For standard Ingress:**
```bash
kubectl get ingress -n main
kubectl describe ingress -n main
```

## Discovering Your Freqtrade Services

To find your Freqtrade Services:

```bash
kubectl get svc -n main
```

This will show you all Services. Use the Service name in the URL format: `http://<service-name>:8080`

## Next Steps

Once deployed, go to the "Bots" section in FreqHub and add your existing Freqtrade instances using the URLs provided by the discovery script.
