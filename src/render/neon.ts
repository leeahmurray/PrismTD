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
