import { BALANCE, type EnemyKind, type TowerKind } from '../balance';
import { createPath, pointAtDistance, type PathData } from '../game/path';
import type { GameSnapshot } from '../game/types';
import { glowFill, glowStroke } from './neon';

const COLORS = {
  bg: '#05060A',
  grid: '#1C2C44',
  path: '#2AA9FF',
  pathInner: '#00E5FF',
  gateStart: '#53FF57',
  gateEnd: '#FF4D5A',
  pulse: '#00E5FF',
  nova: '#FF7A00',
  frost: '#9A6BFF',
  chain: '#5FE6FF',
  laser: '#FF4DFF',
  decay: '#7CFF5B',
  relay: '#89FFB5',
  amp: '#FF5D8A',
  bank: '#FFD95E',
  enemyRunner: '#00F0FF',
  enemyTank: '#FF2F92',
  enemySwarm: '#FFD400',
  enemyBlossom: '#9A6BFF',
  enemyPetal: '#C08BFF',
  enemyBoss: '#FF7A00',
  hp: '#32FF87',
  hpBg: '#2A2A2A',
  warning: '#FF4D5A',
  selected: '#FFE600',
  rangePreview: '#00E5FF',
  tile: '#0B0F1A',
} as const;

function useMobileRenderMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(max-width: 960px), (pointer: coarse)').matches;
}

const routePathCache = new WeakMap<ReadonlyArray<{ x: number; y: number }>, PathData>();
const pathCellSetCache = new WeakMap<ReadonlyArray<string>, Set<string>>();

let staticBoardCache:
  | {
      pathCells: ReadonlyArray<string>;
      width: number;
      height: number;
      mobile: boolean;
      canvas: HTMLCanvasElement;
    }
  | null = null;

function getCachedRoutePath(points: ReadonlyArray<{ x: number; y: number }>): PathData {
  const cached = routePathCache.get(points);
  if (cached) {
    return cached;
  }

  const next = createPath(points);
  routePathCache.set(points, next);
  return next;
}

function getCachedPathCellSet(pathCells: ReadonlyArray<string>): Set<string> {
  const cached = pathCellSetCache.get(pathCells);
  if (cached) {
    return cached;
  }

  const next = new Set(pathCells);
  pathCellSetCache.set(pathCells, next);
  return next;
}

function towerColor(kind: TowerKind): string {
  if (kind === 'pulse') return COLORS.pulse;
  if (kind === 'nova') return COLORS.nova;
  if (kind === 'chain') return COLORS.chain;
  if (kind === 'laser') return COLORS.laser;
  if (kind === 'decay') return COLORS.decay;
  if (kind === 'relay') return COLORS.relay;
  if (kind === 'amp') return COLORS.amp;
  if (kind === 'bank') return COLORS.bank;
  return COLORS.frost;
}

function enemyColor(kind: EnemyKind): string {
  if (kind === 'runner') return COLORS.enemyRunner;
  if (kind === 'tank') return COLORS.enemyTank;
  if (kind === 'blossom') return COLORS.enemyBlossom;
  if (kind === 'petal') return COLORS.enemyPetal;
  if (kind === 'boss') return COLORS.enemyBoss;
  return COLORS.enemySwarm;
}

function getTowerRange(kind: TowerKind, level: number, rangeBoostActive: boolean): number {
  const base = BALANCE.towers.stats[kind].range;
  const levelMul = BALANCE.towers.rangeMultiplierByLevel[level - 1];
  const boostMul = rangeBoostActive ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1;
  return base * levelMul * boostMul;
}

function drawBoard(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, path: ReadonlySet<string>): void {
  const half = snapshot.gridSize / 2;
  const mobileRenderMode = useMobileRenderMode();

  for (let row = 1; row < snapshot.rows; row += 1) {
    for (let col = 1; col < snapshot.cols; col += 1) {
      const key = `${col},${row}`;
      const x = col * snapshot.gridSize;
      const y = row * snapshot.gridSize;

      if (path.has(key)) {
        continue;
      }

      const checker = (col + row) % 2 === 0 ? 0.88 : 0.72;
      ctx.beginPath();
      ctx.rect(x - half + 1, y - half + 1, snapshot.gridSize - 2, snapshot.gridSize - 2);
      glowFill(ctx, COLORS.tile, checker, 0);

      ctx.beginPath();
      ctx.rect(x - half + 1, y - half + 1, snapshot.gridSize - 2, snapshot.gridSize - 2);
      glowStroke(ctx, COLORS.grid, 1, 0.6, 0);

      if (mobileRenderMode) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(x - half + 4, y + half - 5);
      ctx.lineTo(x + half - 5, y - half + 4);
      glowStroke(ctx, COLORS.grid, 0.8, 0.25, 0);
    }
  }
}

function drawPathEdges(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, path: ReadonlySet<string>): void {
  const half = snapshot.gridSize / 2;
  const mobileRenderMode = useMobileRenderMode();
  const hasPathCell = (col: number, row: number): boolean => path.has(`${col},${row}`);

  for (let row = 1; row < snapshot.rows; row += 1) {
    for (let col = 1; col < snapshot.cols; col += 1) {
      if (!hasPathCell(col, row)) {
        continue;
      }

      const x = col * snapshot.gridSize;
      const y = row * snapshot.gridSize;
      const left = !hasPathCell(col - 1, row);
      const right = !hasPathCell(col + 1, row);
      const top = !hasPathCell(col, row - 1);
      const bottom = !hasPathCell(col, row + 1);

      if (left) {
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y - half + 1);
        ctx.lineTo(x - half + 1, y + half - 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, mobileRenderMode ? 2 : 6);
        if (!mobileRenderMode) {
          ctx.beginPath();
          ctx.moveTo(x - half + 1, y - half + 1);
          ctx.lineTo(x - half + 1, y + half - 1);
          glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
        }
      }

      if (right) {
        ctx.beginPath();
        ctx.moveTo(x + half - 1, y - half + 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, mobileRenderMode ? 2 : 6);
        if (!mobileRenderMode) {
          ctx.beginPath();
          ctx.moveTo(x + half - 1, y - half + 1);
          ctx.lineTo(x + half - 1, y + half - 1);
          glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
        }
      }

      if (top) {
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y - half + 1);
        ctx.lineTo(x + half - 1, y - half + 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, mobileRenderMode ? 2 : 6);
        if (!mobileRenderMode) {
          ctx.beginPath();
          ctx.moveTo(x - half + 1, y - half + 1);
          ctx.lineTo(x + half - 1, y - half + 1);
          glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
        }
      }

      if (bottom) {
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y + half - 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, mobileRenderMode ? 2 : 6);
        if (!mobileRenderMode) {
          ctx.beginPath();
          ctx.moveTo(x - half + 1, y + half - 1);
          ctx.lineTo(x + half - 1, y + half - 1);
          glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
        }
      }
    }
  }
}

function getStaticBoardCanvas(snapshot: GameSnapshot, mobileRenderMode: boolean): HTMLCanvasElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (
    staticBoardCache &&
    staticBoardCache.pathCells === snapshot.pathCells &&
    staticBoardCache.width === snapshot.width &&
    staticBoardCache.height === snapshot.height &&
    staticBoardCache.mobile === mobileRenderMode
  ) {
    return staticBoardCache.canvas;
  }

  const canvas = document.createElement('canvas');
  canvas.width = snapshot.width;
  canvas.height = snapshot.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const pathCellSet = getCachedPathCellSet(snapshot.pathCells);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  drawBoard(ctx, snapshot, pathCellSet);
  drawPathEdges(ctx, snapshot, pathCellSet);

  staticBoardCache = {
    pathCells: snapshot.pathCells,
    width: snapshot.width,
    height: snapshot.height,
    mobile: mobileRenderMode,
    canvas,
  };

  return canvas;
}

function drawEntryExitMarkers(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, time: number): void {
  const half = snapshot.gridSize / 2;
  const mobileRenderMode = useMobileRenderMode();

  const drawGate = (a: { x: number; y: number }, b: { x: number; y: number }, color: string): void => {
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    const cycleMs = 5000;
    const phase = (time % cycleMs) / cycleMs;
    const eased = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const pulse = mobileRenderMode ? 0.72 : 0.52 + eased * 0.42;
    ctx.beginPath();
    if (horizontal) {
      const edgeX = b.x > a.x ? a.x - half + 2 : a.x + half - 2;
      ctx.moveTo(edgeX, a.y - half + 3);
      ctx.lineTo(edgeX, a.y + half - 3);
    } else {
      const edgeY = b.y > a.y ? a.y - half + 2 : a.y + half - 2;
      ctx.moveTo(a.x - half + 3, edgeY);
      ctx.lineTo(a.x + half - 3, edgeY);
    }
    glowStroke(ctx, color, 2.8, pulse, mobileRenderMode ? 8 : 22);
  };

  for (const route of snapshot.routes) {
    if (route.points.length < 2) {
      continue;
    }

    const start = route.points[0];
    const startNext = route.points[1];
    const end = route.points[route.points.length - 1];
    const endPrev = route.points[route.points.length - 2];

    drawGate(start, startNext, COLORS.gateStart);
    drawGate(end, endPrev, COLORS.gateEnd);
  }
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: EnemyKind,
  x: number,
  y: number,
  hp: number,
  maxHp: number,
  hitFlash: number,
): void {
  const color = enemyColor(kind);

  ctx.save();
  if (kind === 'runner') {
    ctx.beginPath();
    ctx.rect(x - 6, y - 6, 12, 12);
    glowStroke(ctx, color, 2, 1, 10);
  } else if (kind === 'tank') {
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x + 10, y);
    ctx.lineTo(x, y + 10);
    ctx.closePath();
    glowStroke(ctx, color, 2.4, 1, 10);
  } else if (kind === 'blossom') {
    for (let i = 0; i < 5; i += 1) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const px = x + Math.cos(angle) * 6;
      const py = y + Math.sin(angle) * 6;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      glowStroke(ctx, color, 1.7, 1, 8);
    }
    ctx.beginPath();
    ctx.arc(x, y, 3.8, 0, Math.PI * 2);
    glowStroke(ctx, color, 1.8, 0.95, 8);
  } else if (kind === 'petal') {
    ctx.beginPath();
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x + 4, y + 1);
    ctx.lineTo(x, y + 6);
    ctx.lineTo(x - 4, y + 1);
    ctx.closePath();
    glowStroke(ctx, color, 1.7, 0.95, 8);
  } else if (kind === 'boss') {
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 8);
    ctx.lineTo(x, y - 14);
    ctx.lineTo(x + 12, y - 8);
    ctx.lineTo(x + 14, y + 6);
    ctx.lineTo(x, y + 14);
    ctx.lineTo(x - 14, y + 6);
    ctx.closePath();
    glowStroke(ctx, color, 2.8, 1, 14);

    ctx.beginPath();
    ctx.moveTo(x - 7, y + 2);
    ctx.lineTo(x - 1, y - 6);
    ctx.lineTo(x + 4, y - 1);
    ctx.lineTo(x + 1, y + 7);
    ctx.lineTo(x + 8, y + 1);
    glowStroke(ctx, '#FFD7A8', 1.8, 0.85, 10);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    glowStroke(ctx, color, 2, 1, 10);
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    glowStroke(ctx, color, 1.4, 0.9, 7);
  }

  const flashRadius = kind === 'boss' ? 22 : 14;
  if (hitFlash > 0) {
    ctx.beginPath();
    ctx.arc(x, y, flashRadius, 0, Math.PI * 2);
    glowFill(ctx, '#ffffff', 0.16 * hitFlash, 16);
  }

  const hpRatio = Math.max(0, hp / maxHp);
  const hpBarWidth = kind === 'boss' ? 32 : 20;
  const hpBarX = x - hpBarWidth / 2;
  const hpBarY = y - (kind === 'boss' ? 22 : 14);
  ctx.beginPath();
  ctx.rect(hpBarX, hpBarY, hpBarWidth, 4);
  glowStroke(ctx, COLORS.hpBg, 1.5, 1, 0);
  ctx.beginPath();
  ctx.rect(hpBarX, hpBarY, hpBarWidth * hpRatio, 4);
  glowStroke(ctx, COLORS.hp, 1.5, 0.9, 6);

  if (kind === 'boss') {
    ctx.textAlign = 'center';
    ctx.font = '700 10px Rajdhani, sans-serif';
    ctx.fillStyle = '#ffe3bf';
    ctx.fillText('BOSS', x, y - 28);
  }
  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  kind: TowerKind,
  x: number,
  y: number,
  selected: boolean,
): void {
  const color = towerColor(kind);

  ctx.save();
  if (kind === 'pulse') {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    glowStroke(ctx, color, 2, 1, 10);
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + 10, y);
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x, y + 10);
    glowStroke(ctx, color, 1.5, 0.85, 8);
  } else if (kind === 'nova') {
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 8);
    ctx.lineTo(x + 10, y - 8);
    ctx.lineTo(x + 10, y + 8);
    ctx.lineTo(x - 10, y + 8);
    ctx.closePath();
    glowStroke(ctx, color, 2, 1, 10);
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x + 12, y);
    glowStroke(ctx, color, 2, 0.9, 8);
  } else if (kind === 'chain') {
    ctx.beginPath();
    ctx.moveTo(x - 11, y);
    ctx.lineTo(x - 2, y);
    ctx.lineTo(x - 7, y - 5);
    ctx.moveTo(x - 2, y);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x + 2, y + 5);
    glowStroke(ctx, color, 2, 1, 10);

    ctx.beginPath();
    ctx.arc(x + 9, y, 3.2, 0, Math.PI * 2);
    glowFill(ctx, color, 0.72, 10);
  } else if (kind === 'laser') {
    ctx.beginPath();
    ctx.rect(x - 10, y - 8, 20, 16);
    glowStroke(ctx, color, 1.8, 1, 10);
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.lineTo(x + 14, y);
    glowStroke(ctx, color, 2.1, 0.95, 12);
  } else if (kind === 'decay') {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    glowStroke(ctx, color, 1.8, 1, 10);
    ctx.beginPath();
    ctx.arc(x - 3, y - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 4, y + 1, 2.5, 0, Math.PI * 2);
    glowFill(ctx, color, 0.7, 10);
  } else if (kind === 'relay') {
    ctx.beginPath();
    ctx.rect(x - 9, y - 9, 18, 18);
    glowStroke(ctx, color, 1.8, 1, 10);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    glowFill(ctx, color, 0.7, 10);
  } else if (kind === 'amp') {
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    glowStroke(ctx, color, 1.5, 0.65, 8);
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 10);
    ctx.lineTo(x - 2, y - 2);
    ctx.lineTo(x + 3, y - 2);
    ctx.lineTo(x - 1, y + 9);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x + 2, y);
    glowStroke(ctx, color, 2.2, 1, 10);
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    glowFill(ctx, color, 0.75, 10);
  } else if (kind === 'bank') {
    ctx.beginPath();
    ctx.rect(x - 10, y - 7, 20, 14);
    glowStroke(ctx, color, 1.9, 1, 10);
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    glowStroke(ctx, color, 1.3, 0.9, 7);
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x, y + 10);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    glowStroke(ctx, color, 2, 1, 10);
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, Math.PI * 2);
    glowFill(ctx, color, 0.65, 8);
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    glowStroke(ctx, COLORS.selected, 1.4, 0.8, 8);
  }
  ctx.restore();
}

function drawSupportPreviews(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  time: number,
): void {
  if (snapshot.supportPreviews.length === 0) {
    return;
  }

  const mobileRenderMode = useMobileRenderMode();
  const towersById = new Map(snapshot.towers.map((tower) => [tower.id, tower] as const));

  for (const preview of snapshot.supportPreviews) {
    const color = preview.sourceKind === 'relay' ? COLORS.relay : COLORS.amp;
    const pulse = mobileRenderMode ? 0.5 : 0.5 + (Math.sin(time * 0.008) + 1) * 0.14;
    const auraAlpha = preview.preview ? 0.48 : 0.34;
    const linkAlpha = preview.preview ? 0.4 : 0.26;
    const haloAlpha = preview.preview ? 0.72 : 0.5;

    ctx.beginPath();
    ctx.arc(preview.sourcePos.x, preview.sourcePos.y, preview.range, 0, Math.PI * 2);
    glowStroke(ctx, color, preview.preview ? 1.4 : 1.1, auraAlpha, mobileRenderMode ? 4 : 10);

    for (const targetTowerId of preview.targetTowerIds) {
      const tower = towersById.get(targetTowerId);
      if (!tower) {
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(preview.sourcePos.x, preview.sourcePos.y);
      ctx.lineTo(tower.x, tower.y);
      glowStroke(ctx, color, preview.preview ? 1.6 : 1.2, linkAlpha, mobileRenderMode ? 4 : 10);

      if (mobileRenderMode) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 17 + pulse * 2, 0, Math.PI * 2);
      glowStroke(ctx, color, 1.7, haloAlpha, 12);
    }

    if (mobileRenderMode) {
      continue;
    }

    ctx.beginPath();
    ctx.arc(preview.sourcePos.x, preview.sourcePos.y, 20 + pulse * 2.5, 0, Math.PI * 2);
    glowStroke(ctx, color, 1.3, preview.preview ? 0.5 : 0.36, 12);
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  time: number,
): void {
  const mobileRenderMode = useMobileRenderMode();
  const routePaths = snapshot.routes.map((route) => getCachedRoutePath(route.points));
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);

  const staticBoard = getStaticBoardCanvas(snapshot, mobileRenderMode);
  if (staticBoard) {
    ctx.drawImage(staticBoard, 0, 0);
  } else {
    const pathCellSet = getCachedPathCellSet(snapshot.pathCells);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, snapshot.width, snapshot.height);
    drawBoard(ctx, snapshot, pathCellSet);
    drawPathEdges(ctx, snapshot, pathCellSet);
  }

  drawEntryExitMarkers(ctx, snapshot, time);

  const rangeBoostActive = snapshot.activeGlobalRangeBoost > 0;
  const fireRateBoostActive = snapshot.activeGlobalFireRateBoost > 0;

  if (fireRateBoostActive) {
    ctx.fillStyle = 'rgba(255, 122, 0, 0.08)';
    ctx.fillRect(0, 0, snapshot.width, snapshot.height);
  }

  for (const tower of snapshot.towers) {
    if (snapshot.selectedTowerId === tower.id) {
      const supportPreview = snapshot.supportPreviews.find(
        (preview) => preview.sourceTowerId === tower.id && !preview.preview,
      );
      ctx.beginPath();
      ctx.arc(
        tower.x,
        tower.y,
        supportPreview?.range ?? getTowerRange(tower.kind, tower.level, rangeBoostActive),
        0,
        Math.PI * 2,
      );
      glowStroke(ctx, COLORS.rangePreview, 1.1, 0.35, 9);
    }
  }

  drawSupportPreviews(ctx, snapshot, time);

  for (const tower of snapshot.towers) {
    drawTower(ctx, tower.kind, tower.x, tower.y, snapshot.selectedTowerId === tower.id);
    if (fireRateBoostActive && !mobileRenderMode) {
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 19 + Math.sin(time * 0.01) * 2, 0, Math.PI * 2);
      glowStroke(ctx, '#FFB347', 1.2, 0.5, 10);
    }
  }

  for (const enemy of snapshot.enemies) {
    const enemyPath = routePaths[enemy.routeIndex] ?? routePaths[0];
    const pos = pointAtDistance(enemyPath, enemy.distance);
    drawEnemy(ctx, enemy.kind, pos.x, pos.y, enemy.hp, enemy.maxHp, enemy.hitFlash);
  }

  for (const projectile of snapshot.projectiles) {
    const color = towerColor(projectile.kind);
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.kind === 'nova' ? 4 : 3, 0, Math.PI * 2);
    glowFill(ctx, color, 0.85, mobileRenderMode ? 4 : 10);
  }

  for (const beam of snapshot.beams) {
    const alpha = Math.min(1, Math.max(0, beam.remaining / 0.09));
    const color = towerColor(beam.kind);
    ctx.beginPath();
    ctx.moveTo(beam.from.x, beam.from.y);
    ctx.lineTo(beam.to.x, beam.to.y);
    glowStroke(ctx, color, beam.kind === 'chain' ? 2.2 : 1.6, 0.8 * alpha, mobileRenderMode ? 4 : 10);
  }

  if (snapshot.placingTowerKind && snapshot.placementPos) {
    const ghostColor = towerColor(snapshot.placingTowerKind);
    const placementSupportPreview = snapshot.supportPreviews.find((preview) => preview.preview);
    const ghostRange =
      placementSupportPreview?.range ?? BALANCE.towers.stats[snapshot.placingTowerKind].range;
    const alpha = snapshot.placementValid ? 0.55 : 0.2;

    ctx.beginPath();
    ctx.arc(snapshot.placementPos.x, snapshot.placementPos.y, ghostRange, 0, Math.PI * 2);
    glowStroke(ctx, ghostColor, 1, alpha, 8);

    drawTower(ctx, snapshot.placingTowerKind, snapshot.placementPos.x, snapshot.placementPos.y, false);
    if (!snapshot.placementValid) {
      ctx.beginPath();
      ctx.moveTo(snapshot.placementPos.x - 8, snapshot.placementPos.y - 8);
      ctx.lineTo(snapshot.placementPos.x + 8, snapshot.placementPos.y + 8);
      ctx.moveTo(snapshot.placementPos.x + 8, snapshot.placementPos.y - 8);
      ctx.lineTo(snapshot.placementPos.x - 8, snapshot.placementPos.y + 8);
      glowStroke(ctx, COLORS.warning, 1.5, 0.8, 8);
    }
  }

  if (snapshot.bonusOrb) {
    const orbColor =
      snapshot.bonusOrb.type === 'globalDamageBoost'
        ? '#FF2F92'
        : snapshot.bonusOrb.type === 'globalRangeBoost'
          ? '#00E5FF'
          : snapshot.bonusOrb.type === 'incomeBurst'
            ? '#FFE600'
            : '#FF4D5A';
    const pulse = 1 + Math.sin(time * 0.007) * 0.2;
    ctx.beginPath();
    ctx.arc(snapshot.bonusOrb.x, snapshot.bonusOrb.y, 12 * pulse, 0, Math.PI * 2);
    glowStroke(ctx, orbColor, 2, 0.85, 18);
    ctx.beginPath();
    ctx.arc(snapshot.bonusOrb.x, snapshot.bonusOrb.y, 5, 0, Math.PI * 2);
    glowFill(ctx, orbColor, 0.7, 12);

    ctx.textAlign = 'right';
    ctx.font = '700 13px Rajdhani, sans-serif';
    ctx.fillStyle = '#d9f4ff';
    ctx.fillText('BOOST AVAILABLE - CLICK ORB', snapshot.width - 14, 24);
  }

  if (
    snapshot.activeGlobalDamageBoost > 0 ||
    snapshot.activeGlobalRangeBoost > 0 ||
    snapshot.activeGlobalFireRateBoost > 0
  ) {
    ctx.textAlign = 'right';
    ctx.font = '700 12px Rajdhani, sans-serif';
    let line = snapshot.bonusOrb ? 40 : 24;
    if (snapshot.activeGlobalDamageBoost > 0) {
      ctx.fillStyle = '#ff7ad0';
      ctx.fillText(`DMG BOOST ${snapshot.activeGlobalDamageBoost.toFixed(1)}s`, snapshot.width - 14, line);
      line += 14;
    }
    if (snapshot.activeGlobalRangeBoost > 0) {
      ctx.fillStyle = '#6befff';
      ctx.fillText(`RANGE BOOST ${snapshot.activeGlobalRangeBoost.toFixed(1)}s`, snapshot.width - 14, line);
      line += 14;
    }
    if (snapshot.activeGlobalFireRateBoost > 0) {
      ctx.fillStyle = '#ffb347';
      ctx.fillText(`OVERCLOCK ${snapshot.activeGlobalFireRateBoost.toFixed(1)}s`, snapshot.width - 14, line);
    }
  }

  if (snapshot.gameOver || snapshot.victory) {
    ctx.fillStyle = 'rgba(4,7,15,0.72)';
    ctx.fillRect(0, 0, snapshot.width, snapshot.height);

    ctx.textAlign = 'center';
    ctx.font = '700 40px Rajdhani, sans-serif';
    ctx.fillStyle = snapshot.victory ? '#5dff8e' : '#ff5d8a';
    ctx.fillText(snapshot.victory ? 'VICTORY' : 'DEFEAT', snapshot.width / 2, snapshot.height / 2 - 8);
    ctx.font = '500 16px Rajdhani, sans-serif';
    ctx.fillStyle = '#d7eeff';
    ctx.fillText('Click anywhere or use Restart to run another simulation', snapshot.width / 2, snapshot.height / 2 + 24);
  }
}
