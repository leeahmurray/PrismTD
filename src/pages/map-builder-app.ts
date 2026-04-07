import { BALANCE } from '../balance';
import { LocalMapLab } from '../maplab';
import type { Vec2 } from '../game/types';

const BOARD = {
  width: BALANCE.map.width,
  height: BALANCE.map.height,
  gridSize: BALANCE.map.gridSizePx,
  cols: Math.floor(BALANCE.map.width / BALANCE.map.gridSizePx),
  rows: Math.floor(BALANCE.map.height / BALANCE.map.gridSizePx),
} as const;

function toWorldPositionFromClient(canvas: HTMLCanvasElement, clientX: number, clientY: number): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

function renderBuilderBoard(ctx: CanvasRenderingContext2D): void {
  const half = BOARD.gridSize / 2;

  ctx.clearRect(0, 0, BOARD.width, BOARD.height);
  ctx.fillStyle = '#05060A';
  ctx.fillRect(0, 0, BOARD.width, BOARD.height);

  for (let row = 1; row < BOARD.rows; row += 1) {
    for (let col = 1; col < BOARD.cols; col += 1) {
      const x = col * BOARD.gridSize;
      const y = row * BOARD.gridSize;
      const checker = (col + row) % 2 === 0 ? 'rgba(11, 15, 26, 0.94)' : 'rgba(13, 19, 33, 0.94)';

      ctx.fillStyle = checker;
      ctx.fillRect(x - half + 1, y - half + 1, BOARD.gridSize - 2, BOARD.gridSize - 2);

      ctx.strokeStyle = 'rgba(42, 169, 255, 0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - half + 1, y - half + 1, BOARD.gridSize - 2, BOARD.gridSize - 2);
    }
  }
}

export function mountMapBuilderApp(app: HTMLDivElement): void {
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
          <a class="site-menu-item" href="/">Play</a>
          <a class="site-menu-item" href="/map-builder">Map Builder</a>
        </div>
      </div>
      <div class="builder-shell">
        <section class="panel builder-hero">
          <strong>Map Builder</strong>
          <p>Create localhost-only PrismTD maps with multiple entrances, exits, and lane crossings.</p>
          <p>Saved maps write into the project, appear in the game’s normal map cycle, and can ship with your next deploy.</p>
        </section>
        <div class="builder-layout">
          <div class="left-column">
            <div class="canvas-shell">
              <canvas id="builder-canvas" width="960" height="540"></canvas>
            </div>
          </div>
          <div id="builder-sidebar" class="ui-sidebar builder-sidebar"></div>
        </div>
      </div>
    </div>
  `;

  const canvas = app.querySelector<HTMLCanvasElement>('#builder-canvas');
  const sidebarRoot = app.querySelector<HTMLDivElement>('#builder-sidebar');
  if (!canvas || !sidebarRoot) {
    throw new Error('Missing map builder nodes');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context unavailable');
  }
  const renderContext = ctx;

  const mapLab = new LocalMapLab(sidebarRoot, () => {});

  canvas.addEventListener('click', (event) => {
    mapLab.handleCanvasClick(toWorldPositionFromClient(canvas, event.clientX, event.clientY), BOARD);
  });

  canvas.addEventListener(
    'touchend',
    (event) => {
      event.preventDefault();
      const touch = event.changedTouches[0];
      if (!touch) {
        return;
      }

      mapLab.handleCanvasClick(toWorldPositionFromClient(canvas, touch.clientX, touch.clientY), BOARD);
    },
    { passive: false },
  );

  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    mapLab.handleCanvasRightClick();
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      mapLab.handleCanvasRightClick();
    }
  });

  function frame(): void {
    renderBuilderBoard(renderContext);
    mapLab.drawOverlay(renderContext, BOARD);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
