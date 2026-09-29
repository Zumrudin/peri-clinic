// One controller owns both UI and tracking, including Astro's persistent-page lifecycle.
const KEY = 'peri_analytics_consent';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
type Choice = { choice: 'accepted' | 'rejected'; version: string; sha256: string; counter: string; at: string; expires: number };
type MetrikaWindow = Window & { ym?: (...args: unknown[]) => void; [key: `disableYaCounter${string}`]: boolean };
export function initCookieConsent() {
  const el = document.querySelector<HTMLElement>('[data-cookie-notice]');
  if (!el || el.dataset.initialized) return;
  el.dataset.initialized = 'true';
  const win = window as unknown as MetrikaWindow;
  const counter = el.dataset.counter || '';
  const configured = /^[1-9]\d*$/.test(counter);
  const version = el.dataset.version!;
  const sha256 = el.dataset.sha256!;
  const status = el.querySelector<HTMLElement>('[data-cookie-status]')!;
  let choice: Choice | null = null;
  let active = false, loading = false, loaded = false, storageFailed = false;
  let expiryTimer: ReturnType<typeof setTimeout> | undefined;
  let opener: HTMLElement | null = null;
  let lastPage = '';
  const read = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      return raw && ['accepted', 'rejected'].includes(raw.choice) && raw.version === version && raw.sha256 === sha256 && raw.counter === counter &&
        Number.isFinite(raw.expires) && raw.expires > Date.now() && raw.expires <= Date.now() + MAX_AGE &&
        Number.isFinite(Date.parse(raw.at)) && Date.parse(raw.at) <= Date.now() ? raw as Choice : null;
    } catch { return null; }
  };
  const allowed = () => configured && choice?.choice === 'accepted' && choice.expires > Date.now();
  const cleanURL = () => location.origin + location.pathname;
  const cleanReferrer = () => { try { const u = new URL(document.referrer); return u.origin + u.pathname; } catch { return ''; } };
  const hit = () => {
    if (!active || !allowed()) return;
    const url = cleanURL();
    if (lastPage === url) return;
    lastPage = url;
    win.ym?.(Number(counter), 'hit', url, { title: document.title, referer: cleanReferrer() });
  };
  const start = () => {
    if (!allowed() || active) return;
    win[`disableYaCounter${counter}`] = false;
    if (!loaded) {
      if (loading) return;
      loading = true;
      if (!win.ym) {
        const queue = function (...args: unknown[]) { queue.a.push(args); };
        queue.a = [] as unknown[][];
        queue.l = Date.now();
        win.ym = queue;
      }
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://mc.yandex.ru/metrika/tag.js';
      script.dataset.periMetrika = 'true';
      // No init command is queued: a refusal while tag.js is in flight cannot start a counter.
      script.onload = () => { loading = false; loaded = true; start(); };
      script.onerror = () => { loading = false; script.remove(); };
      document.head.append(script);
      return;
    }
    if (!win.ym) return;
    active = true;
    win.ym(Number(counter), 'init', { defer: true, webvisor: false, clickmap: false, trackLinks: false, accurateTrackBounce: false, trackHash: false, url: cleanURL(), referrer: cleanReferrer() });
    hit();
  };
  function clearAnalyticsStorage() {
    // Only first-party Metrica keys; preserve application data and the user's refusal.
    try {
      for (const store of [localStorage, sessionStorage]) {
        for (const key of Object.keys(store)) if (/^_ym/.test(key)) store.removeItem(key);
      }
    } catch { /* Storage can be disabled by the browser. */ }
    const domains = ['', ...location.hostname.split('.').map((_, i, parts) => '.' + parts.slice(i).join('.'))];
    const paths = ['/', ...location.pathname.split('/').map((_, i, parts) => parts.slice(0, i + 1).join('/') || '/')];
    for (const part of document.cookie.split(';')) {
      const name = part.trim().split('=')[0];
      if (!/^_ym/.test(name)) continue;
      for (const domain of domains) for (const path of paths) document.cookie = `${name}=; Max-Age=0; path=${path}${domain ? '; domain=' + domain : ''}`;
    }
  }
  const stop = () => {
    if (configured) win[`disableYaCounter${counter}`] = true;
    if (active) win.ym?.(Number(counter), 'destruct');
    active = false;
    lastPage = '';
    clearAnalyticsStorage();
  };
  const render = () => {
    el.querySelector<HTMLElement>('[data-cookie-revoke]')!.hidden = !allowed();
    el.querySelector<HTMLElement>('[data-cookie-reject]')!.hidden = !!allowed();
    (el.querySelector('[data-cookie-accept]') as HTMLButtonElement).disabled = !configured || !!allowed();
    status.textContent = storageFailed ? el.dataset.storageError! : allowed() ? el.dataset.enabled! : el.dataset.disabled!;
  };
  const sync = () => {
    clearTimeout(expiryTimer);
    if (allowed()) start(); else stop();
    render();
    if (choice) expiryTimer = setTimeout(() => { choice = read(); sync(); if (!choice && configured) el.hidden = false; }, Math.min(choice.expires - Date.now() + 20, 2_147_483_647));
  };
  const hide = () => { el.hidden = true; if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  const save = (value: Choice['choice']) => {
    if (value === 'accepted' && !configured) return;
    const record: Choice = { choice: value, version, sha256, counter, at: new Date().toISOString(), expires: Date.now() + MAX_AGE };
    storageFailed = false;
    try {
      localStorage.setItem(KEY, JSON.stringify(record));
      choice = record;
    } catch {
      // No lasting evidence => no tracking. Refusal still works for this open page.
      storageFailed = true;
      try { localStorage.removeItem(KEY); } catch { /* Fail closed for the current document. */ }
      choice = value === 'rejected' ? record : null;
    }
    sync();
    if (!storageFailed) hide();
  };
  document.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target : null;
    const settings = target?.closest<HTMLElement>('[data-cookie-settings]');
    if (settings) { opener = settings; render(); el.hidden = false; el.focus({ preventScroll: true }); return; }
    if (!target || !el.contains(target)) return;
    if (target.closest('[data-cookie-accept]')) save('accepted');
    else if (target.closest('[data-cookie-reject], [data-cookie-revoke]')) save('rejected');
    else if (target.closest('[data-cookie-close]')) hide();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('peri:contact', (e) => {
    const goal = (e as CustomEvent).detail?.goal;
    if (active && allowed() && typeof goal === 'string' && /^contact_(call|tg|wa|max)$/.test(goal)) win.ym?.(Number(counter), 'reachGoal', goal);
  });
  window.addEventListener('storage', e => { if (e.key === KEY || e.key === null) { choice = read(); sync(); el.hidden = !!choice || !configured; } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (!storageFailed) choice = read(); sync(); if (!choice && configured) el.hidden = false; } });
  document.addEventListener('astro:page-load', () => { sync(); hit(); });
  // Old unversioned acceptance must never enable analytics.
  try { localStorage.removeItem('peri_consent'); } catch { /* Optional migration. */ }
  choice = read();
  sync();
  el.hidden = !!choice || !configured;
}
