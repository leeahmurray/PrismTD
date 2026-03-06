export type TowerKind = 'pulse' | 'nova' | 'frost' | 'chain';
export type EnemyKind = 'runner' | 'tank' | 'swarm' | 'blossom' | 'petal';
export type GameMode = 'standard' | 'infinite' | 'kamikaze';

export interface WaveMixEntry {
  type: EnemyKind;
  count: number;
}

export interface WaveDefinition {
  mix: WaveMixEntry[];
  spawnInterval: number;
  waveReward: number;
}

const MAP_LAYOUTS = [
  {
    name: 'Refraction Field',
    pathPoints: [
      { x: 30, y: 90 },
      { x: 210, y: 90 },
      { x: 210, y: 210 },
      { x: 420, y: 210 },
      { x: 420, y: 90 },
      { x: 690, y: 90 },
      { x: 690, y: 300 },
      { x: 510, y: 300 },
      { x: 510, y: 420 },
      { x: 810, y: 420 },
      { x: 810, y: 510 },
      { x: 930, y: 510 },
    ],
  },
  {
    name: 'Spectrum Valley',
    pathPoints: [
      { x: 30, y: 150 },
      { x: 270, y: 150 },
      { x: 270, y: 60 },
      { x: 540, y: 60 },
      { x: 540, y: 240 },
      { x: 360, y: 240 },
      { x: 360, y: 390 },
      { x: 660, y: 390 },
      { x: 660, y: 300 },
      { x: 900, y: 300 },
      { x: 900, y: 510 },
      { x: 930, y: 510 },
    ],
  },
  {
    name: 'Prism Pass',
    pathPoints: [
      { x: 30, y: 60 },
      { x: 180, y: 60 },
      { x: 180, y: 270 },
      { x: 420, y: 270 },
      { x: 420, y: 120 },
      { x: 600, y: 120 },
      { x: 600, y: 450 },
      { x: 330, y: 450 },
      { x: 330, y: 510 },
      { x: 930, y: 510 },
    ],
  },
  {
    name: 'Aurora Corridor',
    pathPoints: [
      { x: 30, y: 120 },
      { x: 300, y: 120 },
      { x: 300, y: 360 },
      { x: 150, y: 360 },
      { x: 150, y: 480 },
      { x: 540, y: 480 },
      { x: 540, y: 210 },
      { x: 780, y: 210 },
      { x: 780, y: 390 },
      { x: 930, y: 390 },
    ],
  },
  {
    name: 'Chromatic Basin',
    pathPoints: [
      { x: 30, y: 240 },
      { x: 240, y: 240 },
      { x: 240, y: 90 },
      { x: 450, y: 90 },
      { x: 450, y: 330 },
      { x: 180, y: 330 },
      { x: 180, y: 510 },
      { x: 750, y: 510 },
      { x: 750, y: 180 },
      { x: 930, y: 180 },
    ],
  },
  {
    name: 'Radiant Ridge',
    pathPoints: [
      { x: 30, y: 90 },
      { x: 390, y: 90 },
      { x: 390, y: 180 },
      { x: 120, y: 180 },
      { x: 120, y: 390 },
      { x: 480, y: 390 },
      { x: 480, y: 300 },
      { x: 780, y: 300 },
      { x: 780, y: 510 },
      { x: 930, y: 510 },
    ],
  },
  {
    name: 'Luminous Divide',
    pathPoints: [
      { x: 30, y: 480 },
      { x: 300, y: 480 },
      { x: 300, y: 330 },
      { x: 600, y: 330 },
      { x: 600, y: 510 },
      { x: 810, y: 510 },
      { x: 810, y: 120 },
      { x: 510, y: 120 },
      { x: 510, y: 60 },
      { x: 930, y: 60 },
    ],
  },
  {
    name: 'Photon Plains',
    pathPoints: [
      { x: 30, y: 300 },
      { x: 210, y: 300 },
      { x: 210, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 420 },
      { x: 690, y: 420 },
      { x: 690, y: 210 },
      { x: 840, y: 210 },
      { x: 840, y: 510 },
      { x: 930, y: 510 },
    ],
  },
  {
    name: 'Iridescent Canyon',
    pathPoints: [
      { x: 30, y: 60 },
      { x: 270, y: 60 },
      { x: 270, y: 300 },
      { x: 150, y: 300 },
      { x: 150, y: 480 },
      { x: 570, y: 480 },
      { x: 570, y: 180 },
      { x: 750, y: 180 },
      { x: 750, y: 390 },
      { x: 930, y: 390 },
    ],
  },
  {
    name: 'Spectral Crossing',
    pathPoints: [
      { x: 30, y: 150 },
      { x: 360, y: 150 },
      { x: 360, y: 60 },
      { x: 660, y: 60 },
      { x: 660, y: 270 },
      { x: 480, y: 270 },
      { x: 480, y: 450 },
      { x: 780, y: 450 },
      { x: 780, y: 330 },
      { x: 930, y: 330 },
    ],
  },
] as const;

export const BALANCE = {
  modes: {
    list: [
      { id: 'standard', name: 'Standard' },
      { id: 'infinite', name: 'Infinite' },
      { id: 'kamikaze', name: 'Kamikaze' },
    ] as const,
    kamikazeStartMoney: 5000,
    kamikazeConcurrentWaves: 3,
  },
  economy: {
    startMoney: 200,
    startLives: 20,
    sellRefundPct: 0.7,
    betweenWaveBonus: 25,
    interestPerWavePct: 0.03,
    interestGainPerWavePct: 0.02,
  },
  map: {
    width: 960,
    height: 540,
    gridSizePx: 30,
    maps: MAP_LAYOUTS,
    pathPoints: MAP_LAYOUTS[0].pathPoints,
    noBuildDistancePx: 18,
    towerSpacingPx: 30,
  },
  towers: {
    maxLevel: 10,
    upgradeCostMultiplierByLevel: [1.0, 0.75, 0.85, 1.0, 1.15, 1.35, 1.6, 1.9, 2.25, 2.65],
    damageMultiplierByLevel: [1.0, 1.15, 1.32, 1.52, 1.75, 2.02, 2.33, 2.68, 3.08, 3.55],
    rangeMultiplierByLevel: [1.0, 1.03, 1.06, 1.1, 1.14, 1.18, 1.23, 1.28, 1.34, 1.4],
    fireRateMultiplierByType: {
      pulse: [1.0, 1.04, 1.08, 1.12, 1.16, 1.2, 1.25, 1.3, 1.36, 1.42],
      nova: [1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.22, 1.26, 1.3],
      frost: [1.0, 1.02, 1.04, 1.06, 1.08, 1.1, 1.12, 1.14, 1.16, 1.18],
      chain: [1.0, 1.03, 1.06, 1.09, 1.12, 1.15, 1.18, 1.22, 1.26, 1.3],
    },
    stats: {
      pulse: {
        name: 'Pulse Node',
        cost: 60,
        range: 115,
        fireRate: 6,
        damage: 6,
        splashRadius: 0,
        slowPct: 0,
        slowDuration: 0,
        projectileSpeed: 900,
      },
      nova: {
        name: 'Nova Lance',
        cost: 110,
        range: 95,
        fireRate: 1.1,
        damage: 28,
        splashRadius: 22,
        slowPct: 0,
        slowDuration: 0,
        projectileSpeed: 280,
      },
      frost: {
        name: 'Frost Arc',
        cost: 90,
        range: 105,
        fireRate: 1.8,
        damage: 5,
        splashRadius: 0,
        slowPct: 0.45,
        slowDuration: 1,
        projectileSpeed: 320,
      },
      chain: {
        name: 'Prism Link',
        cost: 145,
        range: 118,
        fireRate: 1.25,
        damage: 11,
        splashRadius: 0,
        slowPct: 0,
        slowDuration: 0,
        projectileSpeed: 0,
      },
    },
  },
  enemies: {
    hpMultiplierPerWave: 1.12,
    speedMultiplierPerWave: 1.01,
    bountyMultiplierPerWave: 1.04,
    stats: {
      runner: {
        name: 'Glint Runner',
        hp: 40,
        speed: 78,
        bounty: 6,
      },
      tank: {
        name: 'Bastion Core',
        hp: 150,
        speed: 42,
        bounty: 14,
      },
      swarm: {
        name: 'Shard Swarm',
        hp: 70,
        speed: 62,
        bounty: 8,
      },
      blossom: {
        name: 'Petal Bloom',
        hp: 120,
        speed: 52,
        bounty: 12,
      },
      petal: {
        name: 'Bloom Shard',
        hp: 24,
        speed: 92,
        bounty: 2,
      },
    },
  },
  waves: [
    { mix: [{ type: 'runner', count: 10 }], spawnInterval: 0.7, waveReward: 8 },
    { mix: [{ type: 'runner', count: 14 }], spawnInterval: 0.6, waveReward: 10 },
    {
      mix: [
        { type: 'runner', count: 10 },
        { type: 'swarm', count: 4 },
      ],
      spawnInterval: 0.55,
      waveReward: 14,
    },
    {
      mix: [
        { type: 'runner', count: 18 },
        { type: 'swarm', count: 6 },
      ],
      spawnInterval: 0.5,
      waveReward: 16,
    },
    {
      mix: [
        { type: 'tank', count: 8 },
        { type: 'runner', count: 10 },
      ],
      spawnInterval: 0.65,
      waveReward: 20,
    },
    {
      mix: [
        { type: 'tank', count: 10 },
        { type: 'swarm', count: 10 },
      ],
      spawnInterval: 0.6,
      waveReward: 24,
    },
    { mix: [{ type: 'runner', count: 26 }], spawnInterval: 0.45, waveReward: 28 },
    {
      mix: [
        { type: 'swarm', count: 14 },
        { type: 'runner', count: 14 },
      ],
      spawnInterval: 0.45,
      waveReward: 34,
    },
    {
      mix: [
        { type: 'tank', count: 16 },
        { type: 'runner', count: 10 },
        { type: 'blossom', count: 1 },
      ],
      spawnInterval: 0.6,
      waveReward: 42,
    },
    {
      mix: [
        { type: 'tank', count: 20 },
        { type: 'swarm', count: 20 },
        { type: 'blossom', count: 2 },
      ],
      spawnInterval: 0.5,
      waveReward: 50,
    },
  ] as WaveDefinition[],
  bonuses: {
    spawnChancePerWave: 0.35,
    orbLifetime: 10,
    buffs: {
      globalDamageBoost: { amount: 0.2, duration: 12, label: 'Overdrive: +20% damage (12s)' },
      globalRangeBoost: { amount: 0.15, duration: 12, label: 'Longshot: +15% range (12s)' },
      incomeBurst: { amount: 120, duration: 0, label: 'Credit Burst: +120' },
      livesBurst: { amount: 3, duration: 0, label: 'Hull Patch: +3 lives' },
    },
  },
} as const;

export type Balance = typeof BALANCE;
