# syntax=docker/dockerfile:1

# ── build ────────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS build
WORKDIR /app

# baileys depends on libsignal through an unpinned git URL, so npm needs git at
# install time. The slim images do not ship it, and without it `npm ci` fails
# with a confusing resolution error. (npm falls back to HTTPS for this public
# repo, so no SSH keys or deploy keys are needed.)
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# postinstall patches wa-sticker-formatter inside node_modules, so it has to run
# in the stage that owns them.
COPY scripts ./scripts
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop devDependencies from the tree that gets copied into the runtime image.
# prune does not re-run postinstall, so the wa-sticker-formatter patch survives.
RUN npm prune --omit=dev

# ── runtime ──────────────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
WORKDIR /app

# wa-sticker-formatter shells out to ffmpeg for animated stickers.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Auth state lives on a named volume, never in the image or a bind mount.
RUN mkdir -p /data/auth && chown -R node:node /data
USER node

# Exec form, and node directly rather than `npm start`: npm would sit between
# docker and the process and SIGTERM would not reach our shutdown hooks.
CMD ["node", "dist/main.js"]
