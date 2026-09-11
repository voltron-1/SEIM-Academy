/**
 * Service worker registration and connectivity state (#28, #32).
 *
 * Registration is production-only. In dev the worker would serve yesterday's bundle from
 * cache and make every change look like it did not apply — a debugging tax with no
 * benefit, since the offline path is verified against a built bundle anyway.
 */
import { BASE_URL, IS_PROD } from './env';

export function registerServiceWorker(): void {
  if (!IS_PROD) return;
  if (!('serviceWorker' in navigator)) return;
  globalThis.addEventListener('load', () => {
    // A registration failure is not the learner's problem: the app works without it, it
    // just will not work offline. Nothing is shown.
    void navigator.serviceWorker.register(`${BASE_URL}sw.js`).catch(() => {});
  });
}

/** `navigator.onLine` is a hint, not a guarantee — it reports a link, not reachability. */
export const isOnline = (): boolean =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

export function watchConnectivity(onChange: (online: boolean) => void): () => void {
  const update = () => onChange(isOnline());
  globalThis.addEventListener('online', update);
  globalThis.addEventListener('offline', update);
  return () => {
    globalThis.removeEventListener('online', update);
    globalThis.removeEventListener('offline', update);
  };
}
