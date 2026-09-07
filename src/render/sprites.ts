/**
 * Offscreen sprite cache.
 *
 * Canvas `shadowBlur` is by far the most expensive 2D operation: every glowing
 * stroke or fill runs a Gaussian blur pass. Baking each glowing shape once into
 * a small offscreen canvas and stamping it with `drawImage` turns hundreds of
 * blur passes per frame into cheap texture copies.
 */
const spriteCache = new Map<string, HTMLCanvasElement>();

export type SpritePainter = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => void;

export function getSprite(key: string, size: number, paint: SpritePainter): HTMLCanvasElement {
  const cached = spriteCache.get(key);
  if (cached) {
    return cached;
  }

  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for sprite cache');
  }

  paint(ctx, size / 2, size / 2);
  spriteCache.set(key, sprite);
  return sprite;
}

/** Stamp a cached sprite centered on (x, y). */
export function drawSprite(ctx: CanvasRenderingContext2D, sprite: HTMLCanvasElement, x: number, y: number): void {
  ctx.drawImage(sprite, x - sprite.width / 2, y - sprite.height / 2);
}
