import './style.css';
import { initAnalytics } from './analytics';
import { canUseLocalMapLab } from './game/maps';
import { mountGameApp } from './pages/game-app';
import { mountMapBuilderApp } from './pages/map-builder-app';

initAnalytics();

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing app root');
}
const appRoot = app;

function normalizePathname(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized === '' ? '/' : normalized;
}

function renderRoute(): void {
  const pathname = normalizePathname(window.location.pathname);

  if (pathname === '/map-builder') {
    if (canUseLocalMapLab()) {
      mountMapBuilderApp(appRoot);
    } else {
      window.history.replaceState({}, '', '/');
      mountGameApp(appRoot);
    }
    return;
  }

  mountGameApp(appRoot);
}

renderRoute();
