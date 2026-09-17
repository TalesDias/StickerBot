/**
 * Message envelopes exchanged over RabbitMQ.
 *
 * This module must NOT import from `baileys`, `../gateway/**` or `../bots/**`.
 * Anything needed from a Baileys type is re-declared here by hand. That rule is
 * what keeps the bots independent of the WhatsApp client library, and it is
 * currently a convention rather than something CI enforces (see todolist.md).
 *
 * Versioned from the start: phase 2 publishes these through an exchange named
 * `wa.events.v1`, and a producer we cannot redeploy in lockstep will eventually
 * be on the other end.
 */
export const ENVELOPE_VERSION = 1;
export type EnvelopeVersion = typeof ENVELOPE_VERSION;

/**
 * Everything needed to address a reply and render its quote bubble.
 *
 * Evolution API could quote a message given only its id, because the server held
 * the message. Baileys cannot: `sendMessage(jid, ..., { quoted })` needs the
 * message *content* to render the quoted preview. `quoteStub` carries that
 * content — the original message node with thumbnail bytes stripped out.
 */
export interface MessageRef {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  /**
   * Group sender. May be an `@lid` rather than a phone JID on newer WhatsApp
   * accounts. Pass this back to the socket exactly as received: normalizing it
   * breaks quoting.
   */
  participant?: string;
  /** Trimmed message node used to render the quote preview. */
  quoteStub?: Record<string, unknown>;
}

export type InboundKind = 'text' | 'image' | 'video' | 'audio' | 'other';

export type InboundMedia =
  | { kind: 'inline'; mimetype: string; bytes: number; base64: string }
  | {
      kind: 'rejected';
      mimetype: string;
      bytes: number;
      reason: 'too_large' | 'download_failed';
    };

export interface InboundEnvelope {
  v: EnvelopeVersion;
  /** WhatsApp account this came from. One account for now; named for phase 2. */
  account: string;
  ref: MessageRef;
  chatJid: string;
  senderJid: string;
  pushName?: string;
  kind: InboundKind;
  /** conversation / extendedTextMessage.text / media caption. */
  text?: string;
  media?: InboundMedia;
  timestamp: string;
}

export type OutboundPayload =
  | { type: 'text'; text: string }
  | { type: 'sticker'; base64: string };

export interface OutboundEnvelope {
  v: EnvelopeVersion;
  account: string;
  chatJid: string;
  /** Round-tripped verbatim from the inbound envelope to quote the original. */
  replyTo?: MessageRef;
  payload: OutboundPayload;
  /**
   * Stable per logical send. Defined now, before anything relies on it, because
   * adding a field to a contract already flowing through durable queues is far
   * more expensive than defining it up front. Unused in phase 1.
   */
  idempotencyKey: string;
  /** Inbound `ref.id`, so one job's log lines share an id end to end. */
  correlationId: string;
  timestamp: string;
}
