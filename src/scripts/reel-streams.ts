import type Hls from 'hls.js';
import type { LoaderCallbacks, LoaderConfiguration, LoaderContext } from 'hls.js';

type Bytes = { data: ArrayBuffer; elapsed: number };

/** Shared by speculative requests and HLS loaders; workers receive copies, not cached buffers. */
export class SegmentCache {
  private entries = new Map<string, Bytes>();
  private pending = new Map<string, { promise: Promise<Bytes>; controller: AbortController }>();
  private size = 0;
  private destroyed = false;
  read(url: string) { return this.entries.has(url) ? Promise.resolve(this.entries.get(url)!) : this.pending.get(url)?.promise; }
  put(url: string, entry: Bytes) {
    if (entry.data.byteLength > 1024 * 1024) return;
    this.size -= this.entries.get(url)?.data.byteLength || 0;
    this.entries.delete(url); this.entries.set(url, entry); this.size += entry.data.byteLength;
    while (this.size > 12 * 1024 * 1024) {
      const key = this.entries.keys().next().value!;
      this.size -= this.entries.get(key)!.data.byteLength; this.entries.delete(key);
    }
  }
  fetch(url: string, priority: 'high' | 'low' | 'auto' = 'auto'): Promise<Bytes> {
    if (this.destroyed) return Promise.reject(new Error('Cache disposed'));
    const existing = this.read(url);
    if (existing) return existing;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    const start = performance.now();
    const promise = fetch(url, { signal: controller.signal, cache: 'force-cache', priority }).then(async response => {
      if (!response.ok || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Segment unavailable');
      const data = await response.arrayBuffer();
      if (data.byteLength > 1024 * 1024) throw new Error('Segment budget exceeded');
      const entry = { data, elapsed: Math.max(1, performance.now() - start) };
      this.put(url, entry); return entry;
    }).finally(() => { clearTimeout(timeout); this.pending.delete(url); });
    this.pending.set(url, { promise, controller });
    return promise;
  }
  cancel() { this.pending.forEach(job => job.controller.abort()); }
  clear() { this.destroyed = true; this.cancel(); this.entries.clear(); this.size = 0; }
}

/** Available before the streaming library finishes loading. */
export async function warmReelStart(cache: SegmentCache, video: HTMLVideoElement, seconds = 2, priority: 'high' | 'low' = 'low') {
  if (!video.dataset.hls) return;
  const master = new URL(video.dataset.hls, location.href);
  if (master.origin !== location.origin) return;
  const playlist = new URL('low/index.m3u8', master);
  const [, bytes] = await Promise.all([cache.fetch(master.href, priority), cache.fetch(playlist.href, priority)]);
  const text = new TextDecoder().decode(bytes.data);
  const init = text.match(/#EXT-X-MAP:URI="([^"]+)"/)?.[1];
  const segments = text.split('\n').filter(line => line && !line.startsWith('#')).slice(0, Math.ceil(seconds / 2));
  await Promise.all([...(init ? [init] : []), ...segments].map(path => cache.fetch(new URL(path, playlist).href, priority)));
}

function cachedLoader(HlsClass: typeof Hls, cache: SegmentCache) {
  return class extends HlsClass.DefaultConfig.loader {
    private cancelled = false;
    override abort() { this.cancelled = true; super.abort(); }
    override destroy() { this.cancelled = true; super.destroy(); }
    override load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>) {
      this.cancelled = false;
      const url = new URL(context.url, location.href).href;
      const request = !context.rangeEnd && new URL(url).origin === location.origin ? cache.fetch(url) : undefined;
      const network = () => super.load(context, config, {
        ...callbacks,
        onSuccess: (response, stats, ctx, details) => {
          if (!context.rangeEnd && (typeof response.data === 'string' || response.data instanceof ArrayBuffer)) {
            const data = typeof response.data === 'string' ? new TextEncoder().encode(response.data).buffer : response.data.slice(0);
            cache.put(context.url, { data, elapsed: Math.max(1, stats.loading.end - stats.loading.start) });
          }
          callbacks.onSuccess(response, stats, ctx, details);
        },
      });
      if (!request) { network(); return; }
      this.context = context;
      void request.then(entry => {
        if (this.cancelled) return;
        const end = performance.now();
        this.stats.loaded = this.stats.total = entry.data.byteLength;
        this.stats.loading = { start: end - entry.elapsed, first: end - entry.elapsed, end };
        callbacks.onSuccess({ url: context.url, data: context.responseType === 'arraybuffer' ? entry.data.slice(0) : new TextDecoder().decode(entry.data) }, this.stats, context, null);
      }).catch(() => { if (!this.cancelled) network(); });
    }
  };
}

type Player = { hls?: Hls; mode: string };

export class ReelStreams {

  private players = new Map<number, Player>();
  private positions: number[];
  private warm = new Map<number, Promise<void>>();
  private active = 0;
  private enabled = false;
  private destroyed = false;
  private Loader;
  constructor(private videos: HTMLVideoElement[], private HlsClass: typeof Hls, private cache = new SegmentCache()) {
    this.positions = videos.map(() => 0);
    this.Loader = cachedLoader(HlsClass, this.cache);
  }
  private async warmStart(index: number, seconds: number) {
    if (this.destroyed || !this.enabled || index < this.active || index > this.active + 2) return;
    await warmReelStart(this.cache, this.videos[index], seconds, index === this.active ? 'high' : 'low');
  }
  private ensure(index: number) {
    const existing = this.players.get(index);
    if (existing) return existing;
    const video = this.videos[index];
    video.disableRemotePlayback = true; // iPhone ManagedMediaSource requires this or an AirPlay alternative.
    const track = video.querySelector('track');
    if (track?.dataset.src && !track.hasAttribute('src')) { video.crossOrigin = 'anonymous'; track.src = track.dataset.src; }
    const hlsUrl = video.dataset.hls;
    let player: Player;
    if (hlsUrl && this.HlsClass.isSupported()) {
      const hls = new this.HlsClass({
        loader: this.Loader, autoStartLoad: false, startLevel: 0, capLevelToPlayerSize: true,
        maxBufferLength: 2, maxMaxBufferLength: 4, maxBufferSize: 0, backBufferLength: 6,
        abrEwmaDefaultEstimate: 500000, testBandwidth: false, lowLatencyMode: false,
      });
      player = { hls, mode: 'hls' };
      this.players.set(index, player);
      hls.on(this.HlsClass.Events.MANIFEST_PARSED, () => {
        if (this.enabled) hls.startLoad(this.positions[index], true);
      });
      hls.on(this.HlsClass.Events.FRAG_BUFFERED, () => {
        if (index !== this.active && video.buffered.length && video.buffered.end(video.buffered.length - 1) - video.currentTime >= 2) hls.pauseBuffering();
      });
      hls.on(this.HlsClass.Events.ERROR, (_event, data) => {
        if (!data.fatal || this.destroyed) return;
        // One deterministic fallback; never endlessly reload a failing HLS source.
        this.positions[index] = video.currentTime || this.positions[index];
        hls.destroy(); this.players.set(index, { mode: 'mp4' });
        video.addEventListener('loadedmetadata', () => { if (this.positions[index] > 0) video.currentTime = this.positions[index]; }, { once: true });
        video.dataset.streamMode = 'mp4'; video.src = video.dataset.src!; video.load();
        video.dispatchEvent(new Event('reel-source-ready'));
      });
      hls.attachMedia(video); hls.loadSource(hlsUrl);
    } else {
      const native = hlsUrl && video.canPlayType('application/vnd.apple.mpegurl');
      player = { mode: native ? 'native-hls' : 'mp4' };
      video.preload = index === this.active ? 'auto' : 'metadata';
      video.src = native ? hlsUrl : video.dataset.src!;
      video.load();
    }
    video.dataset.streamMode = player.mode;
    video.addEventListener('loadedmetadata', () => {
      if (this.positions[index] > 0 && Math.abs(video.currentTime - this.positions[index]) > .2) video.currentTime = this.positions[index];
    }, { once: true });
    this.players.set(index, player);
    return player;
  }
  setWindow(active: number, enabled: boolean, neighbours = true) {
    if (this.destroyed) return;
    this.active = active; this.enabled = enabled;
    if (!enabled) {
      this.cache.cancel(); this.players.forEach(player => player.hls?.stopLoad()); return;
    }
    const end = Math.min(this.videos.length - 1, active + (neighbours ? 2 : 0));
    for (let index = active; index <= end; index++) {
      if (!this.warm.has(index)) {
        const job = this.warmStart(index, 2).catch(() => { this.warm.delete(index); });
        this.warm.set(index, job);
      }
      const player = this.ensure(index);
      if (player.hls) {
        player.hls.autoLevelCapping = index === active ? -1 : 0;
        player.hls.config.maxBufferLength = index === active ? 8 : 2;
        player.hls.config.maxMaxBufferLength = index === active ? 12 : 4;
        if (!player.hls.loadingEnabled) player.hls.startLoad(this.videos[index].currentTime || this.positions[index], true);
        if (index === active) player.hls.resumeBuffering();
      }
    }
    for (const [index, player] of this.players) {
      if (index === active - 1) { player.hls?.stopLoad(); continue; }
      if (index >= active && index <= end) continue;
      this.positions[index] = this.videos[index].currentTime || this.positions[index];
      player.hls?.destroy(); this.videos[index].pause();
      this.videos[index].removeAttribute('src'); this.videos[index].load();
      delete this.videos[index].dataset.streamMode;
      this.players.delete(index); this.warm.delete(index);
    }
  }
  destroy() {
    this.destroyed = true; this.cache.clear();
    this.players.forEach(player => player.hls?.destroy()); this.players.clear();
  }
}
