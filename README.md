# StickerBot

StickerBot is a WhatsApp bot that turns images and videos into stickers. It listens for
media sent in configured WhatsApp chats, converts it, and sends the resulting sticker
back — quoting the original message — without any manual steps from the user.

It talks to WhatsApp directly through [Baileys](https://github.com/WhiskeySockets/Baileys).
Incoming messages are handed to background workers over **RabbitMQ**, so the WhatsApp
connection is never blocked by sticker conversion.

StickerBot is also the first of what's meant to become a small platform of bots: a single
shared WhatsApp connection sitting in front of several independent bot workers, all
coordinating through RabbitMQ. See [Architecture](#architecture).

> **Note**: StickerBot previously ran behind Evolution API, which owned the WhatsApp
> connection. That dependency has been removed entirely.

## Current Features

- Connects to WhatsApp directly via Baileys, paired headlessly with a pairing code.
- Converts images and videos into stickers using `wa-sticker-formatter`, sending them back
  quoting the original message.
- Supports basic text commands (`.marco`, `.ajuda`) and sticker shape options
  (`.circulo`, `.quadrado`, `.arredondado`, `.esticado`, `.original`).
- Processes sticker creation and commands asynchronously through RabbitMQ.
- Only publishes messages from chats in a configured allowlist; everything else is dropped.
- Skips oversized media without downloading it.
- Structured logging (Pino) and schema-validated configuration (Zod).
- Reconnects automatically with backoff, and refuses to run two sockets against one
  set of credentials.

## Architecture

One process today, split along the boundary it will eventually be divided on:

```
src/
  contracts/   envelope types crossing the queue. Imports nothing else.
  shared/      logger, lifecycle, RabbitMQ connection and producers
  gateway/     the ONLY place `baileys` is imported
  bots/
    sticker/   imports contracts + shared only
```

```
             ┌─────────── gateway ───────────┐
WhatsApp ───►│ inbound  ──► sticker_jobs ────┼──► sticker bot
             │                command_jobs ──┼──► command handler
WhatsApp ◄───│ outbound ◄── send_jobs ◄──────┼──┘
             └───────────────────────────────┘
```

The gateway owns the socket at both ends; the bot never touches Baileys. Because they
already communicate only over RabbitMQ, splitting them into separate containers is a
deployment change rather than a rewrite. That split, and per-chat inbound queues so a bot
can subscribe to the chats it cares about, are tracked as phase 2.

## Setup

Requires Node 24+ and ffmpeg (for animated stickers) if running on the host.

1. Copy `.env.example` to `.env` and fill it in. `WA_PAIRING_NUMBER` must be E.164 digits
   only — no `+`, spaces or punctuation — and `PUBLISHED_GROUPS` is a comma-separated list
   of chat JIDs the bot may respond in. **Use a secondary number, not a primary one.**
2. Start RabbitMQ: `docker compose up -d rabbitmq`
3. `npm install`
4. `npm run dev`

### Pairing

Pairing is headless — no QR code. On first start the bot prints an **8-character** code:

```
    Pairing code: P9T5BHCY
```

On the phone: **WhatsApp → Linked devices → Link a device → "Link with phone number
instead"**, then enter the code.

A `515 restart required` disconnect immediately after linking is normal and handled
automatically. Credentials are then stored in `WA_AUTH_DIR` and reused on every
subsequent start — restarting must *not* ask to pair again.

If pairing state is ever corrupted, delete `WA_AUTH_DIR` **entirely** and start over;
deleting it partially produces confusing decryption failures rather than a clean re-pair.

### Auth state

`WA_AUTH_DIR` is rewritten constantly (Signal keys rotate on send *and* receive) and a
torn write costs a re-pair. It must live on local disk, outside the repo. In Docker it is
the named volume `stickerbot_wa_auth`. The bot refuses to start if it is pointed at the
project directory or a network mount, and takes a lock so two processes cannot share one
auth directory.

## Running in Docker

```
docker compose up -d --build
```

The container starts with an empty auth volume, so it pairs on first run — watch
`docker compose logs -f bot` for the code. **Do not run the bot on the host and in Docker
at the same time**: they would be two sockets on one WhatsApp account, which causes a
`connection replaced` disconnect and can force a re-pair.

## Roadmap

1. **Split the gateway and bots into separate containers**, with per-chat inbound queues
   over a topic exchange so each bot subscribes to the chats it wants.
2. **Reply to oversized media** instead of only skipping it.
3. **Dead-letter queues** — a message that can never be processed is currently logged and
   dropped.
4. **Video pre-processing (ffmpeg)** — trim/resize/compress before the sticker library,
   replacing the current quality workaround.
5. **Ranking command** — track who creates the most stickers.
6. **Observability** — Loki + Grafana + Prometheus, once more than one service is running.

`todolist.md` (local, not tracked) holds the full backlog, the phasing, and the design
rules the code is expected to follow.
