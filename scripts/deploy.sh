#!/bin/bash
set -e

echo "Deploying AI Agent Automation (manual deploy)"

# build frontend
cd frontend
npm install
npm run build

# restart backend services
cd ../backend
npm install
pm2 restart backend || pm2 start server.js --name backend
pm2 restart worker || pm2 start src/agents/runner.js --name worker
