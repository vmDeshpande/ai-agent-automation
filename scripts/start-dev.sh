#!/bin/bash
set -e

echo "Starting backend + worker + frontend (dev mode)"

cd backend
npm install
npm run dev &

npm run worker &

cd ../frontend
npm install
npm run dev
