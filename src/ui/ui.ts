import { BALANCE, type GameMode, type TowerKind } from '../balance';
import { Game } from '../game/game';
import type { GameSnapshot } from '../game/types';

interface MusicTrackOption {
  id: string;
  title: string;
}

interface MusicState {
  isPlaying: boolean;
  currentTrackTitle: string;
  tracks: MusicTrackOption[];
}

interface UIActions {
  onBuildSelect: (kind: TowerKind | null) => void;
  onCycleMode: (delta: number) => void;
  onCycleMap: (delta: number) => void;
  onStartWave: () => void;
  onQueueWave: () => void;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onUpgradeTower: () => void;
  onSellTower: () => void;
  onToggleTargeting: () => void;
  onRestart: () => void;
  onSetAutoWaveEnabled: (enabled: boolean) => void;
  onMusicPrev: () => void;
  onMusicNext: () => void;
  onToggleMusicPlayPause: () => boolean;
  onStopMusic: () => void;
  getMusicState: () => MusicState;
}

export class UI {
  private headerRoot: HTMLElement;

  private sidebarRoot: HTMLElement;

  private actions: UIActions;

  private moneyEl: HTMLSpanElement;

  private interestEl: HTMLSpanElement;

  private scoreEl: HTMLSpanElement;

  private livesEl: HTMLSpanElement;

  private levelEl: HTMLSpanElement;

  private bonusEl: HTMLSpanElement;

  private speedEl: HTMLButtonElement;

  private modeNameEl: HTMLSpanElement;

  private mapNameEl: HTMLSpanElement;

  private pauseEl: HTMLButtonElement;

  private startWaveEl: HTMLButtonElement;

  private restartEl: HTMLButtonElement;

  private musicTitleEl: HTMLSpanElement;

  private musicPlayPauseEl: HTMLButtonElement;

  private autoWaveEl: HTMLButtonElement;

  private queueBars: HTMLSpanElement[] = [];

  private buildButtons: Record<TowerKind, HTMLButtonElement>;

  private selectedPanel: HTMLDivElement;

  private toastsEl: HTMLDivElement;

  private mapConfirmEl: HTMLDivElement;

  private pendingMapDelta: number | null = null;

  private pausedByMapPrompt = false;

  private latestSnapshot: GameSnapshot | null = null;

  private visibleToastId: number | null = null;

  private mapIndex = 0;

  private mode: GameMode = 'standard';

  private readonly modeNamesById = new Map(BALANCE.modes.list.map((mode) => [mode.id, mode.name]));

  private readonly maps = BALANCE.map.maps.map((map) => map.name);

  constructor(headerRoot: HTMLElement, sidebarRoot: HTMLElement, actions: UIActions) {
    this.headerRoot = headerRoot;
    this.sidebarRoot = sidebarRoot;
    this.actions = actions;

    this.headerRoot.innerHTML = '';
    this.sidebarRoot.innerHTML = '';

    const logoCard = document.createElement('div');
    logoCard.className = 'logo-card';
    logoCard.innerHTML = '<img class="logo-image" src="/horizlogo.png" alt="Prism TD logo" />';

    const statusCard = document.createElement('div');
    statusCard.className = 'status-card';

    this.moneyEl = document.createElement('span');
    this.interestEl = document.createElement('span');
    this.scoreEl = document.createElement('span');
    this.livesEl = document.createElement('span');
    this.levelEl = document.createElement('span');
    this.bonusEl = document.createElement('span');

    const hudTable = document.createElement('div');
    hudTable.className = 'hud-table';
    hudTable.append(
      this.createHudCell('MONEY', this.moneyEl, 'money'),
      this.createHudCell('LIVES', this.livesEl, 'lives'),
      this.createHudCell('INTEREST', this.interestEl, 'interest'),
      this.createHudCell('LEVEL', this.levelEl, 'level'),
      this.createHudCell('SCORE', this.scoreEl, 'score'),
      this.createHudCell('BONUS', this.bonusEl, 'bonus'),
    );

    this.speedEl = document.createElement('button');
    this.speedEl.className = 'status-mini-btn utility-btn speed-square';
    this.speedEl.textContent = '1x';
    this.bindButtonPress(this.speedEl, () => this.actions.onToggleSpeed());

    const modeControl = document.createElement('div');
    modeControl.className = 'mode-control';

    const modeLabel = document.createElement('span');
    modeLabel.className = 'map-label';
    modeLabel.textContent = 'Mode';

    const modePrev = document.createElement('button');
    modePrev.className = 'mode-nav-btn';
    modePrev.textContent = '‹';
    this.bindButtonPress(modePrev, () => this.actions.onCycleMode(-1));

    this.modeNameEl = document.createElement('span');
    this.modeNameEl.className = 'mode-name';

    const modeNext = document.createElement('button');
    modeNext.className = 'mode-nav-btn';
    modeNext.textContent = '›';
    this.bindButtonPress(modeNext, () => this.actions.onCycleMode(1));

    modeControl.append(modeLabel, modePrev, this.modeNameEl, modeNext);

    const mapControl = document.createElement('div');
    mapControl.className = 'map-control';

    const mapLabel = document.createElement('span');
    mapLabel.className = 'map-label';
    mapLabel.textContent = 'Map';

    const mapPrev = document.createElement('button');
    mapPrev.className = 'map-nav-btn';
    mapPrev.textContent = '‹';
    this.bindButtonPress(mapPrev, () => this.cycleMap(-1));

    this.mapNameEl = document.createElement('span');
    this.mapNameEl.className = 'map-name';

    const mapNext = document.createElement('button');
    mapNext.className = 'map-nav-btn';
    mapNext.textContent = '›';
    this.bindButtonPress(mapNext, () => this.cycleMap(1));

    mapControl.append(mapLabel, mapPrev, this.mapNameEl, mapNext);

    this.pauseEl = document.createElement('button');
    this.pauseEl.className = 'status-mini-btn utility-btn icon-only';
    this.pauseEl.textContent = '⏸';
    this.pauseEl.title = 'Pause';
    this.bindButtonPress(this.pauseEl, () => this.actions.onTogglePause());

    this.restartEl = document.createElement('button');
    this.restartEl.className = 'status-mini-btn utility-btn icon-only';
    this.restartEl.textContent = '↻';
    this.restartEl.title = 'Restart';
    this.bindButtonPress(this.restartEl, () => this.actions.onRestart());

    this.startWaveEl = document.createElement('button');
    this.startWaveEl.className = 'wave-btn wave-start-btn';
    this.startWaveEl.textContent = 'Start';
    this.startWaveEl.dataset.mode = 'start';
    this.bindButtonPress(this.startWaveEl, () => {
      if (this.startWaveEl.dataset.mode === 'send') {
        this.actions.onQueueWave();
      } else {
        this.actions.onStartWave();
      }
    });

    this.autoWaveEl = document.createElement('button');
    this.autoWaveEl.className = 'wave-btn auto-toggle-btn';
    this.autoWaveEl.textContent = 'Auto';
    this.bindButtonPress(this.autoWaveEl, () => {
      const nextEnabled = !this.autoWaveEl.classList.contains('on');
      this.actions.onSetAutoWaveEnabled(nextEnabled);
    });

    const waveBars = document.createElement('div');
    waveBars.className = 'wave-bars';
    for (let i = 0; i < 3; i += 1) {
      const bar = document.createElement('span');
      bar.className = 'wave-bar';
      waveBars.append(bar);
      this.queueBars.push(bar);
    }

    const waveControls = document.createElement('div');
    waveControls.className = 'wave-controls';
    waveControls.append(this.startWaveEl, this.autoWaveEl, waveBars, this.speedEl, this.pauseEl, this.restartEl);

    const musicControl = document.createElement('div');
    musicControl.className = 'music-control';

    const musicNote = document.createElement('span');
    musicNote.className = 'music-note';
    musicNote.textContent = '♫';

    const musicPrevEl = document.createElement('button');
    musicPrevEl.className = 'music-nav-btn';
    musicPrevEl.textContent = '‹';
    musicPrevEl.title = 'Previous Track';
    this.bindButtonPress(musicPrevEl, () => {
      this.actions.onMusicPrev();
      this.syncMusicState();
    });

    this.musicTitleEl = document.createElement('span');
    this.musicTitleEl.className = 'music-track-label';

    this.musicPlayPauseEl = document.createElement('button');
    this.musicPlayPauseEl.className = 'music-nav-btn music-play-toggle';
    this.musicPlayPauseEl.textContent = '⏸';
    this.musicPlayPauseEl.title = 'Play/Pause';
    this.bindButtonPress(this.musicPlayPauseEl, () => {
      this.actions.onToggleMusicPlayPause();
      this.syncMusicState();
    });

    const musicStopEl = document.createElement('button');
    musicStopEl.className = 'music-nav-btn';
    musicStopEl.textContent = '■';
    musicStopEl.title = 'Stop';
    this.bindButtonPress(musicStopEl, () => {
      this.actions.onStopMusic();
      this.syncMusicState();
    });

    const musicNextEl = document.createElement('button');
    musicNextEl.className = 'music-nav-btn';
    musicNextEl.textContent = '›';
    musicNextEl.title = 'Next Track';
    this.bindButtonPress(musicNextEl, () => {
      this.actions.onMusicNext();
      this.syncMusicState();
    });

    musicControl.append(musicNote, musicPrevEl, this.musicTitleEl, this.musicPlayPauseEl, musicStopEl, musicNextEl);

    const utilityRow = document.createElement('div');
    utilityRow.className = 'status-utility-row';
    utilityRow.append(modeControl, mapControl, waveControls, musicControl);

    const statusLayout = document.createElement('div');
    statusLayout.className = 'status-layout';
    statusLayout.append(hudTable);
    statusCard.append(statusLayout);

    const headerTop = document.createElement('div');
    headerTop.className = 'header-top';
    headerTop.append(logoCard, statusCard);

    this.headerRoot.append(headerTop, utilityRow);

    const buildPanel = document.createElement('div');
    buildPanel.className = 'panel build-panel';
    buildPanel.innerHTML = '<strong>Tower Select</strong>';

    const pulseButton = this.createBuildButton('pulse');
    const novaButton = this.createBuildButton('nova');
    const frostButton = this.createBuildButton('frost');

    this.buildButtons = {
      pulse: pulseButton,
      nova: novaButton,
      frost: frostButton,
    };

    buildPanel.append(pulseButton, novaButton, frostButton);

    this.selectedPanel = document.createElement('div');
    this.selectedPanel.className = 'panel selected-panel';

    this.toastsEl = document.createElement('div');
    this.toastsEl.className = 'toasts';

    const canvasShell = document.querySelector<HTMLDivElement>('.canvas-shell');
    if (canvasShell) {
      canvasShell.append(this.toastsEl);
    } else {
      this.headerRoot.append(this.toastsEl);
    }

    this.mapConfirmEl = document.createElement('div');
    this.mapConfirmEl.className = 'map-confirm hidden';
    this.mapConfirmEl.innerHTML = `
      <div class="map-confirm-card">
        <strong>End Current Run?</strong>
        <p>Map switching will end the current game. Choose a new map?</p>
        <div class="map-confirm-actions">
          <button id="map-confirm-yes">Yes</button>
          <button id="map-confirm-no">No</button>
        </div>
      </div>
    `;
    this.headerRoot.append(this.mapConfirmEl);
    this.mapConfirmEl.querySelector<HTMLButtonElement>('#map-confirm-yes')?.addEventListener('click', () => {
      this.confirmMapSwitch();
    });
    this.mapConfirmEl.querySelector<HTMLButtonElement>('#map-confirm-no')?.addEventListener('click', () => {
      this.cancelMapSwitch();
    });

    this.sidebarRoot.append(buildPanel, this.selectedPanel);

    this.syncMusicState();
    this.updateModeDisplay();
    this.updateMapDisplay();
  }

  update(snapshot: GameSnapshot, game: Game): void {
    this.latestSnapshot = snapshot;

    if (snapshot.mapIndex !== this.mapIndex) {
      this.mapIndex = snapshot.mapIndex;
      this.updateMapDisplay();
    }
    if (snapshot.mode !== this.mode) {
      this.mode = snapshot.mode;
      this.updateModeDisplay();
    }

    this.moneyEl.textContent = `$${snapshot.money}`;
    this.interestEl.textContent = `${Math.round(snapshot.interestRatePct * 100)}%`;
    this.scoreEl.textContent = `${snapshot.score}`;
    this.livesEl.textContent = `${snapshot.lives}`;
    this.levelEl.textContent = snapshot.isEndlessMode
      ? `${snapshot.waveNumber}/∞`
      : `${Math.min(snapshot.waveNumber, snapshot.totalWaves)}/${snapshot.totalWaves}`;
    this.bonusEl.textContent = `${snapshot.bonusCredits}`;

    if (snapshot.waveInProgress) {
      this.startWaveEl.dataset.mode = 'send';
      this.startWaveEl.textContent = 'Send';
      this.startWaveEl.disabled = !snapshot.canQueueWave;
      this.startWaveEl.classList.remove('start-mode');
      this.startWaveEl.classList.add('send-mode');
    } else {
      this.startWaveEl.dataset.mode = 'start';
      this.startWaveEl.textContent = 'Start';
      this.startWaveEl.disabled = !snapshot.canStartWave;
      this.startWaveEl.classList.add('start-mode');
      this.startWaveEl.classList.remove('send-mode');
    }

    this.autoWaveEl.classList.toggle('on', snapshot.autoWaveEnabled);
    this.autoWaveEl.setAttribute('aria-pressed', snapshot.autoWaveEnabled ? 'true' : 'false');

    this.queueBars.forEach((bar, index) => {
      bar.classList.toggle('active', index < snapshot.queuedWaveCount);
    });

    this.speedEl.textContent = `${snapshot.speed}x`;
    this.pauseEl.textContent = snapshot.paused ? '▶' : '⏸';
    this.pauseEl.title = snapshot.paused ? 'Resume' : 'Pause';

    for (const kind of Object.keys(this.buildButtons) as TowerKind[]) {
      const button = this.buildButtons[kind];
      const active = snapshot.placingTowerKind === kind;
      button.classList.toggle('active', active);
      button.disabled = snapshot.gameOver || snapshot.victory;
    }

    this.syncMusicState();
    this.renderSelected(snapshot, game);
    this.renderToasts(snapshot);
  }

  private createHudCell(label: string, valueEl: HTMLSpanElement, tone: string): HTMLDivElement {
    const cell = document.createElement('div');
    cell.className = `hud-cell ${tone}`;
    const labelEl = document.createElement('span');
    labelEl.className = 'hud-label';
    labelEl.textContent = label;
    valueEl.className = 'hud-value';
    cell.append(labelEl, valueEl);
    return cell;
  }

  private createBuildButton(kind: TowerKind): HTMLButtonElement {
    const button = document.createElement('button');
    const cost = BALANCE.towers.stats[kind].cost;
    button.className = `build-btn tower-btn ${kind}`;
    button.title = BALANCE.towers.stats[kind].name;
    button.innerHTML = `<span class="tower-glyph ${kind}"></span><span class="tower-cost">$${cost}</span>`;
    button.addEventListener('click', () => {
      this.actions.onBuildSelect(kind);
    });

    return button;
  }

  private bindButtonPress(button: HTMLButtonElement, handler: () => void): void {
    let lastPressedAt = 0;
    const press = (): void => {
      if (button.disabled) {
        return;
      }
      const now = performance.now();
      if (now - lastPressedAt < 140) {
        return;
      }
      lastPressedAt = now;
      handler();
    };

    button.addEventListener('click', () => press());
    button.addEventListener(
      'touchend',
      (event) => {
        event.preventDefault();
        press();
      },
      { passive: false },
    );
  }

  private syncMusicState(): void {
    const state = this.actions.getMusicState();
    this.musicTitleEl.textContent = state.currentTrackTitle;
    this.musicPlayPauseEl.textContent = state.isPlaying ? '⏸' : '▶';
    this.musicPlayPauseEl.title = state.isPlaying ? 'Pause' : 'Play';
  }

  private cycleMap(delta: number): void {
    const snapshot = this.latestSnapshot;
    if (!snapshot) {
      this.actions.onCycleMap(delta);
      return;
    }

    const hasRunInProgress =
      snapshot.waveInProgress || snapshot.completedWaves > 0 || snapshot.towers.length > 0 || snapshot.enemies.length > 0;
    if (!hasRunInProgress) {
      this.actions.onCycleMap(delta);
      return;
    }

    this.pendingMapDelta = delta;
    if (!snapshot.paused) {
      this.actions.onTogglePause();
      this.pausedByMapPrompt = true;
    } else {
      this.pausedByMapPrompt = false;
    }
    this.mapConfirmEl.classList.remove('hidden');
  }

  private updateMapDisplay(): void {
    this.mapNameEl.textContent = this.maps[this.mapIndex];
  }

  private updateModeDisplay(): void {
    this.modeNameEl.textContent = this.modeNamesById.get(this.mode) ?? this.mode;
  }

  private renderSelected(snapshot: GameSnapshot, game: Game): void {
    const selectedTower = game.getSelectedTower();

    if (!selectedTower && snapshot.placingTowerKind) {
      const base = BALANCE.towers.stats[snapshot.placingTowerKind];
      this.selectedPanel.innerHTML = `
        <strong>${base.name}</strong>
        <div>Cost $${base.cost}</div>
        <div>Damage ${base.damage.toFixed(1)}</div>
        <div>Rate ${base.fireRate.toFixed(2)}/s</div>
        <div>Range ${base.range.toFixed(1)}</div>
        <div>Special ${this.specialText(snapshot.placingTowerKind, {
          damage: base.damage,
          fireRate: base.fireRate,
          range: base.range,
          splashRadius: base.splashRadius,
          slowPct: base.slowPct,
          slowDuration: base.slowDuration,
        })}</div>
        <p>Click an open tile on the map to place.</p>
      `;
      return;
    }

    if (!selectedTower) {
      this.selectedPanel.innerHTML =
        '<strong>Selection</strong><p>Choose a tower icon to inspect and place.</p><p>Tip: right-click or Esc to cancel placement.</p>';
      return;
    }

    const stats = game.getTowerStats(selectedTower);
    const towerInfo = BALANCE.towers.stats[selectedTower.kind];
    const upgradeCost = game.getUpgradeCost(selectedTower.kind, selectedTower.level);
    const sellValue = Math.floor(game.getTowerInvestedCost(selectedTower) * BALANCE.economy.sellRefundPct);
    const canUpgrade = selectedTower.level < BALANCE.towers.maxLevel && snapshot.money >= upgradeCost;

    this.selectedPanel.innerHTML = `
      <strong>${towerInfo.name}</strong>
      <div>Cost $${towerInfo.cost}</div>
      <div>Level ${selectedTower.level}/${BALANCE.towers.maxLevel}</div>
      <div>Damage ${stats.damage.toFixed(1)}</div>
      <div>Rate ${stats.fireRate.toFixed(2)}/s</div>
      <div>Range ${stats.range.toFixed(1)}</div>
      <div>Special ${this.specialText(selectedTower.kind, stats)}</div>
      <div>Targeting ${selectedTower.targeting}</div>
      <div class="panel-actions">
        <button id="upgrade-btn" class="upgrade-btn" ${canUpgrade ? '' : 'disabled'}>
          Upgrade (${selectedTower.level >= BALANCE.towers.maxLevel ? 'MAX' : upgradeCost})
        </button>
        <button id="sell-btn">Sell (+${sellValue})</button>
        <button id="targeting-btn">Toggle Targeting</button>
      </div>
    `;

    this.selectedPanel.querySelector<HTMLButtonElement>('#upgrade-btn')?.addEventListener('click', () => {
      this.actions.onUpgradeTower();
    });
    this.selectedPanel.querySelector<HTMLButtonElement>('#sell-btn')?.addEventListener('click', () => {
      this.actions.onSellTower();
    });
    this.selectedPanel.querySelector<HTMLButtonElement>('#targeting-btn')?.addEventListener('click', () => {
      this.actions.onToggleTargeting();
    });
  }

  private renderToasts(snapshot: GameSnapshot): void {
    const latest = snapshot.toasts.length > 0 ? snapshot.toasts[snapshot.toasts.length - 1] : null;
    if (!latest) {
      this.toastsEl.innerHTML = '';
      this.visibleToastId = null;
      return;
    }

    if (this.visibleToastId === latest.id) {
      return;
    }

    this.visibleToastId = latest.id;
    this.toastsEl.innerHTML = '';
    const el = document.createElement('div');
    const { tone, icon } = this.toastPresentation(latest.text);
    el.className = `toast ${tone} toast-enter`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${latest.text}</span>`;
    this.toastsEl.append(el);
  }

  private toastPresentation(text: string): { tone: string; icon: string } {
    const lower = text.toLowerCase();
    if (lower.includes('insufficient') || lower.includes('breach')) {
      return { tone: 'toast-warn', icon: '!' };
    }
    if (lower.includes('victory') || lower.includes('secured') || lower.includes('lives')) {
      return { tone: 'toast-good', icon: '+' };
    }
    if (lower.includes('burst') || lower.includes('clear +')) {
      return { tone: 'toast-money', icon: '$' };
    }
    if (lower.includes('overdrive') || lower.includes('longshot') || lower.includes('slow')) {
      return { tone: 'toast-buff', icon: '*' };
    }
    return { tone: 'toast-info', icon: 'i' };
  }

  private confirmMapSwitch(): void {
    if (this.pendingMapDelta !== null) {
      this.actions.onCycleMap(this.pendingMapDelta);
    }
    this.pendingMapDelta = null;
    this.pausedByMapPrompt = false;
    this.mapConfirmEl.classList.add('hidden');
  }

  private cancelMapSwitch(): void {
    if (this.pausedByMapPrompt) {
      this.actions.onTogglePause();
    }
    this.pendingMapDelta = null;
    this.pausedByMapPrompt = false;
    this.mapConfirmEl.classList.add('hidden');
  }

  private specialText(kind: TowerKind, stats: ReturnType<Game['getTowerStats']>): string {
    if (kind === 'nova') {
      return `Splash ${stats.splashRadius.toFixed(0)}`;
    }
    if (kind === 'frost') {
      return `Slow ${(stats.slowPct * 100).toFixed(0)}% for ${stats.slowDuration.toFixed(1)}s`;
    }
    return 'Direct beam';
  }
}
