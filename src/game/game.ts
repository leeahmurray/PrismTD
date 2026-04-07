import { BALANCE, type AbilityKind, type EnemyKind, type GameMode, type TowerKind, type WaveDefinition } from '../balance';
import { getAvailableMaps, type MapDefinition } from './maps';
import { cellKey, createPath, pathCellsFromPoints, pointAtDistance, type PathData } from './path';
import type {
  ActiveWave,
  AbilitySnapshot,
  Beam,
  BonusOrb,
  BonusType,
  Enemy,
  GameSnapshot,
  Projectile,
  SupportPreviewSnapshot,
  Toast,
  Tower,
  Vec2,
} from './types';

const BONUS_ORB_RADIUS = 14;
const EARLY_WAVE_REWARD_MULTIPLIER = 1.05;
const SPAWN_STAGGER_DISTANCE = BALANCE.map.gridSizePx * 0.28;
const CHAIN_MAX_TARGETS = 4;
const CHAIN_JUMP_RANGE = 102;
const CHAIN_DAMAGE_FALLOFF = 0.64;
const BEAM_LIFETIME = 0.09;
const LASER_LINE_HALF_WIDTH = 10;
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function supportDamageBoostFor(kind: TowerKind): number {
  const base = BALANCE.towers.stats[kind];
  return 'supportDamageBoost' in base ? base.supportDamageBoost : 0;
}

function supportRangeBoostFor(kind: TowerKind): number {
  const base = BALANCE.towers.stats[kind];
  return 'supportRangeBoost' in base ? base.supportRangeBoost : 0;
}

function incomePerWaveFor(kind: TowerKind): number {
  const base = BALANCE.towers.stats[kind];
  return 'incomePerWave' in base ? base.incomePerWave : 0;
}

function dotDamagePerSecondFor(kind: TowerKind): number {
  const base = BALANCE.towers.stats[kind];
  return 'dotDamagePerSecond' in base ? base.dotDamagePerSecond : 0;
}

function dotDurationFor(kind: TowerKind): number {
  const base = BALANCE.towers.stats[kind];
  return 'dotDuration' in base ? base.dotDuration : 0;
}

function livesLostForEnemy(kind: EnemyKind): number {
  return kind === 'boss' ? 5 : 1;
}

interface AbilityChargeState {
  charges: number;
  progress: number;
}

export class Game {
  private maps: MapDefinition[];

  private paths: PathData[];

  private mapIndex = 0;

  private mode: GameMode = 'standard';

  private gridSize = BALANCE.map.gridSizePx;

  private cols = Math.floor(BALANCE.map.width / BALANCE.map.gridSizePx);

  private rows = Math.floor(BALANCE.map.height / BALANCE.map.gridSizePx);

  private pathCellSet: Set<string>;

  private pathCellList: string[];

  private enemies: Enemy[] = [];

  private towers: Tower[] = [];

  private projectiles: Projectile[] = [];

  private beams: Beam[] = [];

  private bonusOrb: BonusOrb | null = null;

  private toasts: Toast[] = [];

  private money: number = BALANCE.economy.startMoney;

  private lives: number = BALANCE.economy.startLives;

  private score = 0;

  private bonusCredits = 0;

  private interestRatePct = BALANCE.economy.interestPerWavePct;

  private nextWaveIndex = 0;

  private completedWaveCount = 0;

  private activeWaves: ActiveWave[] = [];

  private paused = false;

  private speed: 1 | 2 = 1;

  private gameOver = false;

  private victory = false;

  private selectedTowerId: number | null = null;

  private placingTowerKind: TowerKind | null = null;

  private placementPos: Vec2 | null = null;

  private placementValid = false;

  private globalDamageBoostRemaining = 0;

  private globalRangeBoostRemaining = 0;

  private globalFireRateBoostRemaining = 0;

  private autoWaveEnabled = false;

  private autoWaveCountdown = 0;

  private abilityCooldowns = this.createAbilityCooldowns();

  private kamikazeStarted = false;

  private idCounters = {
    enemy: 1,
    tower: 1,
    projectile: 1,
    toast: 1,
    beam: 1,
  };

  constructor() {
    this.maps = getAvailableMaps();
    this.paths = [];
    this.pathCellSet = new Set<string>();
    this.pathCellList = [];
    this.setActiveMap(0);
  }

  restart(): void {
    this.enemies = [];
    this.towers = [];
    this.projectiles = [];
    this.beams = [];
    this.bonusOrb = null;
    this.toasts = [];
    this.money = this.getModeStartMoney();
    this.lives = BALANCE.economy.startLives;
    this.score = 0;
    this.bonusCredits = 0;
    this.interestRatePct = BALANCE.economy.interestPerWavePct;
    this.nextWaveIndex = 0;
    this.completedWaveCount = 0;
    this.activeWaves = [];
    this.paused = false;
    this.speed = 1;
    this.gameOver = false;
    this.victory = false;
    this.selectedTowerId = null;
    this.placingTowerKind = null;
    this.placementPos = null;
    this.placementValid = false;
    this.globalDamageBoostRemaining = 0;
    this.globalRangeBoostRemaining = 0;
    this.globalFireRateBoostRemaining = 0;
    this.autoWaveEnabled = false;
    this.autoWaveCountdown = 0;
    this.abilityCooldowns = this.createAbilityCooldowns();
    this.kamikazeStarted = false;
    this.idCounters = { enemy: 1, tower: 1, projectile: 1, toast: 1, beam: 1 };
  }

  getSnapshot(): GameSnapshot {
    const mapDef = this.maps[this.mapIndex];
    return {
      mode: this.mode,
      mapIndex: this.mapIndex,
      mapName: mapDef.name,
      mapNames: this.maps.map((map) => map.name),
      width: BALANCE.map.width,
      height: BALANCE.map.height,
      gridSize: this.gridSize,
      cols: this.cols,
      rows: this.rows,
      pathPoints: this.paths[0]?.points ?? [],
      routes: this.paths.map((path) => ({ points: path.points })),
      supportPreviews: this.getSupportPreviews(),
      pathCells: this.pathCellList,
      pathLength: this.paths[0]?.totalLength ?? 0,
      enemies: this.enemies,
      towers: this.towers,
      projectiles: this.projectiles,
      beams: this.beams,
      bonusOrb: this.bonusOrb,
      toasts: this.toasts,
      abilities: this.getAbilitySnapshots(),
      waveNumber: this.isEndlessMode() ? this.completedWaveCount + 1 : Math.min(this.completedWaveCount + 1, BALANCE.waves.length),
      completedWaves: this.completedWaveCount,
      totalWaves: this.isEndlessMode() ? 0 : BALANCE.waves.length,
      isEndlessMode: this.isEndlessMode(),
      lives: this.lives,
      money: this.money,
      interestRatePct: this.interestRatePct,
      score: this.score,
      bonusCredits: this.bonusCredits,
      speed: this.speed,
      paused: this.paused,
      gameOver: this.gameOver,
      victory: this.victory,
      selectedTowerId: this.selectedTowerId,
      placingTowerKind: this.placingTowerKind,
      placementPos: this.placementPos,
      placementValid: this.placementValid,
      canStartWave:
        !this.gameOver &&
        !this.victory &&
        this.activeWaves.length === 0 &&
        this.enemies.length === 0 &&
        this.hasMoreWaves(),
      canSendEarlyWave:
        !this.gameOver &&
        !this.victory &&
        this.hasMoreWaves() &&
        (this.activeWaves.length > 0 || this.enemies.length > 0),
      canQueueWave:
        !this.gameOver &&
        !this.victory &&
        this.hasMoreWaves() &&
        (this.activeWaves.length > 0 || this.enemies.length > 0) &&
        this.activeWaves.length < this.maxConcurrentWaves(),
      queuedWaveCount: this.activeWaves.length,
      maxQueuedWaves: this.maxConcurrentWaves(),
      waveInProgress: this.activeWaves.length > 0 || this.enemies.length > 0,
      autoWaveEnabled: this.autoWaveEnabled,
      autoWaveCountdown: this.autoWaveCountdown,
      activeGlobalDamageBoost: this.globalDamageBoostRemaining,
      activeGlobalRangeBoost: this.globalRangeBoostRemaining,
      activeGlobalFireRateBoost: this.globalFireRateBoostRemaining,
    };
  }

  update(dt: number): void {
    const scaledDt = dt * this.speed;

    this.updateToasts(scaledDt);

    if (this.paused || this.gameOver || this.victory) {
      return;
    }

    this.updateBuffs(scaledDt);
    this.updateWaveSpawning(scaledDt);
    this.updateEnemies(scaledDt);
    this.updateTowers(scaledDt);
    this.updateProjectiles(scaledDt);
    this.updateBeams(scaledDt);
    this.updateBonusOrb(scaledDt);

    this.checkWaveCompletion();
    this.updateKamikazeFlow();
    this.updateAutoWave(scaledDt);

    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
      this.score = Math.max(0, this.score - 200);
      this.pushToast('Core breach. Sector lost.');
    }
  }

  setPlacement(kind: TowerKind | null): void {
    this.placingTowerKind = kind;
    if (!kind) {
      this.placementPos = null;
      this.placementValid = false;
    }
  }

  setMouseWorld(pos: Vec2 | null): void {
    const snapped = pos ? this.snapToGrid(pos) : null;
    this.placementPos = snapped;
    this.placementValid = snapped ? this.canPlaceTowerAt(snapped) : false;
  }

  onCanvasClick(pos: Vec2): boolean {
    if (this.gameOver || this.victory) {
      return false;
    }

    if (this.tryCollectBonusOrb(pos)) {
      return false;
    }

    if (this.placingTowerKind) {
      if (this.placeTower(this.placingTowerKind, pos)) {
        const snapped = this.snapToGrid(pos);
        this.placementPos = snapped;
        this.placementValid = snapped ? this.canPlaceTowerAt(snapped) : false;
        return true;
      }
      return false;
    }

    const tower = this.findTowerAt(pos);
    this.selectedTowerId = tower?.id ?? null;
    return false;
  }

  onCanvasRightClick(): void {
    this.placingTowerKind = null;
    this.placementPos = null;
    this.placementValid = false;
  }

  startWave(): void {
    if (
      this.gameOver ||
      this.victory ||
      this.activeWaves.length > 0 ||
      this.enemies.length > 0 ||
      !this.hasMoreWaves()
    ) {
      return;
    }
    if (this.mode === 'kamikaze') {
      this.kamikazeStarted = true;
      this.updateKamikazeFlow();
      return;
    }
    this.enqueueWave(false);
  }

  sendNextWaveEarly(): void {
    if (
      this.gameOver ||
      this.victory ||
      !this.hasMoreWaves() ||
      (this.activeWaves.length === 0 && this.enemies.length === 0) ||
      this.activeWaves.length >= this.maxConcurrentWaves()
    ) {
      return;
    }
    this.enqueueWave(true);
    this.pushToast(`Interest increased +${Math.round(BALANCE.economy.interestGainPerWavePct * 100)}%`);
  }

  setAutoWaveEnabled(enabled: boolean): void {
    this.autoWaveEnabled = enabled;
    this.autoWaveCountdown = enabled ? 0.8 : 0;
  }

  togglePause(): void {
    this.paused = !this.paused;
  }

  toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : 1;
  }

  activateAbility(kind: AbilityKind): boolean {
    if (this.gameOver || this.victory) {
      return false;
    }

    if (this.abilityCooldowns[kind].charges <= 0) {
      return false;
    }

    const ability = BALANCE.abilities.stats[kind];
    if (ability.requiresTowers && this.towers.length === 0) {
      this.pushToast('Build towers before triggering that ability');
      return false;
    }

    if (ability.requiresEnemies && this.enemies.length === 0) {
      this.pushToast('No enemies in the lane');
      return false;
    }

    if (kind === 'overclock') {
      this.globalFireRateBoostRemaining = Math.max(
        this.globalFireRateBoostRemaining,
        BALANCE.abilities.stats.overclock.duration,
      );
    } else if (kind === 'ionBurst') {
      for (const enemy of [...this.enemies]) {
        this.applyDamage(enemy, BALANCE.abilities.stats.ionBurst.damage);
      }
    } else {
      for (const enemy of this.enemies) {
        enemy.distance = Math.max(0, enemy.distance - BALANCE.abilities.stats.phaseWarp.pushDistance);
        enemy.slowFactor = clamp(1 - BALANCE.abilities.stats.phaseWarp.slowPct, 0.15, 1);
        enemy.slowRemaining = Math.max(enemy.slowRemaining, BALANCE.abilities.stats.phaseWarp.slowDuration);
        enemy.hitFlash = 1;
      }
    }

    const abilityState = this.abilityCooldowns[kind];
    abilityState.charges = Math.max(0, abilityState.charges - 1);
    this.pushToast(ability.toast);
    return true;
  }

  cycleMap(delta: number): void {
    const total = this.maps.length;
    const next = (this.mapIndex + delta + total) % total;
    this.setMapIndex(next);
  }

  cycleMode(delta: number): void {
    const modes = BALANCE.modes.list.map((entry) => entry.id);
    const index = modes.indexOf(this.mode);
    const next = (index + delta + modes.length) % modes.length;
    this.setMode(modes[next]);
  }

  setMode(mode: GameMode): void {
    if (mode === this.mode) {
      return;
    }
    this.mode = mode;
    this.restart();
  }

  reloadMapLibrary(): void {
    const currentMapId = this.maps[this.mapIndex]?.id;
    this.maps = getAvailableMaps();

    if (this.maps.length === 0) {
      return;
    }

    const nextIndex = currentMapId ? this.maps.findIndex((map) => map.id === currentMapId) : -1;
    this.setActiveMap(nextIndex >= 0 ? nextIndex : Math.min(this.mapIndex, this.maps.length - 1));
  }

  setMapIndex(index: number): void {
    const clamped = Math.max(0, Math.min(index, this.maps.length - 1));
    if (clamped === this.mapIndex) {
      return;
    }
    this.setActiveMap(clamped);
    this.restart();
  }

  selectTower(id: number | null): void {
    this.selectedTowerId = id;
  }

  getSelectedTower(): Tower | null {
    if (!this.selectedTowerId) {
      return null;
    }
    return this.towers.find((tower) => tower.id === this.selectedTowerId) ?? null;
  }

  toggleSelectedTargeting(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }
    tower.targeting = tower.targeting === 'first' ? 'closest' : 'first';
  }

  upgradeSelectedTower(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    const nextLevel = tower.level + 1;
    if (nextLevel > BALANCE.towers.maxLevel) {
      return;
    }

    const cost = this.getUpgradeCost(tower.kind, tower.level);
    if (this.money < cost) {
      this.pushToast('Insufficient credits');
      return;
    }

    this.money -= cost;
    tower.level = nextLevel;
  }

  sellSelectedTower(): void {
    const tower = this.getSelectedTower();
    if (!tower) {
      return;
    }

    const refund = Math.floor(this.getTowerInvestedCost(tower) * BALANCE.economy.sellRefundPct);
    this.money += refund;
    this.towers = this.towers.filter((t) => t.id !== tower.id);
    this.selectedTowerId = null;
  }

  getUpgradeCost(kind: TowerKind, level: number): number {
    if (level >= BALANCE.towers.maxLevel) {
      return 0;
    }
    const base = BALANCE.towers.stats[kind].cost;
    const multiplier = BALANCE.towers.upgradeCostMultiplierByLevel[level];
    return Math.floor(base * multiplier);
  }

  getTowerInvestedCost(tower: Tower): number {
    let total = BALANCE.towers.stats[tower.kind].cost;
    for (let level = 1; level < tower.level; level += 1) {
      total += this.getUpgradeCost(tower.kind, level);
    }
    return total;
  }

  getTowerStats(tower: Tower): {
    damage: number;
    range: number;
    fireRate: number;
    splashRadius: number;
    slowPct: number;
    slowDuration: number;
    dotDamagePerSecond: number;
    dotDuration: number;
    supportDamageBoost: number;
    supportRangeBoost: number;
    incomePerWave: number;
  } {
    const levelIndex = tower.level - 1;
    const base = BALANCE.towers.stats[tower.kind];
    const supportModifiers = this.getSupportModifiersForTower(tower);
    const damageBoost =
      (this.globalDamageBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalDamageBoost.amount : 1) +
      supportModifiers.damageBoost;
    const rangeBoost =
      (this.globalRangeBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1) +
      supportModifiers.rangeBoost;
    const fireRateBoost = this.globalFireRateBoostRemaining > 0 ? 1 + BALANCE.abilities.stats.overclock.fireRateBoost : 1;

    const damage =
      base.damage * BALANCE.towers.damageMultiplierByLevel[levelIndex] * damageBoost;
    const range = base.range * BALANCE.towers.rangeMultiplierByLevel[levelIndex] * rangeBoost;
    const fireRate =
      base.fireRate * BALANCE.towers.fireRateMultiplierByType[tower.kind][levelIndex] * fireRateBoost;
    const supportDamageBoost =
      supportDamageBoostFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex];
    const supportRangeBoost =
      supportRangeBoostFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex];
    const dotDamagePerSecond =
      dotDamagePerSecondFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex] * damageBoost;
    const dotDuration = dotDurationFor(tower.kind);
    const incomePerWave = Math.round(incomePerWaveFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex]);

    return {
      damage,
      range,
      fireRate,
      splashRadius: base.splashRadius,
      slowPct: base.slowPct,
      slowDuration: base.slowDuration,
      dotDamagePerSecond,
      dotDuration,
      supportDamageBoost,
      supportRangeBoost,
      incomePerWave,
    };
  }

  private getSupportPreviews(): SupportPreviewSnapshot[] {
    const previews: SupportPreviewSnapshot[] = [];
    const selectedTower = this.getSelectedTower();

    if (selectedTower && this.isSupportTower(selectedTower.kind)) {
      previews.push(this.createSupportPreview(selectedTower.kind, selectedTower.level, selectedTower, false));
    }

    if (this.placingTowerKind && this.placementPos && this.isSupportTower(this.placingTowerKind)) {
      previews.push(
        this.createSupportPreview(
          this.placingTowerKind,
          1,
          {
            x: this.placementPos.x,
            y: this.placementPos.y,
          },
          true,
        ),
      );
    }

    return previews;
  }

  private isSupportTower(kind: TowerKind): kind is 'relay' | 'amp' {
    return kind === 'relay' || kind === 'amp';
  }

  private getSupportAuraRange(kind: TowerKind, level: number): number {
    const baseRange = BALANCE.towers.stats[kind].range;
    const levelMultiplier = BALANCE.towers.rangeMultiplierByLevel[level - 1];
    const globalRangeMultiplier =
      this.globalRangeBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1;
    return baseRange * levelMultiplier * globalRangeMultiplier;
  }

  private createSupportPreview(
    kind: 'relay' | 'amp',
    level: number,
    source: Pick<Tower, 'x' | 'y'> & Partial<Pick<Tower, 'id'>>,
    preview: boolean,
  ): SupportPreviewSnapshot {
    const range = this.getSupportAuraRange(kind, level);
    const sourceTowerId = typeof source.id === 'number' ? source.id : null;
    const targetTowerIds = this.towers
      .filter((tower) => tower.id !== sourceTowerId)
      .filter((tower) => Math.hypot(tower.x - source.x, tower.y - source.y) <= range)
      .map((tower) => tower.id);

    return {
      sourceTowerId,
      sourceKind: kind,
      sourcePos: { x: source.x, y: source.y },
      range,
      targetTowerIds,
      preview,
    };
  }

  private getSupportModifiersForTower(tower: Tower): { damageBoost: number; rangeBoost: number } {
    let damageBoost = 0;
    let rangeBoost = 0;

    for (const supportTower of this.towers) {
      if (supportTower.id === tower.id) {
        continue;
      }

      if (supportTower.kind !== 'relay' && supportTower.kind !== 'amp') {
        continue;
      }

      const supportStats = this.getTowerStatsWithoutSupport(supportTower);
      const distance = Math.hypot(supportTower.x - tower.x, supportTower.y - tower.y);
      if (distance > supportStats.range) {
        continue;
      }

      damageBoost += supportStats.supportDamageBoost;
      rangeBoost += supportStats.supportRangeBoost;
    }

    return { damageBoost, rangeBoost };
  }

  private getTowerStatsWithoutSupport(tower: Tower): {
    damage: number;
    range: number;
    fireRate: number;
    splashRadius: number;
    slowPct: number;
    slowDuration: number;
    dotDamagePerSecond: number;
    dotDuration: number;
    supportDamageBoost: number;
    supportRangeBoost: number;
    incomePerWave: number;
  } {
    const levelIndex = tower.level - 1;
    const base = BALANCE.towers.stats[tower.kind];
    const damageBoost = this.globalDamageBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalDamageBoost.amount : 1;
    const rangeBoost = this.globalRangeBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1;
    const fireRateBoost = this.globalFireRateBoostRemaining > 0 ? 1 + BALANCE.abilities.stats.overclock.fireRateBoost : 1;

    return {
      damage: base.damage * BALANCE.towers.damageMultiplierByLevel[levelIndex] * damageBoost,
      range: base.range * BALANCE.towers.rangeMultiplierByLevel[levelIndex] * rangeBoost,
      fireRate: base.fireRate * BALANCE.towers.fireRateMultiplierByType[tower.kind][levelIndex] * fireRateBoost,
      splashRadius: base.splashRadius,
      slowPct: base.slowPct,
      slowDuration: base.slowDuration,
      dotDamagePerSecond: dotDamagePerSecondFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex] * damageBoost,
      dotDuration: dotDurationFor(tower.kind),
      supportDamageBoost: supportDamageBoostFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex],
      supportRangeBoost: supportRangeBoostFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex],
      incomePerWave: Math.round(incomePerWaveFor(tower.kind) * BALANCE.towers.damageMultiplierByLevel[levelIndex]),
    };
  }

  private updateToasts(dt: number): void {
    for (const toast of this.toasts) {
      toast.remaining -= dt;
    }
    this.toasts = this.toasts.filter((toast) => toast.remaining > 0);
  }

  private pushToast(text: string): void {
    this.toasts.push({
      id: this.idCounters.toast++,
      text,
      remaining: 2.2,
    });
  }

  private updateBuffs(dt: number): void {
    const combatActive = this.activeWaves.length > 0 || this.enemies.length > 0;
    if (!combatActive) {
      return;
    }

    if (this.globalDamageBoostRemaining > 0) {
      this.globalDamageBoostRemaining = Math.max(0, this.globalDamageBoostRemaining - dt);
    }
    if (this.globalRangeBoostRemaining > 0) {
      this.globalRangeBoostRemaining = Math.max(0, this.globalRangeBoostRemaining - dt);
    }
    if (this.globalFireRateBoostRemaining > 0) {
      this.globalFireRateBoostRemaining = Math.max(0, this.globalFireRateBoostRemaining - dt);
    }
  }

  private updateWaveSpawning(dt: number): void {
    if (this.activeWaves.length === 0) {
      return;
    }

    for (const wave of this.activeWaves) {
      wave.spawnTimer -= dt;

      while (wave.spawnTimer <= 0 && wave.queue.length > 0) {
        const kind = wave.queue.shift()!;
        this.spawnEnemy(kind, wave.index, wave.spawnedCount);
        wave.spawnedCount += 1;
        wave.spawnTimer += wave.def.spawnInterval;
      }

      if (wave.queue.length === 0) {
        wave.doneSpawning = true;
      }
    }
  }

  private spawnEnemy(kind: EnemyKind, waveIndex: number, spawnOrder: number): void {
    const routeIndex = spawnOrder % Math.max(1, this.paths.length);
    this.enemies.push(this.createEnemy(kind, routeIndex, waveIndex, -spawnOrder * SPAWN_STAGGER_DISTANCE));
  }

  private createEnemy(kind: EnemyKind, routeIndex: number, waveIndex: number, distance: number): Enemy {
    const base = BALANCE.enemies.stats[kind];
    const hpScale = BALANCE.enemies.hpMultiplierPerWave ** (kind === 'boss' ? waveIndex * 0.72 : waveIndex);
    const speedScale = BALANCE.enemies.speedMultiplierPerWave ** (kind === 'boss' ? waveIndex * 0.3 : waveIndex);
    const bountyScale = BALANCE.enemies.bountyMultiplierPerWave ** waveIndex;
    return {
      id: this.idCounters.enemy++,
      kind,
      routeIndex,
      waveIndex,
      distance,
      hp: Math.round(base.hp * hpScale),
      maxHp: Math.round(base.hp * hpScale),
      speed: base.speed * speedScale,
      bounty: Math.round(base.bounty * bountyScale),
      slowFactor: 1,
      slowRemaining: 0,
      dotDamagePerSecond: 0,
      dotRemaining: 0,
      alive: true,
      hitFlash: 0,
    };
  }

  private updateEnemies(dt: number): void {
    const survivors: Enemy[] = [];

    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      if (enemy.slowRemaining > 0) {
        enemy.slowRemaining -= dt;
        if (enemy.slowRemaining <= 0) {
          enemy.slowRemaining = 0;
          enemy.slowFactor = 1;
        }
      }

      if (enemy.dotRemaining > 0 && enemy.dotDamagePerSecond > 0) {
        this.applyDamage(enemy, enemy.dotDamagePerSecond * dt, false);
        enemy.dotRemaining = Math.max(0, enemy.dotRemaining - dt);
        if (enemy.dotRemaining <= 0) {
          enemy.dotDamagePerSecond = 0;
        }
      }

      if (!enemy.alive) {
        continue;
      }

      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 7);
      enemy.distance += enemy.speed * enemy.slowFactor * dt;

      const enemyPath = this.paths[enemy.routeIndex] ?? this.paths[0];
      if (enemy.distance >= enemyPath.totalLength) {
        const loops = Math.max(1, Math.floor(enemy.distance / enemyPath.totalLength));
        this.lives -= loops * livesLostForEnemy(enemy.kind);
        enemy.distance -= enemyPath.totalLength * loops;
        enemy.distance = Math.max(0, enemy.distance);
        enemy.hitFlash = 1;
      }

      survivors.push(enemy);
    }

    this.enemies = survivors;
  }

  private updateTowers(dt: number): void {
    if (this.enemies.length === 0) {
      for (const tower of this.towers) {
        tower.cooldown = Math.max(0, tower.cooldown - dt);
      }
      return;
    }

    const enemyPositions = new Map<number, Vec2>();
    for (const enemy of this.enemies) {
      const enemyPath = this.paths[enemy.routeIndex] ?? this.paths[0];
      enemyPositions.set(enemy.id, pointAtDistance(enemyPath, enemy.distance));
    }

    for (const tower of this.towers) {
      const stats = this.getTowerStats(tower);
      tower.cooldown -= dt;

      if (tower.cooldown > 0 || stats.fireRate <= 0 || stats.damage <= 0) {
        continue;
      }

      const target = this.findTargetForTower(tower, stats.range, enemyPositions);
      if (!target) {
        continue;
      }

      const targetPos = enemyPositions.get(target.id)!;

      if (tower.kind === 'pulse') {
        this.spawnBeam({ x: tower.x, y: tower.y }, targetPos, 'pulse');
        this.applyHit(target, stats.damage, 0, 0, 0, 0, 0, targetPos);
      } else if (tower.kind === 'chain') {
        this.applyChainStrike(tower, target, targetPos, stats.damage, enemyPositions);
      } else if (tower.kind === 'laser') {
        this.applyLaserStrike(tower, targetPos, stats.damage, enemyPositions);
      } else {
        this.projectiles.push({
          id: this.idCounters.projectile++,
          kind: tower.kind,
          x: tower.x,
          y: tower.y,
          targetId: target.id,
          speed: BALANCE.towers.stats[tower.kind].projectileSpeed,
          damage: stats.damage,
          splashRadius: stats.splashRadius,
          slowPct: stats.slowPct,
          slowDuration: stats.slowDuration,
          dotDamagePerSecond: stats.dotDamagePerSecond,
          dotDuration: stats.dotDuration,
          alive: true,
        });
      }

      tower.cooldown += 1 / stats.fireRate;
    }
  }

  private updateProjectiles(dt: number): void {
    if (this.projectiles.length === 0) {
      return;
    }

    const enemiesById = new Map<number, Enemy>();
    for (const enemy of this.enemies) {
      enemiesById.set(enemy.id, enemy);
    }

    for (const projectile of this.projectiles) {
      if (!projectile.alive) {
        continue;
      }

      const target = enemiesById.get(projectile.targetId);
      if (!target || !target.alive) {
        projectile.alive = false;
        continue;
      }

      const targetPath = this.paths[target.routeIndex] ?? this.paths[0];
      const targetPos = pointAtDistance(targetPath, target.distance);
      const dx = targetPos.x - projectile.x;
      const dy = targetPos.y - projectile.y;
      const distance = Math.hypot(dx, dy);
      const step = projectile.speed * dt;

      if (distance <= step || distance < 1) {
        this.applyHit(
          target,
          projectile.damage,
          projectile.splashRadius,
          projectile.slowPct,
          projectile.slowDuration,
          projectile.dotDamagePerSecond,
          projectile.dotDuration,
          targetPos,
        );
        projectile.alive = false;
      } else {
        projectile.x += (dx / distance) * step;
        projectile.y += (dy / distance) * step;
      }
    }

    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  private updateBeams(dt: number): void {
    if (this.beams.length === 0) {
      return;
    }

    for (const beam of this.beams) {
      beam.remaining -= dt;
    }

    this.beams = this.beams.filter((beam) => beam.remaining > 0);
  }

  private applyChainStrike(
    tower: Tower,
    initialTarget: Enemy,
    initialPos: Vec2,
    baseDamage: number,
    enemyPositions: Map<number, Vec2>,
  ): void {
    const hitIds = new Set<number>();
    let currentTarget: Enemy | null = initialTarget;
    let currentPos: Vec2 = initialPos;
    let fromPos: Vec2 = { x: tower.x, y: tower.y };
    let currentDamage = baseDamage;

    for (let i = 0; i < CHAIN_MAX_TARGETS; i += 1) {
      if (!currentTarget || !currentTarget.alive || hitIds.has(currentTarget.id)) {
        break;
      }

      this.spawnBeam(fromPos, currentPos, 'chain');
      this.applyDamage(currentTarget, currentDamage);
      hitIds.add(currentTarget.id);

      currentDamage *= CHAIN_DAMAGE_FALLOFF;
      if (i >= CHAIN_MAX_TARGETS - 1) {
        break;
      }

      const next = this.findClosestChainTarget(currentPos, hitIds, enemyPositions);
      if (!next) {
        break;
      }

      fromPos = currentPos;
      currentTarget = next.enemy;
      currentPos = next.pos;
    }
  }

  private findClosestChainTarget(
    fromPos: Vec2,
    hitIds: Set<number>,
    enemyPositions: Map<number, Vec2>,
  ): { enemy: Enemy; pos: Vec2 } | null {
    let selected: Enemy | null = null;
    let selectedPos: Vec2 | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const enemy of this.enemies) {
      if (!enemy.alive || hitIds.has(enemy.id)) {
        continue;
      }

      const enemyPath = this.paths[enemy.routeIndex] ?? this.paths[0];
      const pos = enemyPositions.get(enemy.id) ?? pointAtDistance(enemyPath, enemy.distance);
      const distance = Math.hypot(pos.x - fromPos.x, pos.y - fromPos.y);
      if (distance > CHAIN_JUMP_RANGE || distance >= bestDistance) {
        continue;
      }

      selected = enemy;
      selectedPos = pos;
      bestDistance = distance;
    }

    if (!selected || !selectedPos) {
      return null;
    }

    return { enemy: selected, pos: selectedPos };
  }

  private spawnBeam(from: Vec2, to: Vec2, kind: TowerKind): void {
    this.beams.push({
      id: this.idCounters.beam++,
      kind,
      from: { x: from.x, y: from.y },
      to: { x: to.x, y: to.y },
      remaining: BEAM_LIFETIME,
    });
  }

  private applyHit(
    target: Enemy,
    damage: number,
    splashRadius: number,
    slowPct: number,
    slowDuration: number,
    dotDamagePerSecond: number,
    dotDuration: number,
    hitPos: Vec2,
  ): void {
    if (splashRadius > 0) {
      for (const enemy of this.enemies) {
        const enemyPath = this.paths[enemy.routeIndex] ?? this.paths[0];
        const pos = pointAtDistance(enemyPath, enemy.distance);
        if (Math.hypot(pos.x - hitPos.x, pos.y - hitPos.y) <= splashRadius) {
          this.applyDamage(enemy, damage);
        }
      }
    } else {
      this.applyDamage(target, damage);
    }

    if (slowPct > 0 && slowDuration > 0 && target.alive) {
      target.slowFactor = clamp(1 - slowPct, 0.15, 1);
      target.slowRemaining = Math.max(target.slowRemaining, slowDuration);
    }

    if (dotDamagePerSecond > 0 && dotDuration > 0 && target.alive) {
      target.dotDamagePerSecond = Math.max(target.dotDamagePerSecond, dotDamagePerSecond);
      target.dotRemaining = Math.max(target.dotRemaining, dotDuration);
    }
  }

  private applyDamage(enemy: Enemy, damage: number, flash: boolean = true): void {
    if (!enemy.alive) {
      return;
    }

    enemy.hp -= damage;
    if (flash) {
      enemy.hitFlash = 1;
    }
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.awardEarnedMoney(enemy.bounty);
      this.score += Math.max(1, Math.floor(enemy.bounty * 4));
      this.addAbilityProgress('overclock', 1);
      if (enemy.kind === 'blossom') {
        this.spawnSplitPetals(enemy.routeIndex, enemy.waveIndex, enemy.distance);
      }
    }

    this.enemies = this.enemies.filter((candidate) => candidate.alive);
  }

  private applyLaserStrike(
    tower: Tower,
    targetPos: Vec2,
    damage: number,
    enemyPositions: Map<number, Vec2>,
  ): void {
    const horizontal = Math.abs(targetPos.x - tower.x) >= Math.abs(targetPos.y - tower.y);
    const beamFrom = horizontal ? { x: 0, y: tower.y } : { x: tower.x, y: 0 };
    const beamTo = horizontal ? { x: BALANCE.map.width, y: tower.y } : { x: tower.x, y: BALANCE.map.height };

    this.spawnBeam(beamFrom, beamTo, 'laser');

    for (const enemy of this.enemies) {
      const pos = enemyPositions.get(enemy.id);
      if (!pos) {
        continue;
      }

      const distanceToLine = horizontal ? Math.abs(pos.y - tower.y) : Math.abs(pos.x - tower.x);
      if (distanceToLine > LASER_LINE_HALF_WIDTH) {
        continue;
      }

      this.applyDamage(enemy, damage);
    }
  }

  private findTargetForTower(
    tower: Tower,
    range: number,
    enemyPositions: Map<number, Vec2>,
  ): Enemy | null {
    let selected: Enemy | null = null;
    let selectedValue = tower.targeting === 'first' ? -Infinity : Infinity;

    for (const enemy of this.enemies) {
      const pos = enemyPositions.get(enemy.id);
      if (!pos) {
        continue;
      }

      const dist = Math.hypot(pos.x - tower.x, pos.y - tower.y);
      if (dist > range) {
        continue;
      }

      if (tower.targeting === 'first') {
        if (enemy.distance > selectedValue) {
          selected = enemy;
          selectedValue = enemy.distance;
        }
      } else if (dist < selectedValue) {
        selected = enemy;
        selectedValue = dist;
      }
    }

    return selected;
  }

  private checkWaveCompletion(): void {
    if (this.activeWaves.length > 0) {
      const remaining: ActiveWave[] = [];

      for (const wave of this.activeWaves) {
        const hasWaveEnemies = this.enemies.some((enemy) => enemy.waveIndex === wave.index);
        if (!wave.doneSpawning || hasWaveEnemies) {
          remaining.push(wave);
          continue;
        }

        const baseReward = wave.def.waveReward + BALANCE.economy.betweenWaveBonus;
        const reward = Math.floor(baseReward * wave.rewardMultiplier);
        const interestEarned = Math.floor(this.money * this.interestRatePct);
        const supportIncome = this.getPassiveIncomePerWave();
        const bonusEarned = Math.max(0, reward - baseReward);
        this.bonusCredits += bonusEarned;
        this.awardEarnedMoney(reward + interestEarned + supportIncome);
        this.score += reward * 2 + interestEarned + supportIncome;
        const earlyTag = wave.rewardMultiplier > 1 ? ' (+5%)' : '';
        const bankTag = supportIncome > 0 ? ` +${supportIncome} bank` : '';
        this.pushToast(`Wave ${wave.index + 1} clear +${reward}${earlyTag} +${interestEarned} interest${bankTag}`);
        this.completedWaveCount += 1;
        this.addAbilityProgress('phaseWarp', 1);
        this.interestRatePct += BALANCE.economy.interestGainPerWavePct;
        this.maybeSpawnBonusOrb();
      }

      this.activeWaves = remaining;
    }

    if (
      !this.isEndlessMode() &&
      this.activeWaves.length === 0 &&
      this.enemies.length === 0 &&
      this.nextWaveIndex >= BALANCE.waves.length &&
      !this.victory
    ) {
      this.victory = true;
      this.pushToast('Sector secured. Victory.');
    }

    if (
      this.autoWaveEnabled &&
      this.activeWaves.length === 0 &&
      this.enemies.length === 0 &&
      this.hasMoreWaves() &&
      this.autoWaveCountdown <= 0
    ) {
      this.autoWaveCountdown = 1.1;
    }
  }

  private maybeSpawnBonusOrb(): void {
    if (this.bonusOrb || Math.random() > BALANCE.bonuses.spawnChancePerWave) {
      return;
    }

    const candidates: Vec2[] = [];
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const center = this.cellCenter(col, row);
        if (this.canPlaceTowerAt(center)) {
          candidates.push(center);
        }
      }
    }

    if (candidates.length === 0) {
      return;
    }

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    const types: BonusType[] = ['globalDamageBoost', 'globalRangeBoost', 'incomeBurst', 'livesBurst'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.bonusOrb = {
      x: pick.x,
      y: pick.y,
      remaining: BALANCE.bonuses.orbLifetime,
      type,
    };
  }

  private updateBonusOrb(dt: number): void {
    if (!this.bonusOrb) {
      return;
    }

    this.bonusOrb.remaining -= dt;
    if (this.bonusOrb.remaining <= 0) {
      this.bonusOrb = null;
    }
  }

  private tryCollectBonusOrb(pos: Vec2): boolean {
    if (!this.bonusOrb) {
      return false;
    }

    if (Math.hypot(pos.x - this.bonusOrb.x, pos.y - this.bonusOrb.y) > BONUS_ORB_RADIUS + 6) {
      return false;
    }

    this.applyBonus(this.bonusOrb.type);
    this.bonusOrb = null;
    return true;
  }

  private applyBonus(selected: BonusType): void {
    const buff = BALANCE.bonuses.buffs[selected];

    if (selected === 'globalDamageBoost') {
      this.globalDamageBoostRemaining = Math.max(this.globalDamageBoostRemaining, buff.duration);
    } else if (selected === 'globalRangeBoost') {
      this.globalRangeBoostRemaining = Math.max(this.globalRangeBoostRemaining, buff.duration);
    } else if (selected === 'incomeBurst') {
      this.awardEarnedMoney(buff.amount);
    } else if (selected === 'livesBurst') {
      this.lives += buff.amount;
    }

    this.pushToast(buff.label);
  }

  private updateAutoWave(dt: number): void {
    if (
      !this.autoWaveEnabled ||
      this.activeWaves.length > 0 ||
      this.enemies.length > 0 ||
      !this.hasMoreWaves()
    ) {
      return;
    }

    this.autoWaveCountdown -= dt;
    if (this.autoWaveCountdown <= 0) {
      this.startWave();
    }
  }

  private enqueueWave(earlySend: boolean): void {
    const waveIndex = this.nextWaveIndex;
    const def = this.getWaveDefinition(waveIndex);
    const queue: EnemyKind[] = [];

    for (const entry of def.mix) {
      for (let i = 0; i < entry.count; i += 1) {
        queue.push(entry.type);
      }
    }

    this.activeWaves.push({
      index: waveIndex,
      def,
      queue,
      spawnTimer: 0,
      doneSpawning: false,
      rewardMultiplier: earlySend ? EARLY_WAVE_REWARD_MULTIPLIER : 1,
      spawnedCount: 0,
    });

    if (queue.includes('boss')) {
      this.pushToast(`Boss wave ${waveIndex + 1} incoming`);
    }

    this.nextWaveIndex += 1;
    this.autoWaveCountdown = 0;
  }

  private getWaveDefinition(waveIndex: number): WaveDefinition {
    const base = BALANCE.waves[waveIndex % BALANCE.waves.length];
    if (!this.isEndlessMode()) {
      return base;
    }

    const cycle = Math.floor(waveIndex / BALANCE.waves.length);
    const countMultiplier = 1 + cycle * 0.22;
    const spawnInterval = Math.max(0.28, base.spawnInterval * (1 - cycle * 0.04));
    const waveReward = Math.max(8, Math.floor(base.waveReward * (1 + cycle * 0.18)));
    const mix = base.mix.map((entry) => ({
      type: entry.type,
      count: Math.max(1, Math.round(entry.count * countMultiplier)),
    }));

    if (waveIndex >= 6) {
      mix.push({
        type: 'blossom',
        count: 1 + Math.floor((waveIndex - 6) / 5),
      });
    }

    return {
      mix,
      spawnInterval,
      waveReward,
    };
  }

  private updateKamikazeFlow(): void {
    if (
      this.mode !== 'kamikaze' ||
      !this.kamikazeStarted ||
      this.paused ||
      this.gameOver ||
      this.victory
    ) {
      return;
    }

    while (this.activeWaves.length < this.maxConcurrentWaves()) {
      this.enqueueWave(false);
    }
  }

  private spawnSplitPetals(routeIndex: number, waveIndex: number, originDistance: number): void {
    for (let i = 0; i < 5; i += 1) {
      const offset = i * (this.gridSize * 0.22);
      this.enemies.push(this.createEnemy('petal', routeIndex, waveIndex, Math.max(0, originDistance - offset)));
    }
    this.pushToast('Petal Bloom split');
  }

  private canPlaceTowerAt(pos: Vec2): boolean {
    const snapped = this.snapToGrid(pos);
    if (!snapped) {
      return false;
    }

    const col = Math.round(snapped.x / this.gridSize);
    const row = Math.round(snapped.y / this.gridSize);
    if (this.pathCellSet.has(cellKey(col, row))) {
      return false;
    }

    for (const tower of this.towers) {
      if (Math.round(tower.x / this.gridSize) === col && Math.round(tower.y / this.gridSize) === row) {
        return false;
      }
    }

    return true;
  }

  private placeTower(kind: TowerKind, pos: Vec2): boolean {
    const snapped = this.snapToGrid(pos);
    if (!snapped) {
      return false;
    }

    const cost = BALANCE.towers.stats[kind].cost;
    if (this.money < cost) {
      this.pushToast('Insufficient credits');
      return false;
    }

    if (!this.canPlaceTowerAt(snapped)) {
      return false;
    }

    this.money -= cost;

    const tower: Tower = {
      id: this.idCounters.tower++,
      kind,
      x: snapped.x,
      y: snapped.y,
      level: 1,
      cooldown: 0,
      targeting: 'first',
    };

    this.towers.push(tower);
    this.selectedTowerId = tower.id;
    return true;
  }

  private findTowerAt(pos: Vec2): Tower | null {
    const snapped = this.snapToGrid(pos);
    if (!snapped) {
      return null;
    }

    for (const tower of this.towers) {
      if (tower.x === snapped.x && tower.y === snapped.y) {
        return tower;
      }
    }

    return null;
  }

  private snapToGrid(pos: Vec2): Vec2 | null {
    const col = Math.round(pos.x / this.gridSize);
    const row = Math.round(pos.y / this.gridSize);
    if (col < 1 || col > this.cols - 1 || row < 1 || row > this.rows - 1) {
      return null;
    }
    return this.cellCenter(col, row);
  }

  private cellCenter(col: number, row: number): Vec2 {
    return {
      x: col * this.gridSize,
      y: row * this.gridSize,
    };
  }

  private setActiveMap(index: number): void {
    this.mapIndex = index;
    const map = this.maps[this.mapIndex];
    this.paths = map.routes.map((route) => createPath(route.pathPoints));
    this.pathCellSet = new Set<string>();
    for (const route of map.routes) {
      const routeCells = pathCellsFromPoints(route.pathPoints, this.gridSize);
      for (const cell of routeCells) {
        this.pathCellSet.add(cell);
      }
    }
    this.pathCellList = Array.from(this.pathCellSet);
  }

  private createAbilityCooldowns(): Record<AbilityKind, AbilityChargeState> {
    return {
      overclock: {
        charges: BALANCE.abilities.stats.overclock.startingCharges,
        progress: 0,
      },
      ionBurst: {
        charges: BALANCE.abilities.stats.ionBurst.startingCharges,
        progress: 0,
      },
      phaseWarp: {
        charges: BALANCE.abilities.stats.phaseWarp.startingCharges,
        progress: 0,
      },
    };
  }

  private getAbilitySnapshots(): AbilitySnapshot[] {
    return BALANCE.abilities.order.map((kind) => {
      const ability = BALANCE.abilities.stats[kind];
      const state = this.abilityCooldowns[kind];
      const activeRemaining = kind === 'overclock' ? this.globalFireRateBoostRemaining : 0;
      const hasRequiredEnemies = !ability.requiresEnemies || this.enemies.length > 0;
      const hasRequiredTowers = !ability.requiresTowers || this.towers.length > 0;
      return {
        kind,
        charges: state.charges,
        maxCharges: ability.maxCharges,
        cooldownRemaining: 0,
        activeRemaining,
        available:
          !this.gameOver &&
          !this.victory &&
          state.charges > 0 &&
          hasRequiredEnemies &&
          hasRequiredTowers,
      };
    });
  }

  private getPassiveIncomePerWave(): number {
    return this.towers.reduce((total, tower) => total + this.getTowerStatsWithoutSupport(tower).incomePerWave, 0);
  }

  private awardEarnedMoney(amount: number): void {
    if (amount <= 0) {
      return;
    }

    this.money += amount;
    this.addAbilityProgress('ionBurst', amount);
  }

  private addAbilityProgress(kind: AbilityKind, amount: number): void {
    if (amount <= 0) {
      return;
    }

    const ability = BALANCE.abilities.stats[kind];
    const state = this.abilityCooldowns[kind];
    if (state.charges >= ability.maxCharges) {
      return;
    }

    state.progress += amount;
    let chargesGained = 0;

    while (state.charges < ability.maxCharges && state.progress >= ability.chargeThreshold) {
      state.progress -= ability.chargeThreshold;
      state.charges += 1;
      chargesGained += 1;
    }

    if (state.charges >= ability.maxCharges) {
      state.progress = 0;
    }

    if (chargesGained > 0) {
      this.pushToast(
        chargesGained > 1 ? `${ability.name} +${chargesGained} charges` : `${ability.name} charge ready`,
      );
    }
  }

  private hasMoreWaves(): boolean {
    return this.isEndlessMode() || this.nextWaveIndex < BALANCE.waves.length;
  }

  private isEndlessMode(): boolean {
    return this.mode === 'infinite' || this.mode === 'kamikaze';
  }

  private maxConcurrentWaves(): number {
    return this.mode === 'kamikaze' ? BALANCE.modes.kamikazeConcurrentWaves : 3;
  }

  private getModeStartMoney(): number {
    return this.mode === 'kamikaze' ? BALANCE.modes.kamikazeStartMoney : BALANCE.economy.startMoney;
  }
}
