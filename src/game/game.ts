import { BALANCE, type EnemyKind, type GameMode, type TowerKind, type WaveDefinition } from '../balance';
import { cellKey, createPath, pathCellsFromPoints, pointAtDistance, type PathData } from './path';
import type {
  ActiveWave,
  Beam,
  BonusOrb,
  BonusType,
  Enemy,
  GameSnapshot,
  Projectile,
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
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Game {
  private path: PathData;

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

  private autoWaveEnabled = false;

  private autoWaveCountdown = 0;

  private kamikazeStarted = false;

  private idCounters = {
    enemy: 1,
    tower: 1,
    projectile: 1,
    toast: 1,
    beam: 1,
  };

  constructor() {
    this.path = createPath(BALANCE.map.maps[0].pathPoints);
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
    this.autoWaveEnabled = false;
    this.autoWaveCountdown = 0;
    this.kamikazeStarted = false;
    this.idCounters = { enemy: 1, tower: 1, projectile: 1, toast: 1, beam: 1 };
  }

  getSnapshot(): GameSnapshot {
    const mapDef = BALANCE.map.maps[this.mapIndex];
    return {
      mode: this.mode,
      mapIndex: this.mapIndex,
      mapName: mapDef.name,
      width: BALANCE.map.width,
      height: BALANCE.map.height,
      gridSize: this.gridSize,
      cols: this.cols,
      rows: this.rows,
      pathPoints: this.path.points,
      pathCells: this.pathCellList,
      pathLength: this.path.totalLength,
      enemies: this.enemies,
      towers: this.towers,
      projectiles: this.projectiles,
      beams: this.beams,
      bonusOrb: this.bonusOrb,
      toasts: this.toasts,
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

  cycleMap(delta: number): void {
    const total = BALANCE.map.maps.length;
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

  setMapIndex(index: number): void {
    const clamped = Math.max(0, Math.min(index, BALANCE.map.maps.length - 1));
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
  } {
    const levelIndex = tower.level - 1;
    const base = BALANCE.towers.stats[tower.kind];
    const damageBoost = this.globalDamageBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalDamageBoost.amount : 1;
    const rangeBoost = this.globalRangeBoostRemaining > 0 ? 1 + BALANCE.bonuses.buffs.globalRangeBoost.amount : 1;

    const damage =
      base.damage * BALANCE.towers.damageMultiplierByLevel[levelIndex] * damageBoost;
    const range = base.range * BALANCE.towers.rangeMultiplierByLevel[levelIndex] * rangeBoost;
    const fireRate =
      base.fireRate * BALANCE.towers.fireRateMultiplierByType[tower.kind][levelIndex];

    return {
      damage,
      range,
      fireRate,
      splashRadius: base.splashRadius,
      slowPct: base.slowPct,
      slowDuration: base.slowDuration,
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
    if (this.globalDamageBoostRemaining > 0) {
      this.globalDamageBoostRemaining = Math.max(0, this.globalDamageBoostRemaining - dt);
    }
    if (this.globalRangeBoostRemaining > 0) {
      this.globalRangeBoostRemaining = Math.max(0, this.globalRangeBoostRemaining - dt);
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
    this.enemies.push(this.createEnemy(kind, waveIndex, -spawnOrder * SPAWN_STAGGER_DISTANCE));
  }

  private createEnemy(kind: EnemyKind, waveIndex: number, distance: number): Enemy {
    const base = BALANCE.enemies.stats[kind];
    const hpScale = BALANCE.enemies.hpMultiplierPerWave ** waveIndex;
    const speedScale = BALANCE.enemies.speedMultiplierPerWave ** waveIndex;
    const bountyScale = BALANCE.enemies.bountyMultiplierPerWave ** waveIndex;
    return {
      id: this.idCounters.enemy++,
      kind,
      waveIndex,
      distance,
      hp: Math.round(base.hp * hpScale),
      maxHp: Math.round(base.hp * hpScale),
      speed: base.speed * speedScale,
      bounty: Math.round(base.bounty * bountyScale),
      slowFactor: 1,
      slowRemaining: 0,
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

      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 7);
      enemy.distance += enemy.speed * enemy.slowFactor * dt;

      if (enemy.distance >= this.path.totalLength) {
        const loops = Math.max(1, Math.floor(enemy.distance / this.path.totalLength));
        this.lives -= loops;
        enemy.distance -= this.path.totalLength * loops;
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
      enemyPositions.set(enemy.id, pointAtDistance(this.path, enemy.distance));
    }

    for (const tower of this.towers) {
      const stats = this.getTowerStats(tower);
      tower.cooldown -= dt;

      if (tower.cooldown > 0) {
        continue;
      }

      const target = this.findTargetForTower(tower, stats.range, enemyPositions);
      if (!target) {
        continue;
      }

      const targetPos = enemyPositions.get(target.id)!;

      if (tower.kind === 'pulse') {
        this.spawnBeam({ x: tower.x, y: tower.y }, targetPos, 'pulse');
        this.applyHit(target, stats.damage, 0, 0, 0, targetPos);
      } else if (tower.kind === 'chain') {
        this.applyChainStrike(tower, target, targetPos, stats.damage, enemyPositions);
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

      const targetPos = pointAtDistance(this.path, target.distance);
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

      const pos = enemyPositions.get(enemy.id) ?? pointAtDistance(this.path, enemy.distance);
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
    hitPos: Vec2,
  ): void {
    if (splashRadius > 0) {
      for (const enemy of this.enemies) {
        const pos = pointAtDistance(this.path, enemy.distance);
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
  }

  private applyDamage(enemy: Enemy, damage: number): void {
    if (!enemy.alive) {
      return;
    }

    enemy.hp -= damage;
    enemy.hitFlash = 1;
    if (enemy.hp <= 0) {
      enemy.alive = false;
      this.money += enemy.bounty;
      this.score += Math.max(1, Math.floor(enemy.bounty * 4));
      if (enemy.kind === 'blossom') {
        this.spawnSplitPetals(enemy.waveIndex, enemy.distance);
      }
    }

    this.enemies = this.enemies.filter((candidate) => candidate.alive);
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
        const bonusEarned = Math.max(0, reward - baseReward);
        this.bonusCredits += bonusEarned;
        this.money += reward + interestEarned;
        this.score += reward * 2 + interestEarned;
        const earlyTag = wave.rewardMultiplier > 1 ? ' (+5%)' : '';
        this.pushToast(`Wave ${wave.index + 1} clear +${reward}${earlyTag} +${interestEarned} interest`);
        this.completedWaveCount += 1;
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
      this.money += buff.amount;
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

  private spawnSplitPetals(waveIndex: number, originDistance: number): void {
    for (let i = 0; i < 5; i += 1) {
      const offset = i * (this.gridSize * 0.22);
      this.enemies.push(this.createEnemy('petal', waveIndex, Math.max(0, originDistance - offset)));
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
    const map = BALANCE.map.maps[this.mapIndex];
    this.path = createPath(map.pathPoints);
    this.pathCellSet = pathCellsFromPoints(map.pathPoints, this.gridSize);
    this.pathCellList = Array.from(this.pathCellSet);
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
