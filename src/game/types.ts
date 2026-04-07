import type { AbilityKind, EnemyKind, GameMode, TowerKind, WaveDefinition } from '../balance';

export type TargetingMode = 'first' | 'closest';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  routeIndex: number;
  waveIndex: number;
  distance: number;
  hp: number;
  maxHp: number;
  speed: number;
  bounty: number;
  slowFactor: number;
  slowRemaining: number;
  dotDamagePerSecond: number;
  dotRemaining: number;
  alive: boolean;
  hitFlash: number;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  level: number;
  cooldown: number;
  targeting: TargetingMode;
}

export interface Projectile {
  id: number;
  kind: TowerKind;
  x: number;
  y: number;
  targetId: number;
  speed: number;
  damage: number;
  splashRadius: number;
  slowPct: number;
  slowDuration: number;
  dotDamagePerSecond: number;
  dotDuration: number;
  alive: boolean;
}

export interface Beam {
  id: number;
  kind: TowerKind;
  from: Vec2;
  to: Vec2;
  remaining: number;
}

export interface ActiveWave {
  index: number;
  def: WaveDefinition;
  queue: EnemyKind[];
  spawnTimer: number;
  doneSpawning: boolean;
  rewardMultiplier: number;
  spawnedCount: number;
}

export type BonusType = 'globalDamageBoost' | 'globalRangeBoost' | 'incomeBurst' | 'livesBurst';

export interface BonusOrb {
  x: number;
  y: number;
  remaining: number;
  type: BonusType;
}

export interface Toast {
  id: number;
  text: string;
  remaining: number;
}

export interface AbilitySnapshot {
  kind: AbilityKind;
  charges: number;
  maxCharges: number;
  cooldownRemaining: number;
  activeRemaining: number;
  available: boolean;
}

export interface MapRouteSnapshot {
  points: Vec2[];
}

export interface SupportPreviewSnapshot {
  sourceTowerId: number | null;
  sourceKind: TowerKind;
  sourcePos: Vec2;
  range: number;
  targetTowerIds: number[];
  preview: boolean;
}

export interface GameSnapshot {
  mode: GameMode;
  mapIndex: number;
  mapName: string;
  mapNames: string[];
  width: number;
  height: number;
  gridSize: number;
  cols: number;
  rows: number;
  pathPoints: Vec2[];
  routes: MapRouteSnapshot[];
  supportPreviews: SupportPreviewSnapshot[];
  pathCells: string[];
  pathLength: number;
  enemies: Enemy[];
  towers: Tower[];
  projectiles: Projectile[];
  beams: Beam[];
  bonusOrb: BonusOrb | null;
  toasts: Toast[];
  abilities: AbilitySnapshot[];
  waveNumber: number;
  completedWaves: number;
  totalWaves: number;
  isEndlessMode: boolean;
  lives: number;
  money: number;
  interestRatePct: number;
  score: number;
  bonusCredits: number;
  speed: 1 | 2;
  paused: boolean;
  gameOver: boolean;
  victory: boolean;
  selectedTowerId: number | null;
  placingTowerKind: TowerKind | null;
  placementPos: Vec2 | null;
  placementValid: boolean;
  canStartWave: boolean;
  canSendEarlyWave: boolean;
  canQueueWave: boolean;
  queuedWaveCount: number;
  maxQueuedWaves: number;
  waveInProgress: boolean;
  autoWaveEnabled: boolean;
  autoWaveCountdown: number;
  activeGlobalDamageBoost: number;
  activeGlobalRangeBoost: number;
  activeGlobalFireRateBoost: number;
}
