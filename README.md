# StickerBot

StickerBot is a WhatsApp bot that turns images and videos into stickers. It listens for
media sent in a designated WhatsApp group, converts it, and sends the resulting sticker
back — quoting the original message — without any manual steps from the user.

It doesn't talk to WhatsApp directly. Instead, it sits behind **Evolution API**, which
handles the actual WhatsApp connection and delivers incoming messages to StickerBot as
webhooks. Processing is done asynchronously through **RabbitMQ**, so the webhook endpoint
can respond quickly while the actual sticker conversion happens in background workers.

StickerBot is also the first of what's meant to become a small platform of bots. The plan
is for a single shared WhatsApp connection (via Evolution API) to sit in front of several
independent bot workers, all coordinating through RabbitMQ — see
[Architecture](#architecture) and [`DISCUSSION.md`](./DISCUSSION.md) for how that's meant
to work in practice.

## Current Features

- Listens to Evolution API webhooks (`messages-upsert`) and only processes messages from
  a configured group (`STICKER_GROUP`).
- Converts incoming images and videos into stickers using `wa-sticker-formatter`, and
  sends them back quoting the original message.
- Supports basic text commands (e.g. `.marco`).
- Processes sticker creation and commands asynchronously through RabbitMQ queues.
- Has basic graceful shutdown and reconnection handling for its RabbitMQ connection.
- Returns 200 (instead of 403) to Evolution on oversized files so Evolution stops
  retrying, while a proper user-facing reply for that case is still on the roadmap.

## Architecture

Today, StickerBot is a single Node.js/TypeScript application:

- `src/app.ts` — the webhook endpoint that receives events from Evolution API.
- `src/services/` — media download, sticker formatting, and sending back to WhatsApp.
- `src/workers/` — RabbitMQ consumers for sticker creation, commands, and sending.
- `src/queues/` — the RabbitMQ connection, channels, and producers shared by the app.

Where this is headed is a split into a shared WhatsApp-facing service plus multiple
independent worker bots, all talking over RabbitMQ:

```
WhatsApp Service (webhook + sender only)
        ↕ RabbitMQ
StickerBot Worker
Bot A Worker
Bot B Worker
...
```

The long-term preference is to host all of this in a single monorepo (Turborepo). See
[`DISCUSSION.md`](./DISCUSSION.md) for a deeper look at how Dockerization and shared
tooling are meant to keep that multi-bot setup cohesive instead of turning into copies of
the same code drifting apart.

## Roadmap

1. **RabbitMQ reconnection** — Make the connection recover automatically when it drops.
   Right now `src/queues/connection.ts` only re-establishes the connection lazily, on the
   next call that needs it; there's no active reconnect/backoff loop yet.

2. **Large file handling** — Detect oversized media and reply to the user instead of
   just swallowing the error. Evolution currently gets a 200 so it stops retrying, but the
   sender never hears back.

3. **Better logging (Pino)** — Replace the current raw `console.log`/`console.error` calls
   scattered across the app with structured logging, and lay the groundwork for
   correlation IDs across a request's lifecycle. See [`DISCUSSION.md`](./DISCUSSION.md).

4. **Video pre-processing (ffmpeg)** — Properly trim/resize/compress videos before handing
   them to the sticker library, replacing the current `quality=5` workaround that was used
   to fix video size explosion.

5. **Clean up helpers + Zod config validation** — Replace the manual key-checking in
   `src/config.ts` with schema-based validation, and consolidate shared helpers. See
   [`DISCUSSION.md`](./DISCUSSION.md).

6. **Ranking command** — Track who creates the most stickers.

7. **Dockerize StickerBot** — Finish containerizing StickerBot itself (there's currently
   no `Dockerfile`) and fold it into `docker-compose.yml` alongside Evolution API,
   PostgreSQL, Redis, and RabbitMQ. See [`DISCUSSION.md`](./DISCUSSION.md) for how this
   ties into supporting future bots cleanly.

8. **Later: observability and full microservices split** — Loki + Grafana + Prometheus for
   logs/metrics/dashboards, once there's more than one service worth watching. See
   [`DISCUSSION.md`](./DISCUSSION.md).

## Setup

Installation and setup instructions will be added after the first release. In the
meantime, StickerBot expects Evolution API, PostgreSQL, Redis, and RabbitMQ to be running
(see `docker-compose.yml`) and a configured `.env` (see `.env.example`).
