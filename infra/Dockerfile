# Stage 1: Backend
FROM node:20 AS backend

WORKDIR /app/backend

COPY backend/package*.json ./
COPY backend/ ./

RUN npm ci --omit=dev --legacy-peer-deps --no-audit

EXPOSE 5000

CMD ["node", "server.js"]

# Stage 2: Frontend
FROM node:20 AS frontend

WORKDIR /app

COPY frontend/package*.json ./
COPY frontend/ ./
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_FONT_GOOGLE_DOWNLOAD=0
RUN npm ci && npm run build

EXPOSE 3000

CMD ["npm", "start"]
