import { BALANCE, type AbilityKind, type GameMode, type TowerKind } from '../balance';
import { Game } from '../game/game';
import type { AbilitySnapshot, GameSnapshot } from '../game/types';

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
  onTriggerAbility: (kind: AbilityKind) => void;
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

  private sendWaveEl: HTMLButtonElement;

  private restartEl: HTMLButtonElement;

  private musicTitleEl: HTMLSpanElement;

  private musicPlayPauseEl: HTMLButtonElement;

  private mobileMusicOpenEl: HTMLButtonElement;

  private musicModalEl: HTMLDivElement;

  private musicModalTrackEl: HTMLSpanElement;

  private autoWaveEl: HTMLButtonElement;

  private queueBars: HTMLSpanElement[] = [];

  private buildButtons: Record<TowerKind, HTMLButtonElement>;

  private abilityButtons: Record<AbilityKind, HTMLButtonElement>;

  private selectedPanel: HTMLDivElement;

  private mobileActionsEl: HTMLDivElement;

  private mobileUpgradeEl: HTMLButtonElement;

  private mobileSellEl: HTMLButtonElement;

  private mobileTargetEl: HTMLButtonElement;

  private toastsEl: HTMLDivElement;

  private mapConfirmEl: HTMLDivElement;

  private pendingMapDelta: number | null = null;

  private pausedByMapPrompt = false;

  private latestSnapshot: GameSnapshot | null = null;

  private visibleToastId: number | null = null;

  private mapIndex = 0;

  private mode: GameMode = 'standard';

  private readonly modeNamesById = new Map(BALANCE.modes.list.map((mode) => [mode.id, mode.name]));

  private maps: string[] = [];

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
    this.bindButtonPress(this.startWaveEl, () => this.actions.onStartWave());

    this.sendWaveEl = document.createElement('button');
    this.sendWaveEl.className = 'wave-btn wave-send-btn';
    this.sendWaveEl.textContent = 'Send';
    this.bindButtonPress(this.sendWaveEl, () => this.actions.onQueueWave());

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
    waveControls.append(this.startWaveEl, this.sendWaveEl, waveBars, this.autoWaveEl, this.speedEl, this.pauseEl, this.restartEl);

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

    this.mobileMusicOpenEl = document.createElement('button');
    this.mobileMusicOpenEl.className = 'mobile-music-open';
    this.mobileMusicOpenEl.textContent = '♫';
    this.mobileMusicOpenEl.title = 'Open Music Controls';
    this.mobileMusicOpenEl.setAttribute('aria-label', 'Open music controls');
    this.bindButtonPress(this.mobileMusicOpenEl, () => {
      this.syncMusicState();
      this.musicModalEl.classList.remove('hidden');
    });

    this.musicModalEl = document.createElement('div');
    this.musicModalEl.className = 'music-modal hidden';
    this.musicModalEl.innerHTML = `
      <div class="music-modal-card">
        <div class="music-modal-header">
          <strong>Now Playing</strong>
          <button type="button" id="music-modal-close" class="music-modal-close" aria-label="Close music controls">✕</button>
        </div>
        <div class="music-modal-track-row"><span id="music-modal-track"></span></div>
        <div class="music-modal-player">
          <button type="button" id="music-modal-prev" class="music-modal-btn icon" aria-label="Previous track"><<</button>
          <button type="button" id="music-modal-play" class="music-modal-btn icon play" aria-label="Play or pause">||</button>
          <button type="button" id="music-modal-next" class="music-modal-btn icon" aria-label="Next track">>></button>
        </div>
      </div>
    `;

    this.musicModalTrackEl = this.musicModalEl.querySelector<HTMLSpanElement>('#music-modal-track')!;
    const closeMusicModal = (): void => this.musicModalEl.classList.add('hidden');

    const modalCloseBtn = this.musicModalEl.querySelector<HTMLButtonElement>('#music-modal-close');
    if (modalCloseBtn) {
      this.bindButtonPress(modalCloseBtn, closeMusicModal);
    }

    const modalPrevBtn = this.musicModalEl.querySelector<HTMLButtonElement>('#music-modal-prev');
    if (modalPrevBtn) {
      this.bindButtonPress(modalPrevBtn, () => {
        this.actions.onMusicPrev();
        this.syncMusicState();
      });
    }

    const modalPlayBtn = this.musicModalEl.querySelector<HTMLButtonElement>('#music-modal-play');
    if (modalPlayBtn) {
      this.bindButtonPress(modalPlayBtn, () => {
        this.actions.onToggleMusicPlayPause();
        this.syncMusicState();
      });
    }

    const modalNextBtn = this.musicModalEl.querySelector<HTMLButtonElement>('#music-modal-next');
    if (modalNextBtn) {
      this.bindButtonPress(modalNextBtn, () => {
        this.actions.onMusicNext();
        this.syncMusicState();
      });
    }

    this.musicModalEl.addEventListener('click', (event) => {
      if (event.target === this.musicModalEl) {
        closeMusicModal();
      }
    });

    musicControl.append(musicNote, musicPrevEl, this.musicTitleEl, this.musicPlayPauseEl, musicStopEl, musicNextEl, this.mobileMusicOpenEl);

    const utilityRow = document.createElement('div');
    utilityRow.className = 'status-utility-row';
    utilityRow.append(modeControl, mapControl, waveControls, musicControl);

    this.mobileActionsEl = document.createElement('div');
    this.mobileActionsEl.className = 'mobile-tower-actions hidden';

    this.mobileUpgradeEl = document.createElement('button');
    this.mobileUpgradeEl.className = 'mobile-action-btn upgrade';
    this.mobileUpgradeEl.textContent = 'Upgrade';
    this.bindButtonPress(this.mobileUpgradeEl, () => this.actions.onUpgradeTower());

    this.mobileSellEl = document.createElement('button');
    this.mobileSellEl.className = 'mobile-action-btn sell';
    this.mobileSellEl.textContent = 'Sell';
    this.bindButtonPress(this.mobileSellEl, () => this.actions.onSellTower());

    this.mobileTargetEl = document.createElement('button');
    this.mobileTargetEl.className = 'mobile-action-btn target';
    this.mobileTargetEl.textContent = 'Target';
    this.bindButtonPress(this.mobileTargetEl, () => this.actions.onToggleTargeting());

    this.mobileActionsEl.append(this.mobileUpgradeEl, this.mobileSellEl, this.mobileTargetEl);

    const statusLayout = document.createElement('div');
    statusLayout.className = 'status-layout';
    statusLayout.append(hudTable);
    statusCard.append(statusLayout);

    const headerTop = document.createElement('div');
    headerTop.className = 'header-top';
    headerTop.append(logoCard, statusCard);

    this.headerRoot.append(headerTop, utilityRow, this.mobileActionsEl, this.musicModalEl);

    const buildPanel = document.createElement('div');
    buildPanel.className = 'panel build-panel';
    buildPanel.innerHTML = '<strong>Tower Select</strong>';

    const pulseButton = this.createBuildButton('pulse');
    const novaButton = this.createBuildButton('nova');
    const frostButton = this.createBuildButton('frost');
    const chainButton = this.createBuildButton('chain');
    const laserButton = this.createBuildButton('laser');
    const decayButton = this.createBuildButton('decay');
    const relayButton = this.createBuildButton('relay');
    const ampButton = this.createBuildButton('amp');
    const bankButton = this.createBuildButton('bank');

    this.buildButtons = {
      pulse: pulseButton,
      nova: novaButton,
      frost: frostButton,
      chain: chainButton,
      laser: laserButton,
      decay: decayButton,
      relay: relayButton,
      amp: ampButton,
      bank: bankButton,
    };

    buildPanel.append(
      pulseButton,
      novaButton,
      frostButton,
      chainButton,
      laserButton,
      decayButton,
      relayButton,
      ampButton,
      bankButton,
    );

    const abilityPanel = document.createElement('div');
    abilityPanel.className = 'panel ability-panel';
    abilityPanel.innerHTML = '<strong>Command Abilities</strong>';

    const overclockButton = this.createAbilityButton('overclock');
    const ionBurstButton = this.createAbilityButton('ionBurst');
    const phaseWarpButton = this.createAbilityButton('phaseWarp');

    this.abilityButtons = {
      overclock: overclockButton,
      ionBurst: ionBurstButton,
      phaseWarp: phaseWarpButton,
    };

    abilityPanel.append(overclockButton, ionBurstButton, phaseWarpButton);

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

    this.sidebarRoot.append(buildPanel, this.selectedPanel, abilityPanel);

    this.syncMusicState();
    this.updateModeDisplay();
    this.updateMapDisplay();
  }

  update(snapshot: GameSnapshot, game: Game): void {
    this.latestSnapshot = snapshot;
    this.maps = snapshot.mapNames;

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

    this.startWaveEl.disabled = !snapshot.canStartWave;
    this.sendWaveEl.disabled = !snapshot.canQueueWave;

    this.autoWaveEl.classList.toggle('on', snapshot.autoWaveEnabled);
    this.autoWaveEl.setAttribute('aria-pressed', snapshot.autoWaveEnabled ? 'true' : 'false');

    this.queueBars.forEach((bar, index) => {
      bar.classList.toggle('active', index < snapshot.queuedWaveCount);
    });

    this.speedEl.textContent = `${snapshot.speed}x`;
    const mobileLayout = window.matchMedia('(max-width: 960px)').matches;
    this.pauseEl.textContent = mobileLayout ? (snapshot.paused ? 'RESUME' : 'PAUSE') : (snapshot.paused ? '▶' : '⏸');
    this.pauseEl.title = snapshot.paused ? 'Resume' : 'Pause';
    this.restartEl.textContent = mobileLayout ? 'RESTART' : '↻';

    for (const kind of Object.keys(this.buildButtons) as TowerKind[]) {
      const button = this.buildButtons[kind];
      const active = snapshot.placingTowerKind === kind;
      button.classList.toggle('active', active);
      button.disabled = snapshot.gameOver || snapshot.victory;
    }

    this.renderAbilities(snapshot);
    this.syncMusicState();
    this.renderSelected(snapshot, game);
    this.renderMobileActions(snapshot, game);
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
    this.bindButtonPress(button, () => this.actions.onBuildSelect(kind));

    return button;
  }

  private createAbilityButton(kind: AbilityKind): HTMLButtonElement {
    const button = document.createElement('button');
    const ability = BALANCE.abilities.stats[kind];
    button.className = `ability-btn ${kind}`;
    button.title = `${ability.name} - ${ability.chargeSourceLabel}`;
    button.innerHTML = `
      <span class="ability-name">${ability.name}</span>
      <span class="ability-desc">${ability.description}</span>
      <div class="ability-charges" aria-hidden="true">
        <span class="ability-charge-bar"></span>
        <span class="ability-charge-bar"></span>
        <span class="ability-charge-bar"></span>
      </div>
      <span class="ability-state">READY</span>
    `;
    this.bindButtonPress(button, () => this.actions.onTriggerAbility(kind));

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
    this.musicModalTrackEl.textContent = state.currentTrackTitle;
    const modalPlayBtn = this.musicModalEl.querySelector<HTMLButtonElement>('#music-modal-play');
    if (modalPlayBtn) {
      modalPlayBtn.textContent = state.isPlaying ? '||' : '>';
    }
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
    this.mapNameEl.textContent = this.maps[this.mapIndex] ?? 'Map';
  }

  private updateModeDisplay(): void {
    this.modeNameEl.textContent = this.modeNamesById.get(this.mode) ?? this.mode;
  }

  private renderAbilities(snapshot: GameSnapshot): void {
    for (const abilityState of snapshot.abilities) {
      const button = this.abilityButtons[abilityState.kind];
      const stateEl = button.querySelector<HTMLSpanElement>('.ability-state');
      const chargeBars = button.querySelectorAll<HTMLSpanElement>('.ability-charge-bar');
      if (!stateEl) {
        continue;
      }

      button.disabled = !abilityState.available;
      button.classList.toggle('ready', abilityState.available);
      button.classList.toggle('cooldown', abilityState.charges === 0);
      button.classList.toggle('active', abilityState.activeRemaining > 0);
      chargeBars.forEach((bar, index) => {
        bar.classList.toggle('active', index < abilityState.charges);
      });
      stateEl.textContent = this.abilityStateText(abilityState);
    }
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
          dotDamagePerSecond: 'dotDamagePerSecond' in base ? base.dotDamagePerSecond : 0,
          dotDuration: 'dotDuration' in base ? base.dotDuration : 0,
          supportDamageBoost: 'supportDamageBoost' in base ? base.supportDamageBoost : 0,
          supportRangeBoost: 'supportRangeBoost' in base ? base.supportRangeBoost : 0,
          incomePerWave: 'incomePerWave' in base ? base.incomePerWave : 0,
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
      <div class="selected-stats-grid">
        <div>Cost $${towerInfo.cost}</div>
        <div>Level ${selectedTower.level}/${BALANCE.towers.maxLevel}</div>
        <div>Damage ${stats.damage.toFixed(1)}</div>
        <div>Rate ${stats.fireRate.toFixed(2)}/s</div>
        <div>Range ${stats.range.toFixed(1)}</div>
        <div>Target ${selectedTower.targeting}</div>
      </div>
      <div class="selected-special">Special ${this.specialText(selectedTower.kind, stats)}</div>
      <div class="panel-actions">
        <button id="upgrade-btn" class="upgrade-btn" ${canUpgrade ? '' : 'disabled'}>
          Upgrade (${selectedTower.level >= BALANCE.towers.maxLevel ? 'MAX' : upgradeCost})
        </button>
        <button id="sell-btn">Sell (+${sellValue})</button>
        <button id="targeting-btn">Toggle Targeting</button>
      </div>
    `;

    const upgradeBtn = this.selectedPanel.querySelector<HTMLButtonElement>('#upgrade-btn');
    if (upgradeBtn) {
      this.bindButtonPress(upgradeBtn, () => this.actions.onUpgradeTower());
    }
    const sellBtn = this.selectedPanel.querySelector<HTMLButtonElement>('#sell-btn');
    if (sellBtn) {
      this.bindButtonPress(sellBtn, () => this.actions.onSellTower());
    }
    const targetingBtn = this.selectedPanel.querySelector<HTMLButtonElement>('#targeting-btn');
    if (targetingBtn) {
      this.bindButtonPress(targetingBtn, () => this.actions.onToggleTargeting());
    }
  }

  private renderMobileActions(snapshot: GameSnapshot, game: Game): void {
    const selectedTower = game.getSelectedTower();
    if (!selectedTower || snapshot.placingTowerKind) {
      this.mobileActionsEl.classList.add('hidden');
      return;
    }

    const upgradeCost = game.getUpgradeCost(selectedTower.kind, selectedTower.level);
    const sellValue = Math.floor(game.getTowerInvestedCost(selectedTower) * BALANCE.economy.sellRefundPct);
    const canUpgrade = selectedTower.level < BALANCE.towers.maxLevel && snapshot.money >= upgradeCost;

    this.mobileUpgradeEl.textContent =
      selectedTower.level >= BALANCE.towers.maxLevel ? 'Upgrade MAX' : `Upgrade $${upgradeCost}`;
    this.mobileUpgradeEl.disabled = !canUpgrade;
    this.mobileSellEl.textContent = `Sell +${sellValue}`;
    this.mobileSellEl.disabled = false;
    this.mobileTargetEl.textContent = `Target ${selectedTower.targeting}`;
    this.mobileTargetEl.disabled = false;

    this.mobileActionsEl.classList.remove('hidden');
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
    if (
      lower.includes('overdrive') ||
      lower.includes('longshot') ||
      lower.includes('slow') ||
      lower.includes('overclock') ||
      lower.includes('phase warp') ||
      lower.includes('ion burst')
    ) {
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
    if (kind === 'chain') {
      return '4-target chain beam';
    }
    if (kind === 'laser') {
      return 'Cardinal rail beam across the map';
    }
    if (kind === 'decay') {
      return `Decay ${stats.dotDamagePerSecond.toFixed(1)}/s for ${stats.dotDuration.toFixed(1)}s`;
    }
    if (kind === 'relay') {
      return `+${Math.round(stats.supportRangeBoost * 100)}% range aura`;
    }
    if (kind === 'amp') {
      return `+${Math.round(stats.supportDamageBoost * 100)}% damage aura`;
    }
    if (kind === 'bank') {
      return `+${stats.incomePerWave} credits per wave`;
    }
    return 'Direct beam';
  }

  private abilityStateText(ability: AbilitySnapshot): string {
    if (ability.activeRemaining > 0) {
      return 'ACTIVE';
    }
    if (ability.charges > 0) {
      return 'READY';
    }
    return 'BUILDING';
  }
}
