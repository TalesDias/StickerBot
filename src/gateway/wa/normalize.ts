import { getContentType, jidNormalizedUser, type WAMessage } from 'baileys';
import type {
  InboundEnvelope,
  InboundKind,
  InboundMedia,
  MessageRef,
} from '../../contracts/envelopes.js';
import { ENVELOPE_VERSION } from '../../contracts/envelopes.js';
import { gatewayConfig } from '../config.js';

/**
 * The single place WhatsApp identifiers are interpreted. Nothing downstream
 * should parse a JID.
 *
 * Note the asymmetry: identity fields are normalized so logging and (in phase 2)
 * routing see one stable form, but `MessageRef` keeps the raw key untouched.
 * WhatsApp is mid-migration to LID addressing and `key.participant` may be an
 * `@lid`; rewriting it breaks quoting, because the socket matches on the exact
 * key it handed us.
 */
export function normalizeIdentity(jid: string | null | undefined): string {
  if (!jid) return '';
  try {
    return jidNormalizedUser(jid);
  } catch {
    return jid;
  }
}

export function classify(msg: WAMessage): InboundKind {
  switch (getContentType(msg.message ?? undefined)) {
    case 'imageMessage':
      return 'image';
    case 'videoMessage':
      return 'video';
    case 'audioMessage':
      return 'audio';
    case 'conversation':
    case 'extendedTextMessage':
      return 'text';
    default:
      return 'other';
  }
}

/** Text body or media caption, whichever this message carries. */
export function extractText(msg: WAMessage): string | undefined {
  const m = msg.message;
  return (
    m?.conversation ??
    m?.extendedTextMessage?.text ??
    m?.imageMessage?.caption ??
    m?.videoMessage?.caption ??
    undefined
  );
}

const THUMBNAIL_KEY = /thumbnail/i;

/**
 * Strips binary thumbnails out of a message node.
 *
 * Quoting needs the message *content*, not just its key, but the raw node
 * carries `jpegThumbnail` as a byte array. Left in, JSON.stringify expands it to
 * `{"type":"Buffer","data":[...]}` and a few hundred bytes of envelope becomes
 * tens of kilobytes on every job.
 */
function stripThumbnails(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) return undefined;
  if (Array.isArray(value)) return value.map(stripThumbnails);

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (THUMBNAIL_KEY.test(key)) continue;
      const cleaned = stripThumbnails(val);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  // protobufjs Longs serialize as objects; leave primitives alone.
  return value;
}

export function buildMessageRef(msg: WAMessage): MessageRef {
  return {
    id: msg.key.id!,
    remoteJid: msg.key.remoteJid!,
    fromMe: Boolean(msg.key.fromMe),
    // Raw, deliberately — see normalizeIdentity above.
    ...(msg.key.participant ? { participant: msg.key.participant } : {}),
    ...(msg.message
      ? { quoteStub: stripThumbnails(msg.message) as Record<string, unknown> }
      : {}),
  };
}

export function toInboundEnvelope(
  msg: WAMessage,
  kind: InboundKind,
  media?: InboundMedia,
): InboundEnvelope {
  const chatJid = msg.key.remoteJid!;

  return {
    v: ENVELOPE_VERSION,
    account: gatewayConfig.WA_ACCOUNT,
    ref: buildMessageRef(msg),
    chatJid,
    senderJid: normalizeIdentity(msg.key.participant ?? chatJid),
    ...(msg.pushName ? { pushName: msg.pushName } : {}),
    kind,
    ...(extractText(msg) ? { text: extractText(msg) } : {}),
    ...(media ? { media } : {}),
    timestamp: new Date().toISOString(),
  };
}
