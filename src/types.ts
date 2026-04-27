export interface StickerJob {
  messageId: string;
  from: string;               
  quotedMessageId: string;
  base64?: string; //If empty, the message type is a video 
  caption?: string;
  timestamp: string;
}

export interface CommandJob {
  messageId: string;
  from: string;
  quotedMessageId: string;
  command: string;
  timestamp: string;
}

export interface WebhookPayload {
  event?: string;
  instance?: string;
  data: {
    key: {
      id?: string;
      remoteJid: string;
      fromMe?: boolean;
    };
    messageType?: string;
    message?: {
      conversation?: string;
      base64?: string;
      imageMessage?: any;
      videoMessage?: any;
    };
  };
}