import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

interface MapPoint {
  x: number;
  y: number;
}

interface AuthoredRoute {
  pathPoints: MapPoint[];
}

interface AuthoredMap {
  id?: string;
  name: string;
  routes: AuthoredRoute[];
}

const AUTHORED_MAPS_FILE = resolve(__dirname, 'src/game/authored-maps.json');

function ensureAuthoredMapsFile(): void {
  mkdirSync(dirname(AUTHORED_MAPS_FILE), { recursive: true });

  try {
    readFileSync(AUTHORED_MAPS_FILE, 'utf8');
  } catch {
    writeFileSync(AUTHORED_MAPS_FILE, '[]\n', 'utf8');
  }
}

function readAuthoredMaps(): AuthoredMap[] {
  ensureAuthoredMapsFile();

  try {
    const raw = readFileSync(AUTHORED_MAPS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AuthoredMap[]) : [];
  } catch {
    return [];
  }
}

function writeAuthoredMaps(maps: AuthoredMap[]): void {
  ensureAuthoredMapsFile();
  writeFileSync(AUTHORED_MAPS_FILE, `${JSON.stringify(maps, null, 2)}\n`, 'utf8');
}

function isValidPoint(point: unknown): point is MapPoint {
  if (!point || typeof point !== 'object') {
    return false;
  }

  const candidate = point as Partial<MapPoint>;
  return typeof candidate.x === 'number' && Number.isFinite(candidate.x) && typeof candidate.y === 'number' && Number.isFinite(candidate.y);
}

function normalizeIncomingMap(payload: unknown): AuthoredMap | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Partial<AuthoredMap>;
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0 || !Array.isArray(candidate.routes)) {
    return null;
  }

  const routes = candidate.routes
    .map((route) => {
      if (!route || typeof route !== 'object' || !Array.isArray(route.pathPoints)) {
        return null;
      }

      const pathPoints = route.pathPoints.filter(isValidPoint).map((point) => ({
        x: point.x,
        y: point.y,
      }));

      if (pathPoints.length < 2) {
        return null;
      }

      return { pathPoints };
    })
    .filter((route): route is AuthoredRoute => route !== null);

  if (routes.length === 0) {
    return null;
  }

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : `authored-${Date.now()}`,
    name: candidate.name.trim(),
    routes,
  };
}

function readRequestBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolveBody, rejectBody) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      resolveBody(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      rejectBody(error);
    });
  });
}

function sendJson(res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body: string) => void }, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function isLocalBuilderHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) {
    return false;
  }

  const hostname = hostHeader.split(':')[0]?.toLowerCase() ?? '';
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export default defineConfig({
  plugins: [
    {
      name: 'prismtd-map-builder-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const requestUrl = req.url ?? '';
          if (!requestUrl.startsWith('/__map-builder/maps')) {
            next();
            return;
          }

          if (!isLocalBuilderHost(req.headers.host)) {
            sendJson(res, 403, { error: 'Map builder API is only available on localhost.' });
            return;
          }

          if (req.method === 'GET') {
            sendJson(res, 200, { maps: readAuthoredMaps() });
            return;
          }

          if (req.method === 'POST') {
            try {
              const body = await readRequestBody(req);
              const payload = body ? (JSON.parse(body) as unknown) : null;
              const nextMap = normalizeIncomingMap(payload);
              if (!nextMap) {
                sendJson(res, 400, { error: 'Invalid map payload.' });
                return;
              }

              const maps = readAuthoredMaps();
              const existingIndex = maps.findIndex((map) => map.id === nextMap.id);
              if (existingIndex >= 0) {
                maps[existingIndex] = nextMap;
              } else {
                maps.push(nextMap);
              }
              writeAuthoredMaps(maps);
              sendJson(res, 200, { maps, savedMapId: nextMap.id });
            } catch {
              sendJson(res, 500, { error: 'Could not save authored maps.' });
            }
            return;
          }

          if (req.method === 'DELETE') {
            try {
              const body = await readRequestBody(req);
              const payload = body ? (JSON.parse(body) as { id?: unknown }) : {};
              if (typeof payload.id !== 'string' || !payload.id) {
                sendJson(res, 400, { error: 'Missing map id.' });
                return;
              }

              const maps = readAuthoredMaps().filter((map) => map.id !== payload.id);
              writeAuthoredMaps(maps);
              sendJson(res, 200, { maps });
            } catch {
              sendJson(res, 500, { error: 'Could not delete authored map.' });
            }
            return;
          }

          sendJson(res, 405, { error: 'Method not allowed.' });
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 3005,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3005,
    strictPort: true,
  },
});
