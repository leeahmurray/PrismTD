export function glowStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  alpha = 1,
  glow = 14,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function glowFill(
  ctx: CanvasRenderingContext2D,
  color: string,
  alpha = 1,
  glow = 16,
): void {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

export function line(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
}

/**
 * Two-pass fake glow for dynamic strokes (beams, links) that cannot be cached
 * as sprites: a wide translucent halo under a crisp core. No shadowBlur.
 */
export function softGlowStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  alpha = 1,
  glow = 10,
): void {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.globalAlpha = alpha * 0.28;
  ctx.lineWidth = width + glow * 0.7;
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}
