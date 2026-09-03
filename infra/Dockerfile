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
# BACKEND_INTERNAL_URL is a SERVER-ONLY variable read by
# `next.config.js`. The browser never sees it; it is only used by the
# Next.js server (running in this container) to proxy /api/* and
# /socket.io/* to the backend. Build with --build-arg
# BACKEND_INTERNAL_URL=http://backend:5000 to override the default.
ARG BACKEND_INTERNAL_URL=http://backend:5000
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
# Escape hatch: callers that need a cross-origin browser → backend
# connection can still force an absolute NEXT_PUBLIC_API_URL by passing
# it as a build arg. The default omits the env entirely so the browser
# uses the same-origin /api path (see frontend/next.config.js).
# ARG NEXT_PUBLIC_API_URL
# ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_FONT_GOOGLE_DOWNLOAD=0
RUN npm ci && npm run build

EXPOSE 3000

CMD ["npm", "start"]
