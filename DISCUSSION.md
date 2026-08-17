# Discussion: Pino, Zod, Dockerization, and Observability

This document works through four items from the [roadmap](./README.md#roadmap) in more
depth than a bullet point allows: why each is being considered, how it would concretely
land in this codebase as it exists today, the trade-offs, and a suggested order to tackle
them in.

## Structured logging with Pino

Right now StickerBot logs entirely through raw `console.log` / `console.warn` /
`console.error` — roughly 40 call sites spread across `src/app.ts`,
`src/queues/connection.ts`, `src/queues/producer.ts`, `src/services/sender.ts`,
`src/services/mediaDownloader.ts`, and the three worker files under `src/workers/`. That's
fine for a single process running on one host, but it breaks down as soon as you're
running multiple bot workers: there's no consistent shape to parse, no severity levels to
filter on, and no way to tell which message, queue, or bot a given log line came from
without reading the surrounding code.

Pino addresses this cheaply — it's a fast, low-overhead JSON logger. The natural fit here:

- A single configured logger instance (`pino-pretty` transport in development, raw JSON
  in production) replacing the direct `console.*` calls.
- `pino.child()` loggers scoped to a unit of work — e.g. a child logger per incoming
  webhook request, or per consumed message in the workers — so every log line from
  processing one sticker job carries the same identifying fields automatically. This is
  exactly what "prepare for correlation IDs" means in practice: attach a `messageId` or
  job ID once when the child logger is created, and every downstream log call inherits it
  for free.
- The RabbitMQ connection code in `src/queues/connection.ts` is a good first target — its
  `console.log("RabbitMQ connection established")`, `console.warn("Connection Closed")`,
  and `console.error("Error on the connection: " + err)` calls are exactly the kind of
  operational signal that's much more useful as structured, filterable JSON once there's
  more than one process to watch.

This is a small, self-contained change (add the dependency, create a logger module, swap
call sites) with no infrastructure required — it doesn't need Docker or a log aggregator
to already be useful, since even pretty-printed local logs benefit from consistent
severity levels and context.

## Config validation with Zod

`src/config.ts` currently validates environment variables with a small hand-rolled
`verifyKey()` helper that just throws if a value is missing or empty. It works, but has
real gaps: there's no type coercion (everything is a string, even if a future config value
should be a number or boolean), no single declarative source of truth for what's required,
and — concretely, right now — `.env.example` doesn't even list `RABBIT_CONNECTION_URI`,
even though `config.ts` requires it. That kind of drift between "what's documented" and
"what's actually required" is exactly the class of bug a schema catches automatically:
a `z.object({...})` schema parsed once at startup fails fast with a clear, complete list of
what's wrong, rather than one variable at a time via ad hoc checks.

Concretely, this would mean defining a `configSchema` with Zod, parsing
`process.env` through it once, and exporting the parsed, typed result in place of today's
`config` object. It's a small, mechanical change to `config.ts` — low risk, and it pairs
naturally with the general "clean up helpers" item on the roadmap, since consolidating
config handling is part of the same cleanup.

## Dockerizing StickerBot

There's no `Dockerfile` anywhere in the repo yet, and `docker-compose.yml` only defines the
WhatsApp-side infrastructure — `evolution-api`, `postgres`, `redis`, `rabbitmq`. StickerBot
itself currently runs on the host, which is why `evolution-api` needs the
`extra_hosts: host.docker.internal:host-gateway` entry just to reach it. Finishing this
means writing a `Dockerfile` and adding StickerBot as a proper service in the compose file,
which removes that workaround.

But the more interesting question — and the one worth thinking through before writing that
Dockerfile — is what happens *after* StickerBot, once Bot A, Bot B, and so on start getting
added. The goal stated in the roadmap is for adding a new bot to be simple, while the bots
still feel like one cohesive system rather than independently-drifting projects that
happen to share a WhatsApp connection.

**The core tension:** each bot worker needs to be independently deployable — its own
process, its own queue consumer, its own release cadence — but they all need the same
underlying behavior: the same logging setup (Pino), the same config-validation pattern
(Zod), the same RabbitMQ connection/shutdown handling. If every new bot reinvents these
from scratch, you get subtly different reconnect logic, different log shapes, different
shutdown behavior per bot — which is exactly the kind of fragmentation that makes
cross-bot observability (see below) painful later.

A few strategies to reconcile that tension, roughly in order of how much they commit to
upfront:

- **Shared runtime module, copied structure.** The simplest option: keep each bot as its
  own repo/deploy unit, but treat `src/queues/connection.ts`, the future logger module, and
  the future Zod config helpers as a template to copy into each new bot. Low commitment,
  but it's exactly the copy-and-drift pattern the roadmap is trying to avoid — worth
  naming as the baseline to improve on, not the destination.
- **Shared base Docker image.** Bake the common runtime pieces (logger setup, config
  schema helpers, the RabbitMQ connection/shutdown module) into a `stickerbot-base` image
  that each bot's Dockerfile builds `FROM`. A new bot's Dockerfile becomes "base image +
  its own handler code," and a fix to reconnect logic or logging format in the base image
  benefits every bot on the next rebuild. This is a natural home for whatever comes out of
  the "clean up helpers" roadmap item — those extracted helpers are effectively the
  contents of that base image.
- **Shared internal package (monorepo).** Once the Turborepo monorepo mentioned in the
  roadmap exists, the shared runtime pieces become an actual internal package
  (`@stickerbot/core` or similar) that each bot's `package.json` depends on, versioned and
  built like any other workspace package. This is the more maintainable long-term answer —
  a real dependency graph instead of a shared Docker layer — but it depends on the monorepo
  migration happening first.

None of these are mutually exclusive with getting StickerBot itself into Docker now — that
work (a single `Dockerfile`, one new service block in `docker-compose.yml`, on the existing
`evolution-net` network) is worth doing on its own regardless of which future path is
chosen. The recommendation is to treat it as staged: ship StickerBot's own `Dockerfile`
first without over-engineering for bots that don't exist yet, but keep the code being
extracted for the "clean up helpers" item organized so it can become a shared base image
(or package) without a rewrite once a second bot actually shows up. On the orchestration
side, the target shape is one compose network with each bot as its own service, all
pointing at the same RabbitMQ instance but consuming distinct queues — so that "add a bot"
concretely means "add a service block and a queue," not "stand up new infrastructure."

## Observability stack (Loki + Grafana + Prometheus)

This is listed as a later step deliberately, and it's worth being explicit about why: it's
a genuinely bigger lift than the previous three items, and it pays off much more once
there's more than one process to actually watch.

- **Loki** aggregates logs. It's a natural pairing with Pino specifically because Loki
  works best on structured, labeled log lines — feeding it today's unstructured
  `console.log` output would mean far less useful queries than feeding it Pino's JSON.
  In other words, Loki is much more valuable *after* the logging work is done, not before.
- **Prometheus** collects metrics — things like RabbitMQ queue depth, consumer lag,
  sticker conversion time, or reconnect counts. Most of these become meaningful once
  there's more than one worker whose relative health you'd want to compare.
- **Grafana** provides dashboards over both, which is where the value of the previous two
  actually becomes visible day-to-day.

Setting this up also gets meaningfully easier once StickerBot and its future siblings are
containerized — adding Promtail (or another log shipper) and metrics exporters is far more
natural when everything is already a service in `docker-compose.yml` than when part of the
system runs on the host.

## Suggested sequencing

1. **Zod and Pino first.** Both are cheap, self-contained, dependency-free of any
   infrastructure, and immediately useful even for a single-process StickerBot today.
2. **Dockerize StickerBot next**, with the shared-base-image question kept in mind but not
   over-built before a second bot exists.
3. **Observability last**, once there's a second (or third) bot running and the
   Pino + Docker groundwork makes Loki/Prometheus/Grafana actually pay for the setup
   effort instead of monitoring a single process in isolation.
