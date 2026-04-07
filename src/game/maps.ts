import { BALANCE } from '../balance';
import AUTHORED_MAPS from './authored-maps.json';
import type { Vec2 } from './types';

const MAP_BUILDER_ENDPOINT = '/__map-builder/maps';

interface ProjectMapsPayload {
  maps?: RawMapDefinition[];
  savedMapId?: string;
}

export interface MapRouteDefinition {
  pathPoints: Vec2[];
}

export interface MapDefinition {
  id: string;
  name: string;
  routes: MapRouteDefinition[];
  isCustom: boolean;
}

interface RawMapDefinition {
  id?: string;
  name: string;
  pathPoints?: readonly Vec2[];
  routes?: readonly { pathPoints: readonly Vec2[] }[];
}

function clonePoint(point: Vec2): Vec2 {
  return { x: point.x, y: point.y };
}

function normalizeRoutePoints(points: readonly Vec2[] | undefined): Vec2[] {
  if (!points || points.length < 2) {
    return [];
  }

  return points.map(clonePoint);
}

export function normalizeMapDefinition(
  raw: RawMapDefinition,
  fallbackId: string,
  isCustom: boolean,
): MapDefinition {
  const routes =
    raw.routes && raw.routes.length > 0
      ? raw.routes
          .map((route) => ({ pathPoints: normalizeRoutePoints(route.pathPoints) }))
          .filter((route) => route.pathPoints.length >= 2)
      : [{ pathPoints: normalizeRoutePoints(raw.pathPoints) }].filter((route) => route.pathPoints.length >= 2);

  return {
    id: raw.id ?? fallbackId,
    name: raw.name,
    routes,
    isCustom,
  };
}

export function getBuiltinMaps(): MapDefinition[] {
  return BALANCE.map.maps.map((map, index) =>
    normalizeMapDefinition(map as RawMapDefinition, `builtin-${index}`, false),
  );
}

export function getProjectAuthoredMaps(): MapDefinition[] {
  return (AUTHORED_MAPS as RawMapDefinition[])
    .map((map, index) => normalizeMapDefinition(map, map.id ?? `local-${index}`, true))
    .filter((map) => map.routes.length > 0);
}

export function getAvailableMapsFromProjectMaps(projectMaps: MapDefinition[]): MapDefinition[] {
  const builtinMaps = getBuiltinMaps();
  const projectMapsById = new Map(projectMaps.map((map) => [map.id, map] as const));
  const builtinIds = new Set(builtinMaps.map((map) => map.id));

  const mergedBuiltinMaps = builtinMaps.map((map) => projectMapsById.get(map.id) ?? map);
  const extraProjectMaps = projectMaps.filter((map) => !builtinIds.has(map.id));
  return [...mergedBuiltinMaps, ...extraProjectMaps];
}

export function getAvailableMaps(): MapDefinition[] {
  return getAvailableMapsFromProjectMaps(getProjectAuthoredMaps());
}

function normalizeProjectMapsPayload(rawMaps: RawMapDefinition[]): MapDefinition[] {
  return rawMaps
    .map((map, index) => normalizeMapDefinition(map, map.id ?? `project-${index}`, true))
    .filter((map) => map.routes.length > 0);
}

async function readProjectMapsFromDevServer(init?: RequestInit): Promise<ProjectMapsPayload> {
  const response = await fetch(MAP_BUILDER_ENDPOINT, init);
  if (!response.ok) {
    throw new Error(`Map builder request failed with ${response.status}`);
  }

  return (await response.json()) as ProjectMapsPayload;
}

export async function fetchProjectMapsFromDevServer(): Promise<MapDefinition[]> {
  const payload = await readProjectMapsFromDevServer();
  return normalizeProjectMapsPayload(Array.isArray(payload.maps) ? payload.maps : []);
}

export async function saveProjectMap(name: string, routes: Vec2[][], id?: string): Promise<{
  maps: MapDefinition[];
  savedMapId: string;
}> {
  const payload = await readProjectMapsFromDevServer({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id,
      name,
      routes: routes.map((route) => ({
        pathPoints: route.map(clonePoint),
      })),
    }),
  });

  return {
    maps: normalizeProjectMapsPayload(Array.isArray(payload.maps) ? payload.maps : []),
    savedMapId: payload.savedMapId ?? id ?? '',
  };
}

export async function deleteProjectMap(id: string): Promise<MapDefinition[]> {
  const payload = await readProjectMapsFromDevServer({
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id }),
  });

  return normalizeProjectMapsPayload(Array.isArray(payload.maps) ? payload.maps : []);
}

export function serializeMapForExport(name: string, routes: Vec2[][]): string {
  return JSON.stringify(
    {
      name,
      routes: routes.map((route) => ({
        pathPoints: route.map(clonePoint),
      })),
    },
    null,
    2,
  );
}

export function canUseLocalMapLab(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}
