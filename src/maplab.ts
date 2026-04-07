import {
  canUseLocalMapLab,
  deleteProjectMap,
  getAvailableMapsFromProjectMaps,
  fetchProjectMapsFromDevServer,
  getProjectAuthoredMaps,
  saveProjectMap,
  serializeMapForExport,
  type MapDefinition,
} from './game/maps';
import type { Vec2 } from './game/types';

const ROUTE_COLORS = ['#5fe6ff', '#ff7a9c', '#89ffb5', '#ffd95e'];

export interface MapLabBoardSnapshot {
  width: number;
  height: number;
  gridSize: number;
  cols: number;
  rows: number;
}

export class LocalMapLab {
  private panelEl: HTMLDivElement;

  private onMapsChanged: () => void;

  private savedMapsEl: HTMLDivElement;

  private routeMetaEl: HTMLDivElement;

  private statusEl: HTMLParagraphElement;

  private exportEl: HTMLTextAreaElement;

  private nameInputEl: HTMLInputElement;

  private modeSelectEl: HTMLSelectElement;

  private mapSelectEl: HTMLSelectElement;

  private savedMaps: MapDefinition[] = [];

  private availableMaps: MapDefinition[] = [];

  private editingMapId: string | null = null;

  private editingMapSource: 'project' | 'builtin' | null = null;

  private active = false;

  private selectedRoute = 0;

  private routes: Vec2[][] = [[]];

  constructor(sidebarRoot: HTMLElement, onMapsChanged: () => void) {
    this.onMapsChanged = onMapsChanged;
    this.panelEl = document.createElement('div');
    this.panelEl.className = 'panel maplab-panel';
    this.panelEl.innerHTML = `
      <strong>Map Lab</strong>
      <p class="maplab-copy">Local-only builder for split lanes, crossings, and custom route layouts.</p>
      <label class="maplab-field">
        <span>Name</span>
        <input type="text" class="maplab-name" value="Local Junction" />
      </label>
      <label class="maplab-field">
        <span>Mode</span>
        <select class="maplab-mode">
          <option value="create">Create New Map</option>
          <option value="edit">Edit Existing Map</option>
        </select>
      </label>
      <label class="maplab-field">
        <span>Available Maps</span>
        <select class="maplab-map-select"></select>
      </label>
      <div class="maplab-actions primary">
        <button type="button" data-action="toggle">Start Builder</button>
        <button type="button" data-action="save">Save Project Map</button>
      </div>
      <div class="maplab-actions primary">
        <button type="button" data-action="new-draft">Create New Draft</button>
        <button type="button" data-action="load-selected">Load Selected Map</button>
      </div>
      <div class="maplab-actions">
        <button type="button" data-action="prev-route">Prev Route</button>
        <button type="button" data-action="next-route">Next Route</button>
        <button type="button" data-action="add-route">Add Route</button>
      </div>
      <div class="maplab-actions">
        <button type="button" data-action="undo">Undo Point</button>
        <button type="button" data-action="clear-route">Clear Route</button>
        <button type="button" data-action="reset">Reset Draft</button>
      </div>
      <div class="maplab-actions secondary">
        <button type="button" data-action="cancel-edit">Cancel Edit</button>
      </div>
      <div class="maplab-route-meta"></div>
      <p class="maplab-status"></p>
      <label class="maplab-field">
        <span>Export JSON</span>
        <textarea class="maplab-export" readonly></textarea>
      </label>
      <div class="maplab-saved"></div>
    `;

    this.savedMapsEl = this.panelEl.querySelector<HTMLDivElement>('.maplab-saved')!;
    this.routeMetaEl = this.panelEl.querySelector<HTMLDivElement>('.maplab-route-meta')!;
    this.statusEl = this.panelEl.querySelector<HTMLParagraphElement>('.maplab-status')!;
    this.exportEl = this.panelEl.querySelector<HTMLTextAreaElement>('.maplab-export')!;
    this.nameInputEl = this.panelEl.querySelector<HTMLInputElement>('.maplab-name')!;
    this.modeSelectEl = this.panelEl.querySelector<HTMLSelectElement>('.maplab-mode')!;
    this.mapSelectEl = this.panelEl.querySelector<HTMLSelectElement>('.maplab-map-select')!;

    this.panelEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const action = target?.closest<HTMLButtonElement>('button[data-action]')?.dataset.action;
      if (!action) {
        return;
      }

      if (action === 'toggle') {
        this.active = !this.active;
      } else if (action === 'save') {
        void this.saveDraft();
      } else if (action === 'new-draft') {
        this.startNewDraft();
      } else if (action === 'load-selected') {
        this.loadSelectedMap();
      } else if (action === 'prev-route') {
        this.selectedRoute = (this.selectedRoute - 1 + this.routes.length) % this.routes.length;
      } else if (action === 'next-route') {
        this.selectedRoute = (this.selectedRoute + 1) % this.routes.length;
      } else if (action === 'add-route') {
        this.routes.push([]);
        this.selectedRoute = this.routes.length - 1;
      } else if (action === 'undo') {
        this.routes[this.selectedRoute]?.pop();
      } else if (action === 'clear-route') {
        this.routes[this.selectedRoute] = [];
      } else if (action === 'reset') {
        this.resetDraft();
      } else if (action === 'cancel-edit') {
        this.cancelEdit();
      }

      this.updateUi();
    });

    this.panelEl.addEventListener('change', (event) => {
      const target = event.target as HTMLElement | null;
      if (target === this.modeSelectEl) {
        if (this.modeSelectEl.value === 'create') {
          this.startNewDraft();
        } else {
          if (this.mapSelectEl.value) {
            this.loadMapById(this.mapSelectEl.value);
          } else {
            this.statusEl.textContent = 'Choose a map from the dropdown to load it into the builder.';
          }
        }
        this.updateUi();
        return;
      }

      if (target === this.mapSelectEl && this.modeSelectEl.value === 'edit' && this.mapSelectEl.value) {
        this.loadMapById(this.mapSelectEl.value);
        this.updateUi();
      }
    });

    this.savedMapsEl.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      const editButton = target?.closest<HTMLButtonElement>('button[data-edit-id]');
      if (editButton) {
        this.loadSavedMap(editButton.dataset.editId!);
        return;
      }

      const button = target?.closest<HTMLButtonElement>('button[data-delete-id]');
      if (!button) {
        return;
      }

      void this.deleteSavedMap(button.dataset.deleteId!);
    });

    sidebarRoot.append(this.panelEl);
    void this.refreshSavedMaps();
    this.updateUi();
  }

  static canMount(): boolean {
    return canUseLocalMapLab();
  }

  isActive(): boolean {
    return this.active;
  }

  handleCanvasClick(worldPos: Vec2, snapshot: MapLabBoardSnapshot): boolean {
    if (!this.active) {
      return false;
    }

    const snapped = this.snapToGrid(worldPos, snapshot);
    if (!snapped) {
      return true;
    }

    const route = this.routes[this.selectedRoute];
    const previous = route[route.length - 1];
    const aligned = previous ? this.alignToOrthogonal(previous, snapped) : snapped;

    if (previous && previous.x === aligned.x && previous.y === aligned.y) {
      return true;
    }

    route.push(aligned);
    this.updateUi();
    return true;
  }

  handleCanvasRightClick(): boolean {
    if (!this.active) {
      return false;
    }

    this.routes[this.selectedRoute]?.pop();
    this.updateUi();
    return true;
  }

  drawOverlay(ctx: CanvasRenderingContext2D, snapshot: MapLabBoardSnapshot): void {
    if (!this.active) {
      return;
    }

    ctx.save();

    for (let routeIndex = 0; routeIndex < this.routes.length; routeIndex += 1) {
      const route = this.routes[routeIndex];
      if (route.length === 0) {
        continue;
      }

      const color = ROUTE_COLORS[routeIndex % ROUTE_COLORS.length];
      const activeAlpha = routeIndex === this.selectedRoute ? 0.9 : 0.55;

      if (route.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(route[0].x, route[0].y);
        for (let i = 1; i < route.length; i += 1) {
          ctx.lineTo(route[i].x, route[i].y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowColor = color;
        ctx.shadowBlur = 14;
        ctx.globalAlpha = activeAlpha;
        ctx.stroke();
      }

      for (let i = 0; i < route.length; i += 1) {
        const point = route[i];
        ctx.beginPath();
        ctx.arc(point.x, point.y, i === 0 || i === route.length - 1 ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = activeAlpha;
        ctx.fill();
      }
    }

    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#d9f1ff';
    ctx.font = '700 13px Rajdhani, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MAP LAB ACTIVE: click to add points, right-click to undo', 16, snapshot.height - 16);
    ctx.restore();
  }

  private alignToOrthogonal(from: Vec2, to: Vec2): Vec2 {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);

    if (dx >= dy) {
      return { x: to.x, y: from.y };
    }

    return { x: from.x, y: to.y };
  }

  private snapToGrid(pos: Vec2, snapshot: MapLabBoardSnapshot): Vec2 | null {
    const col = Math.round(pos.x / snapshot.gridSize);
    const row = Math.round(pos.y / snapshot.gridSize);
    if (col < 1 || col > snapshot.cols - 1 || row < 1 || row > snapshot.rows - 1) {
      return null;
    }

    return {
      x: col * snapshot.gridSize,
      y: row * snapshot.gridSize,
    };
  }

  private async saveDraft(): Promise<void> {
    const name = this.nameInputEl.value.trim() || 'Local Custom Map';
    const normalizedRoutes = this.routes.filter((route) => route.length >= 2);
    const wasEditing = !!this.editingMapId;
    const editingSource = this.editingMapSource;
    if (normalizedRoutes.length === 0) {
      this.statusEl.textContent = 'Add at least one route with two points before saving.';
      return;
    }

    this.statusEl.textContent = 'Saving map into the project...';
    this.updateUi();

    try {
      const result = await saveProjectMap(name, normalizedRoutes, this.editingMapId ?? undefined);
      this.savedMaps = result.maps;
      this.editingMapId = result.savedMapId || this.editingMapId;
      this.editingMapSource = 'project';
      this.syncAvailableMaps();
      this.statusEl.textContent = !wasEditing
        ? `Saved ${name} into the project. It will ship in the next deploy.`
        : editingSource === 'builtin'
          ? `Saved ${name} as a project override for that built-in map.`
          : `Updated ${name} in the project. It will ship in the next deploy.`;
      this.renderSavedMaps();
      this.onMapsChanged();
    } catch {
      this.statusEl.textContent = 'Could not save into the project file. Make sure the local dev server is running.';
    }
  }

  private async refreshSavedMaps(): Promise<void> {
    try {
      this.savedMaps = await fetchProjectMapsFromDevServer();
    } catch {
      this.savedMaps = getProjectAuthoredMaps();
    }

    this.syncAvailableMaps();
    this.renderSavedMaps();
  }

  private async deleteSavedMap(id: string): Promise<void> {
    this.statusEl.textContent = 'Removing map from the project...';
    this.updateUi();

    try {
      this.savedMaps = await deleteProjectMap(id);
      if (this.editingMapId === id) {
        this.editingMapId = null;
        this.editingMapSource = null;
      }
      this.syncAvailableMaps();
      this.statusEl.textContent = 'Map removed from the project.';
      this.renderSavedMaps();
      this.onMapsChanged();
    } catch {
      this.statusEl.textContent = 'Could not delete the map from the project file.';
    }
  }

  private renderSavedMaps(): void {
    this.savedMapsEl.innerHTML = '<strong>Saved Project Maps</strong>';

    if (this.savedMaps.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'maplab-copy';
      empty.textContent = 'No project-backed maps saved yet.';
      this.savedMapsEl.append(empty);
      return;
    }

    for (const map of this.savedMaps) {
      const row = document.createElement('div');
      row.className = 'maplab-saved-row';
      row.innerHTML = `
        <span>${map.name}</span>
        <div class="maplab-saved-actions">
          <button type="button" data-edit-id="${map.id}">Edit</button>
          <button type="button" data-delete-id="${map.id}">Delete</button>
        </div>
      `;
      if (map.id === this.editingMapId) {
        row.classList.add('editing');
      }
      this.savedMapsEl.append(row);
    }
  }

  private syncAvailableMaps(): void {
    this.availableMaps = getAvailableMapsFromProjectMaps(this.savedMaps);
    this.renderAvailableMapOptions();
  }

  private renderAvailableMapOptions(): void {
    if (this.availableMaps.length === 0) {
      this.mapSelectEl.innerHTML = '<option value="">No maps available</option>';
      return;
    }

    this.mapSelectEl.innerHTML = this.availableMaps
      .map(
        (map) =>
          `<option value="${map.id}">${map.name} ${map.isCustom ? '(Project)' : '(Built-in)'}</option>`,
      )
      .join('');

    if (this.editingMapId && this.availableMaps.some((map) => map.id === this.editingMapId)) {
      this.mapSelectEl.value = this.editingMapId;
      return;
    }

    if (this.mapSelectEl.options.length > 0) {
      this.mapSelectEl.selectedIndex = 0;
    }
  }

  private loadSelectedMap(): void {
    const mapId = this.mapSelectEl.value;
    if (!mapId) {
      this.statusEl.textContent = 'Choose a map to load first.';
      return;
    }

    this.loadMapById(mapId);
  }

  private loadSavedMap(id: string): void {
    this.modeSelectEl.value = 'edit';
    this.loadMapById(id);
  }

  private loadMapById(id: string): void {
    const map = this.availableMaps.find((entry) => entry.id === id);
    if (!map) {
      this.statusEl.textContent = 'Could not load that saved map.';
      this.updateUi();
      return;
    }

    this.editingMapId = map.id;
    this.editingMapSource = map.isCustom ? 'project' : 'builtin';
    this.nameInputEl.value = map.name;
    this.routes = map.routes.map((route) => route.pathPoints.map((point) => ({ x: point.x, y: point.y })));
    this.selectedRoute = 0;
    this.active = true;
    this.mapSelectEl.value = map.id;
    this.statusEl.textContent = map.isCustom
      ? `Editing ${map.name}. Save to overwrite this project map.`
      : `Editing ${map.name}. Saving will create or update a project override for this built-in map.`;
    this.renderSavedMaps();
    this.updateUi();
  }

  private cancelEdit(): void {
    if (!this.editingMapId) {
      this.statusEl.textContent = 'No saved map is currently loaded for editing.';
      return;
    }

    this.editingMapId = null;
    this.editingMapSource = null;
    this.nameInputEl.value = 'Local Junction';
    this.statusEl.textContent = 'Edit mode cleared. Current draft is now a new unsaved map.';
  }

  private startNewDraft(): void {
    this.modeSelectEl.value = 'create';
    this.editingMapId = null;
    this.editingMapSource = null;
    this.routes = [[]];
    this.selectedRoute = 0;
    this.active = false;
    this.nameInputEl.value = 'Local Junction';
    this.statusEl.textContent = 'New draft ready. Start Builder to author a fresh map.';
  }

  private resetDraft(): void {
    this.editingMapId = null;
    this.editingMapSource = null;
    this.routes = [[]];
    this.selectedRoute = 0;
    this.active = false;
    this.nameInputEl.value = 'Local Junction';
    this.statusEl.textContent = 'Draft reset.';
    this.updateUi();
  }

  private updateUi(): void {
    const currentRoute = this.routes[this.selectedRoute] ?? [];
    const isEditing = !!this.editingMapId;
    const editingBuiltIn = this.editingMapSource === 'builtin';
    this.panelEl.classList.toggle('active', this.active);
    this.routeMetaEl.innerHTML = `
      <div>${
        isEditing
          ? editingBuiltIn
            ? 'Editing built-in map via project override'
            : 'Editing saved project map'
          : 'New project map draft'
      }</div>
      <div>Route ${this.selectedRoute + 1}/${this.routes.length}</div>
      <div>Points ${currentRoute.length}</div>
      <div>Multi-route splits and crossings are supported.</div>
    `;
    this.exportEl.value = serializeMapForExport(
      this.nameInputEl.value.trim() || 'Local Custom Map',
      this.routes.filter((route) => route.length >= 2),
    );

    if (!this.statusEl.textContent) {
      this.statusEl.textContent = this.active
        ? 'Builder is active. Click the grid to place orthogonal path points.'
        : 'Start Builder to author a project-backed custom map.';
    }

    const toggleButton = this.panelEl.querySelector<HTMLButtonElement>('button[data-action="toggle"]');
    if (toggleButton) {
      toggleButton.textContent = this.active ? 'Stop Builder' : 'Start Builder';
    }

    const saveButton = this.panelEl.querySelector<HTMLButtonElement>('button[data-action="save"]');
    if (saveButton) {
      saveButton.textContent = isEditing
        ? editingBuiltIn
          ? 'Save Override'
          : 'Update Project Map'
        : 'Save Project Map';
    }

    const cancelEditButton = this.panelEl.querySelector<HTMLButtonElement>('button[data-action="cancel-edit"]');
    if (cancelEditButton) {
      cancelEditButton.disabled = !isEditing;
    }

    const loadButton = this.panelEl.querySelector<HTMLButtonElement>('button[data-action="load-selected"]');
    if (loadButton) {
      loadButton.disabled = this.modeSelectEl.value !== 'edit' || this.availableMaps.length === 0;
    }

    const newDraftButton = this.panelEl.querySelector<HTMLButtonElement>('button[data-action="new-draft"]');
    if (newDraftButton) {
      newDraftButton.disabled = this.modeSelectEl.value === 'create' && !isEditing && currentRoute.length === 0;
    }

    this.mapSelectEl.disabled = this.modeSelectEl.value !== 'edit' || this.availableMaps.length === 0;
  }
}
