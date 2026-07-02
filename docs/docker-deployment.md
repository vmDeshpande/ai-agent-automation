# Docker Compose Deployment

This project supports production-ready self-hosting with Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Compose plugin)
- `docker compose` available in terminal

## Quick Start (Production)

From `infra/` directory:

```bash
cd infra
cp .env.example .env
# set JWT_SECRET and any provider keys
docker compose up -d --build
```

Open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:5000/health`

## Optional Production Profile (Reverse Proxy)

Enable the `proxy` profile to run nginx in front of frontend/backend:

```bash
cd infra
docker compose --profile proxy up -d --build
```

- Nginx listens on `${NGINX_PORT:-80}`
- `/` -> frontend
- `/api` -> backend

## One-Command Install Scripts

From repo root:

```bash
# Linux/macOS
bash scripts/deploy-docker.sh

# Linux/macOS with nginx proxy profile
bash scripts/deploy-docker.sh --proxy
```

```powershell
# Windows PowerShell
./scripts/deploy-docker.ps1

# Windows PowerShell with nginx proxy profile
./scripts/deploy-docker.ps1 -Proxy
```

## Development Override (Optional)

Use this when you want bind mounts + dev mode:

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Services

- `frontend` (Next.js)
- `backend` (Express API)
- `worker` (workflow runner)
- `mongo` + `mongo-init-replica`
- `nginx` (optional, profile: `proxy`)

## Reliability Features

- Healthchecks for all major services
- Restart policy: `unless-stopped`
- Startup ordering with `depends_on` conditions
- Persistent MongoDB volume: `mongo_data`

## Common Commands

```bash
# logs
docker compose logs -f

# stop
docker compose down

# stop + remove volumes
docker compose down -v
```

## Troubleshooting

- Port conflict: change `MONGO_PORT`, `BACKEND_PORT`, `FRONTEND_PORT`, `NGINX_PORT` in `infra/.env`
- Reset local database volume:

```bash
docker compose down -v
docker compose up -d --build
```
