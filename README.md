# PrismTD

PrismTD is a browser-based neon vector tower defense game built with TypeScript + HTML5 Canvas + Vite.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
```

## Deploy Workflow

See [`docs/DEPLOYMENT.md`](/Users/leeahmurray/Desktop/PrismTD/docs/DEPLOYMENT.md) for the safe `feature -> staging -> main` flow, CI checks, and Vercel domain mapping.
For production releases, use [`docs/RELEASE_CHECKLIST.md`](/Users/leeahmurray/Desktop/PrismTD/docs/RELEASE_CHECKLIST.md).

## Controls

- Click a tower in the build palette to enter placement mode.
- Left click on the map to place/select.
- Right click to cancel placement mode.
- `Start Wave` begins the next wave.
- `Speed` toggles 1x/2x simulation speed.
- `Pause` freezes simulation updates.
- Select a tower to upgrade, sell, or change targeting (`first` / `closest`).
- Click bonus orbs for random buffs.

## Gameplay Summary

- Lives start at 20 and drop when enemies reach the end of the path.
- Credits start at 200 and increase from enemy bounties and wave rewards.
- 10 escalating waves with three enemy classes:
  - Glint Runner (fast, low HP)
  - Bastion Core (slow, high HP)
  - Shard Swarm (mid stats)
- Three tower classes:
  - Pulse Node (rapid single target)
  - Nova Lance (heavy splash)
  - Frost Arc (slow debuff)

All tunable numbers are centralized in [`src/balance.ts`](/Users/leeahmurray/Desktop/PrismTD/src/balance.ts).

## Code Layout

- [`src/main.ts`](/Users/leeahmurray/Desktop/PrismTD/src/main.ts): bootstrap + fixed timestep loop
- `src/game/`: simulation state, waves, combat, buffs
- `src/render/`: canvas draw helpers + neon renderer
- `src/ui/`: DOM HUD/panels/toasts
- [`src/balance.ts`](/Users/leeahmurray/Desktop/PrismTD/src/balance.ts): economy/stats/waves/bonuses
