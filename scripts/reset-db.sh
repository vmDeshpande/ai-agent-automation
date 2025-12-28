#!/bin/bash
set -e

echo "⚠️ WARNING: This will wipe database collections"

read -p "Are you sure? (y/N): " confirm
if [[ "$confirm" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

node backend/scripts/reset-db.js
