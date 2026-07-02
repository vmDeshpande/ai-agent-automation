#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infra"

cd "$INFRA_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created infra/.env from infra/.env.example"
fi

if [ "${1:-}" = "--proxy" ]; then
  docker compose --profile proxy up -d --build
else
  docker compose up -d --build
fi
