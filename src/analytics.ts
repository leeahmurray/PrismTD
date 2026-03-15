const GA_MEASUREMENT_ID = 'G-JLC9RWQZ0R';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function initAnalytics(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (window.gtag) {
    return;
  }

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]): void {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_title: document.title,
    page_path: window.location.pathname,
    page_location: window.location.href,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);
}
