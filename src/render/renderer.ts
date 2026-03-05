import { BALANCE, type EnemyKind, type TowerKind } from '../balance';
import { createPath, pointAtDistance } from '../game/path';
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
  enemyRunner: '#00F0FF',
  enemyTank: '#FF2F92',
  enemySwarm: '#FFD400',
  enemyBlossom: '#9A6BFF',
  enemyPetal: '#C08BFF',
  hp: '#32FF87',
  hpBg: '#2A2A2A',
  warning: '#FF4D5A',
  selected: '#FFE600',
  rangePreview: '#00E5FF',
  tile: '#0B0F1A',
} as const;

function towerColor(kind: TowerKind): string {
  if (kind === 'pulse') return COLORS.pulse;
  if (kind === 'nova') return COLORS.nova;
  return COLORS.frost;
}

function enemyColor(kind: EnemyKind): string {
  if (kind === 'runner') return COLORS.enemyRunner;
  if (kind === 'tank') return COLORS.enemyTank;
  if (kind === 'blossom') return COLORS.enemyBlossom;
  if (kind === 'petal') return COLORS.enemyPetal;
  return COLORS.enemySwarm;
}

function getTowerRange(kind: TowerKind, level: number, rangeBoostActive: boolean): number {
  const base = BALANCE.towers.stats[kind].range;
  const levelMul = BALANCE.towers.rangeMultiplierByLevel[level - 1];
  const boostMul = rangeBoostActive ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1;
  return base * levelMul * boostMul;
}

function drawBoard(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const path = new Set(snapshot.pathCells);
  const half = snapshot.gridSize / 2;

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

      ctx.beginPath();
      ctx.moveTo(x - half + 4, y + half - 5);
      ctx.lineTo(x + half - 5, y - half + 4);
      glowStroke(ctx, COLORS.grid, 0.8, 0.25, 0);
    }
  }
}

function drawPathEdges(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot): void {
  const path = new Set(snapshot.pathCells);
  const half = snapshot.gridSize / 2;
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
        glowStroke(ctx, COLORS.path, 1.5, 0.8, 6);
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y - half + 1);
        ctx.lineTo(x - half + 1, y + half - 1);
        glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
      }

      if (right) {
        ctx.beginPath();
        ctx.moveTo(x + half - 1, y - half + 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, 6);
        ctx.beginPath();
        ctx.moveTo(x + half - 1, y - half + 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
      }

      if (top) {
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y - half + 1);
        ctx.lineTo(x + half - 1, y - half + 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, 6);
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y - half + 1);
        ctx.lineTo(x + half - 1, y - half + 1);
        glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
      }

      if (bottom) {
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y + half - 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.path, 1.5, 0.8, 6);
        ctx.beginPath();
        ctx.moveTo(x - half + 1, y + half - 1);
        ctx.lineTo(x + half - 1, y + half - 1);
        glowStroke(ctx, COLORS.pathInner, 0.9, 0.5, 0);
      }
    }
  }
}

function drawEntryExitMarkers(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, time: number): void {
  if (snapshot.pathPoints.length < 2) {
    return;
  }

  const half = snapshot.gridSize / 2;
  const start = snapshot.pathPoints[0];
  const startNext = snapshot.pathPoints[1];
  const end = snapshot.pathPoints[snapshot.pathPoints.length - 1];
  const endPrev = snapshot.pathPoints[snapshot.pathPoints.length - 2];

  const drawGate = (a: { x: number; y: number }, b: { x: number; y: number }, color: string): void => {
    const horizontal = Math.abs(b.x - a.x) > Math.abs(b.y - a.y);
    const cycleMs = 5000;
    const phase = (time % cycleMs) / cycleMs;
    const eased = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
    const pulse = 0.52 + eased * 0.42;
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
    glowStroke(ctx, color, 2.8, pulse, 22);
  };

  drawGate(start, startNext, COLORS.gateStart);
  drawGate(end, endPrev, COLORS.gateEnd);
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

  if (hitFlash > 0) {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    glowFill(ctx, '#ffffff', 0.16 * hitFlash, 16);
  }

  const hpRatio = Math.max(0, hp / maxHp);
  ctx.beginPath();
  ctx.rect(x - 10, y - 14, 20, 3);
  glowStroke(ctx, COLORS.hpBg, 1.5, 1, 0);
  ctx.beginPath();
  ctx.rect(x - 10, y - 14, 20 * hpRatio, 3);
  glowStroke(ctx, COLORS.hp, 1.5, 0.9, 6);
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
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x + 9, y + 6);
    ctx.lineTo(x - 9, y + 6);
    ctx.closePath();
    glowStroke(ctx, color, 2, 1, 10);
    ctx.beginPath();
    ctx.arc(x, y + 1, 3.5, 0, Math.PI * 2);
    glowFill(ctx, color, 0.65, 8);
  }

  if (selected) {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    glowStroke(ctx, COLORS.selected, 1.4, 0.8, 8);
  }
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  time: number,
): void {
  const pathData = createPath(snapshot.pathPoints);
  ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, snapshot.width, snapshot.height);

  drawBoard(ctx, snapshot);
  drawPathEdges(ctx, snapshot);
  drawEntryExitMarkers(ctx, snapshot, time);

  const rangeBoostActive = snapshot.activeGlobalRangeBoost > 0;

  for (const tower of snapshot.towers) {
    if (snapshot.selectedTowerId === tower.id) {
      ctx.beginPath();
      ctx.arc(
        tower.x,
        tower.y,
        getTowerRange(tower.kind, tower.level, rangeBoostActive),
        0,
        Math.PI * 2,
      );
      glowStroke(ctx, COLORS.rangePreview, 1.1, 0.35, 9);
    }
  }

  for (const tower of snapshot.towers) {
    drawTower(ctx, tower.kind, tower.x, tower.y, snapshot.selectedTowerId === tower.id);
  }

  for (const enemy of snapshot.enemies) {
    const pos = pointAtDistance(pathData, enemy.distance);
    drawEnemy(ctx, enemy.kind, pos.x, pos.y, enemy.hp, enemy.maxHp, enemy.hitFlash);
  }

  for (const projectile of snapshot.projectiles) {
    const color = towerColor(projectile.kind);
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.kind === 'nova' ? 4 : 3, 0, Math.PI * 2);
    glowFill(ctx, color, 0.85, 10);
  }

  if (snapshot.placingTowerKind && snapshot.placementPos) {
    const ghostColor = towerColor(snapshot.placingTowerKind);
    const ghostRange = BALANCE.towers.stats[snapshot.placingTowerKind].range;
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

  if (snapshot.activeGlobalDamageBoost > 0 || snapshot.activeGlobalRangeBoost > 0) {
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
