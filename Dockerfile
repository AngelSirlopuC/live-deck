# syntax=docker/dockerfile:1
#
# Live Deck production image.
#
# Two stages keep the runtime small: the build stage has the dev toolchain
# (TypeScript, Vite) and produces the static web bundle in dist/; the runtime
# stage only carries production dependencies, the server sources, the bundle
# and the bundled sample decks.

# ---- build: typecheck + Vite bundle -------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Install from the lockfile first so this layer is cached until dependencies change.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts ./
COPY shared ./shared
COPY server ./server
COPY web ./web
# `npm run build` = `tsc --noEmit && vite build` (output: /app/dist).
# tests/ is excluded by .dockerignore; CI typechecks and runs them instead.
RUN npm run build

# ---- runtime ------------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8787 \
    HOST=0.0.0.0

COPY package.json package-lock.json ./
# Production dependencies only; drop the npm cache so it does not ship in the layer.
RUN npm ci --omit=dev && npm cache clean --force

# Sources are owned by root and only readable by the `node` user: the process
# never needs to write to /app (compose also mounts the root filesystem read-only).
COPY shared ./shared
COPY server ./server
COPY decks ./decks
COPY --from=build /app/dist ./dist

# Unprivileged user shipped with the official Node image (uid 1000).
USER node

EXPOSE 8787

# busybox wget is part of the alpine base image; no curl needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1

# Node 24 strips TypeScript types natively (no flag, no build step for the
# server): the server only uses erasable syntax and `.ts` import specifiers.
# Exec form makes node PID 1, so `docker stop` (SIGTERM) reaches the server's own
# signal handler in server/main.ts and it closes sockets cleanly.
CMD ["node", "server/main.ts"]
