/**
 * Caption -> sticker shape. Moved out of the old stickerConsumer unchanged.
 */
export function getStickerType(caption?: string): string {
  if (!caption?.startsWith('.')) return 'crop';

  switch (caption.toLowerCase()) {
    case '.circulo':
      return 'circle';
    case '.quadrado':
      return 'crop';
    case '.arredondado':
      return 'rounded';
    case '.esticado':
      return 'default';
    case '.original':
      return 'full';
    default:
      return 'crop';
  }
}

export const HELP_MESSAGE = `*Commandos Gerais*
.ajuda
.marco

*Comandos para Imagens:*
.circulo
.quadrado (padrão)
.arredondado 
.esticado
.original`;
