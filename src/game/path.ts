import type { Vec2 } from './types';

export interface PathData {
  points: Vec2[];
  segmentLengths: number[];
  cumulative: number[];
  totalLength: number;
}

export interface GridCell {
  col: number;
  row: number;
}

export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

export function createPath(points: readonly Vec2[]): PathData {
  const segmentLengths: number[] = [];
  const cumulative: number[] = [0];
  let total = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    segmentLengths.push(length);
    total += length;
    cumulative.push(total);
  }

  return {
    points: points.map((point) => ({ x: point.x, y: point.y })),
    segmentLengths,
    cumulative,
    totalLength: total,
  };
}

export function pathCellsFromPoints(points: readonly Vec2[], gridSize: number): Set<string> {
  const cells = new Set<string>();

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const aCol = Math.round(a.x / gridSize);
    const aRow = Math.round(a.y / gridSize);
    const bCol = Math.round(b.x / gridSize);
    const bRow = Math.round(b.y / gridSize);

    if (aCol === bCol) {
      const step = aRow <= bRow ? 1 : -1;
      for (let row = aRow; step > 0 ? row <= bRow : row >= bRow; row += step) {
        cells.add(cellKey(aCol, row));
      }
      continue;
    }

    const step = aCol <= bCol ? 1 : -1;
    for (let col = aCol; step > 0 ? col <= bCol : col >= bCol; col += step) {
      cells.add(cellKey(col, aRow));
    }
  }

  return cells;
}

export function pointAtDistance(path: PathData, distance: number): Vec2 {
  if (distance <= 0) {
    return path.points[0];
  }
  if (distance >= path.totalLength) {
    return path.points[path.points.length - 1];
  }

  for (let i = 0; i < path.segmentLengths.length; i += 1) {
    const start = path.cumulative[i];
    const end = path.cumulative[i + 1];
    if (distance <= end) {
      const t = (distance - start) / (end - start);
      const a = path.points[i];
      const b = path.points[i + 1];
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      };
    }
  }

  return path.points[path.points.length - 1];
}

export function distanceToPolyline(point: Vec2, path: PathData): number {
  let best = Number.POSITIVE_INFINITY;

  for (let i = 0; i < path.points.length - 1; i += 1) {
    const a = path.points[i];
    const b = path.points[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const abLenSq = abx * abx + aby * aby;

    const t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq)) : 0;
    const cx = a.x + abx * t;
    const cy = a.y + aby * t;
    const dist = Math.hypot(point.x - cx, point.y - cy);

    if (dist < best) {
      best = dist;
    }
  }

  return best;
}
