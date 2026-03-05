import './style.css';
import { BALANCE } from './balance';
import { Game } from './game/game';
import type { Vec2 } from './game/types';
import { render } from './render/renderer';
import { UI } from './ui/ui';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing app root');
}

app.innerHTML = `
  <div class="galaxy-bg" aria-hidden="true">
    <div class="galaxy-nebula"></div>
    <div class="galaxy-stars near"></div>
    <div class="galaxy-stars far"></div>
    <div class="shooting-stars">
      <span class="shooting-star s1"></span>
      <span class="shooting-star s2"></span>
      <span class="shooting-star s3"></span>
      <span class="shooting-star s4"></span>
    </div>
  </div>
  <div class="app-shell">
    <div class="site-menu-bar">
      <div class="site-menu-inner">
        <span class="site-menu-item">Home</span>
        <span class="site-menu-item">Play</span>
        <span class="site-menu-item">Maps</span>
        <span class="site-menu-item">Towers</span>
        <span class="site-menu-item">Profile</span>
        <span class="site-menu-item">Login</span>
      </div>
    </div>
    <div class="game-layout">
      <div class="left-column">
        <div id="ui-header" class="ui-header"></div>
        <div class="canvas-shell">
          <canvas id="game-canvas" width="960" height="540"></canvas>
        </div>
      </div>
      <div id="ui-sidebar" class="ui-sidebar"></div>
    </div>
  </div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const headerRoot = document.querySelector<HTMLDivElement>('#ui-header');
const sidebarRoot = document.querySelector<HTMLDivElement>('#ui-sidebar');
if (!canvas || !headerRoot || !sidebarRoot) {
  throw new Error('Missing game nodes');
}

const gameCanvas = canvas;
const ctx = gameCanvas.getContext('2d');
if (!ctx) {
  throw new Error('Canvas rendering context unavailable');
}
const renderContext = ctx;

const game = new Game();

interface MusicTrack {
  id: string;
  title: string;
  file: string;
}

function setupBackgroundMusic(): {
  prevTrack: () => void;
  nextTrack: () => void;
  togglePlayPause: () => boolean;
  ensurePlaying: () => void;
  stop: () => void;
  getState: () => { isPlaying: boolean; currentTrackTitle: string; tracks: Array<{ id: string; title: string }> };
} {
  const tracks: MusicTrack[] = [
    { id: 'fields', title: 'Fields of Our Mind', file: '/audio/bgm/FIleds of Our Mind.wav' },
    { id: 'analog-one', title: 'Analog One', file: '/audio/bgm/Analog One.wav' },
    { id: 'analog-two', title: 'Analog Two', file: '/audio/bgm/Analog Two.mp3' },
    { id: 'analog-three', title: 'Analog Three', file: '/audio/bgm/Analog Three.mp3' },
    { id: 'sunset', title: 'Sunset', file: '/audio/bgm/Sunset.wav' },
    { id: 'watercaves', title: 'WaterCaves', file: '/audio/bgm/WaterCaves.wav' },
  ];
  let trackIndex = 0;
  const music = new Audio(encodeURI(tracks[trackIndex].file));
  music.loop = true;
  music.preload = 'auto';
  music.setAttribute('playsinline', 'true');
  music.volume = 0;
  let isPlaying = true;

  const targetVolume = 0.36;
  const fadeDurationMs = 4500;
  let playSucceeded = false;

  const fadeIn = (): void => {
    const fadeStart = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - fadeStart) / fadeDurationMs);
      music.volume = targetVolume * t;
      if (t < 1 && playSucceeded) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const clearUnlockListeners = (): void => {
    window.removeEventListener('pointerdown', interactionStart);
    window.removeEventListener('keydown', interactionStart);
    window.removeEventListener('mousedown', interactionStart);
    window.removeEventListener('touchstart', interactionStart);
  };

  const tryStart = (resetTime: boolean): void => {
    if (!isPlaying) {
      return;
    }
    if (resetTime) {
      music.currentTime = 0;
      music.volume = 0;
    }
    const playPromise = music.play();
    if (playPromise === undefined) {
      const shouldFade = resetTime || !playSucceeded;
      playSucceeded = true;
      if (shouldFade) {
        fadeIn();
      }
      clearUnlockListeners();
      return;
    }

    void playPromise
      .then(() => {
        const shouldFade = resetTime || !playSucceeded;
        playSucceeded = true;
        if (shouldFade) {
          fadeIn();
        }
        clearUnlockListeners();
      })
      .catch(() => {});
  };

  const interactionStart = (): void => {
    if (isPlaying) {
      tryStart(false);
    }
  };

  tryStart(true);
  window.addEventListener('pointerdown', interactionStart);
  window.addEventListener('keydown', interactionStart);
  window.addEventListener('mousedown', interactionStart);
  window.addEventListener('touchstart', interactionStart);

  const applyTrack = (index: number): void => {
    trackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[trackIndex];
    music.src = encodeURI(track.file);
    music.load();
    playSucceeded = false;
    if (isPlaying) {
      tryStart(true);
    }
  };

  return {
    prevTrack: () => {
      applyTrack(trackIndex - 1);
    },
    nextTrack: () => {
      applyTrack(trackIndex + 1);
    },
    togglePlayPause: () => {
      isPlaying = !isPlaying;
      if (!isPlaying) {
        music.pause();
        return false;
      }
      tryStart(false);
      return true;
    },
    ensurePlaying: () => {
      if (!isPlaying) {
        return;
      }
      tryStart(false);
    },
    stop: () => {
      isPlaying = false;
      music.pause();
      music.currentTime = 0;
      playSucceeded = false;
    },
    getState: () => ({
      isPlaying,
      currentTrackTitle: tracks[trackIndex].title,
      tracks: tracks.map((track) => ({ id: track.id, title: track.title })),
    }),
  };
}

const musicController = setupBackgroundMusic();

function setupUiSfx(): {
  playHover: () => void;
  playPlace: () => void;
  playAction: () => void;
  playOff: () => void;
  playOn: () => void;
  playMapCycle: () => void;
  playInsufficient: () => void;
  playMoney: () => void;
  playPowerupAvailable: () => void;
  playPowerupClaimed: () => void;
  playVictory: () => void;
  playDefeat: () => void;
} {
  const hoverSound = new Audio('/audio/sfx/menu_13.wav');
  hoverSound.preload = 'auto';
  hoverSound.volume = 0.35;

  const placeSound = new Audio('/audio/sfx/menu_6.wav');
  placeSound.preload = 'auto';
  placeSound.volume = 0.45;

  const actionSound = new Audio('/audio/sfx/menu_26.wav');
  actionSound.preload = 'auto';
  actionSound.volume = 0.4;

  const offSound = new Audio('/audio/sfx/menu_23.wav');
  offSound.preload = 'auto';
  offSound.volume = 0.42;

  const onSound = new Audio('/audio/sfx/menu_1.wav');
  onSound.preload = 'auto';
  onSound.volume = 0.42;

  const mapCycleSound = new Audio('/audio/sfx/menu_27.wav');
  mapCycleSound.preload = 'auto';
  mapCycleSound.volume = 0.4;

  const insufficientSound = new Audio('/audio/sfx/menu_19.wav');
  insufficientSound.preload = 'auto';
  insufficientSound.volume = 0.45;

  const moneySound = new Audio('/audio/sfx/money_1.wav');
  moneySound.preload = 'auto';
  moneySound.volume = 0.5;

  const powerupAvailableSound = new Audio('/audio/sfx/powerup.wav');
  powerupAvailableSound.preload = 'auto';
  powerupAvailableSound.volume = 0.5;

  const powerupClaimedSound = new Audio('/audio/sfx/powerupclaimed.wav');
  powerupClaimedSound.preload = 'auto';
  powerupClaimedSound.volume = 0.5;

  const victorySound = new Audio('/audio/sfx/victory.wav');
  victorySound.preload = 'auto';
  victorySound.volume = 0.55;

  const defeatSound = new Audio('/audio/sfx/defeat.wav');
  defeatSound.preload = 'auto';
  defeatSound.volume = 0.55;

  let unlocked = false;
  const unlock = (): void => {
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  const play = (src: HTMLAudioElement): void => {
    if (!unlocked) {
      return;
    }
    const instance = src.cloneNode(true) as HTMLAudioElement;
    instance.volume = src.volume;
    void instance.play().catch(() => {});
  };

  return {
    playHover: () => play(hoverSound),
    playPlace: () => play(placeSound),
    playAction: () => play(actionSound),
    playOff: () => play(offSound),
    playOn: () => play(onSound),
    playMapCycle: () => play(mapCycleSound),
    playInsufficient: () => play(insufficientSound),
    playMoney: () => play(moneySound),
    playPowerupAvailable: () => play(powerupAvailableSound),
    playPowerupClaimed: () => play(powerupClaimedSound),
    playVictory: () => play(victorySound),
    playDefeat: () => play(defeatSound),
  };
}

const uiSfx = setupUiSfx();

const ui = new UI(headerRoot, sidebarRoot, {
  onBuildSelect: (kind) => {
    const snapshot = game.getSnapshot();
    game.setPlacement(snapshot.placingTowerKind === kind ? null : kind);
  },
  onCycleMode: (delta) => game.cycleMode(delta),
  onCycleMap: (delta) => game.cycleMap(delta),
  onStartWave: () => {
    musicController.ensurePlaying();
    game.startWave();
  },
  onQueueWave: () => {
    musicController.ensurePlaying();
    game.sendNextWaveEarly();
  },
  onToggleSpeed: () => {
    musicController.ensurePlaying();
    game.toggleSpeed();
  },
  onTogglePause: () => {
    musicController.ensurePlaying();
    game.togglePause();
    const nowPaused = game.getSnapshot().paused;
    if (!nowPaused) {
      uiSfx.playOff();
    }
  },
  onUpgradeTower: () => {
    const selected = game.getSelectedTower();
    if (!selected) {
      return;
    }

    const snapshot = game.getSnapshot();
    const upgradeCost = game.getUpgradeCost(selected.kind, selected.level);
    if (upgradeCost > 0 && snapshot.money < upgradeCost) {
      uiSfx.playInsufficient();
    }

    game.upgradeSelectedTower();
  },
  onSellTower: () => game.sellSelectedTower(),
  onToggleTargeting: () => game.toggleSelectedTargeting(),
  onRestart: () => game.restart(),
  onSetAutoWaveEnabled: (enabled) => {
    game.setAutoWaveEnabled(enabled);
    enabled ? uiSfx.playOn() : uiSfx.playOff();
  },
  onMusicPrev: () => musicController.prevTrack(),
  onMusicNext: () => musicController.nextTrack(),
  onToggleMusicPlayPause: () => {
    const playing = musicController.togglePlayPause();
    playing ? uiSfx.playOn() : uiSfx.playOff();
    return playing;
  },
  onStopMusic: () => {
    musicController.stop();
    uiSfx.playOff();
  },
  getMusicState: () => musicController.getState(),
});

app.addEventListener(
  'pointerdown',
  () => {
    musicController.ensurePlaying();
  },
  true,
);

let lastHoverElement: Element | null = null;
app.addEventListener(
  'pointerover',
  (event) => {
    const target = event.target as HTMLElement | null;
    const interactive = target?.closest('button, select');
    if (!interactive) {
      lastHoverElement = null;
      return;
    }
    if (
      interactive.id === 'upgrade-btn' ||
      interactive.id === 'sell-btn' ||
      interactive.id === 'targeting-btn'
    ) {
      return;
    }
    if (interactive === lastHoverElement) {
      return;
    }
    lastHoverElement = interactive;
    uiSfx.playHover();
  },
  true,
);

app.addEventListener(
  'click',
  (event) => {
    const target = event.target as HTMLElement | null;
    const cycleButton = target?.closest('.map-nav-btn, .mode-nav-btn');
    if (cycleButton) {
      uiSfx.playMapCycle();
    }
    const actionButton = target?.closest<HTMLButtonElement>('#upgrade-btn, #sell-btn, #targeting-btn');
    if (actionButton) {
      uiSfx.playAction();
    }
  },
  true,
);

function toWorldPosition(event: MouseEvent): Vec2 {
  const rect = gameCanvas.getBoundingClientRect();
  const scaleX = gameCanvas.width / rect.width;
  const scaleY = gameCanvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

gameCanvas.addEventListener('mousemove', (event) => {
  game.setMouseWorld(toWorldPosition(event));
});

gameCanvas.addEventListener('mouseleave', () => {
  game.setMouseWorld(null);
});

gameCanvas.addEventListener('click', (event) => {
  const before = game.getSnapshot();
  if (before.victory || before.gameOver) {
    game.restart();
    return;
  }
  const placed = game.onCanvasClick(toWorldPosition(event));
  const after = game.getSnapshot();
  if (before.bonusOrb && !after.bonusOrb) {
    uiSfx.playPowerupClaimed();
  }
  if (placed) {
    uiSfx.playPlace();
    return;
  }

  if (before.placingTowerKind) {
    const cost = before.placingTowerKind ? BALANCE.towers.stats[before.placingTowerKind].cost : 0;
    if (before.money < cost) {
      uiSfx.playInsufficient();
    }
  }
});

gameCanvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  game.onCanvasRightClick();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    game.onCanvasRightClick();
  }
});

window.addEventListener('contextmenu', (event) => {
  const snapshot = game.getSnapshot();
  if (snapshot.placingTowerKind) {
    event.preventDefault();
    game.onCanvasRightClick();
  }
});

let lastTime = performance.now();
let accumulator = 0;
const fixedStep = 1 / 60;
let lastOutcome: 'victory' | 'defeat' | null = null;
let lastCompletedWaves = 0;
let lastBonusOrbVisible = false;

function frame(now: number): void {
  const rawDelta = (now - lastTime) / 1000;
  lastTime = now;
  accumulator += Math.min(rawDelta, 0.25);

  while (accumulator >= fixedStep) {
    game.update(fixedStep);
    accumulator -= fixedStep;
  }

  const snapshot = game.getSnapshot();

  if (!lastBonusOrbVisible && !!snapshot.bonusOrb) {
    uiSfx.playPowerupAvailable();
  }
  lastBonusOrbVisible = !!snapshot.bonusOrb;

  if (snapshot.completedWaves > lastCompletedWaves) {
    uiSfx.playMoney();
  }
  lastCompletedWaves = snapshot.completedWaves;

  const outcome: 'victory' | 'defeat' | null = snapshot.victory ? 'victory' : snapshot.gameOver ? 'defeat' : null;
  if (outcome !== lastOutcome) {
    if (outcome === 'victory') {
      uiSfx.playVictory();
    } else if (outcome === 'defeat') {
      uiSfx.playDefeat();
    }
    lastOutcome = outcome;
  }

  render(renderContext, snapshot, now);
  ui.update(snapshot, game);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
