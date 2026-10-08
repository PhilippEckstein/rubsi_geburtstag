export const CANTINA_VIDEO_ID = 'PgKw__lWALI';

interface YouTubePlayer {
  playVideo(): void;
  stopVideo(): void;
  unMute(): void;
  setVolume(volume: number): void;
  getPlayerState(): number;
  destroy(): void;
}
interface PlayerEvent { target: YouTubePlayer; data?: number; }
interface YouTubeApi {
  Player: new (frame: HTMLIFrameElement, options: {
    events: Record<string, (event: PlayerEvent) => void>;
  }) => YouTubePlayer;
}
interface PlayerCallbacks {
  onPlaying(): void;
  onBlocked(): void;
  onError(): void;
}
type YouTubeWindow = Window & {
  YT?: YouTubeApi;
  onYouTubeIframeAPIReady?: () => void;
};
let apiPromise: Promise<YouTubeApi> | undefined;

function loadYouTubeApi(): Promise<YouTubeApi> {
  const scope = window as YouTubeWindow;
  if (scope.YT?.Player) return Promise.resolve(scope.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement('script');
    const previousReady = scope.onYouTubeIframeAPIReady;
    const timeout = setTimeout(() => fail(), 15_000);
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      scope.onYouTubeIframeAPIReady = previousReady;
      reject(new Error('YouTube API could not be loaded'));
    };
    scope.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      scope.onYouTubeIframeAPIReady = previousReady;
      previousReady?.();
      if (scope.YT?.Player) resolve(scope.YT);
      else reject(new Error('YouTube API is unavailable'));
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch(error => {
    apiPromise = undefined;
    throw error;
  });
  return apiPromise;
}

/** Prepares the player before the gift click and waits for real playback. */
export class CantinaPlayer {
  private player?: YouTubePlayer;
  private frame?: HTMLIFrameElement;
  private ready = false;
  private generation = 0;
  private startTimeout?: ReturnType<typeof setTimeout>;
  private readyTimeout?: ReturnType<typeof setTimeout>;
  private cancelPreparation?: () => void;

  constructor(private readonly callbacks: PlayerCallbacks) {}

  async prepare(host?: HTMLElement): Promise<void> {
    this.destroy();
    if (!host) throw new Error('Song player container is not available');
    const generation = this.generation;
    const api = await loadYouTubeApi();
    if (generation !== this.generation) return;
    const frame = document.createElement('iframe');
    const url = new URL('https://www.youtube.com/embed/' + CANTINA_VIDEO_ID);
    url.search = new URLSearchParams({
      autoplay: '0', enablejsapi: '1', loop: '1', playlist: CANTINA_VIDEO_ID,
      playsinline: '1', rel: '0', origin: window.location.origin,
    }).toString();
    frame.src = url.toString();
    frame.title = 'Cantina Band – Spielt den selben Song nochmal';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    frame.style.width = '100%'; frame.style.height = '100%'; frame.style.border = '0';
    this.frame = frame;
    host.appendChild(frame);
    await new Promise<void>((resolve, reject) => {
      this.cancelPreparation = resolve;
      const fail = () => {
        clearTimeout(this.readyTimeout);
        this.cancelPreparation = undefined;
        reject(new Error('YouTube player could not be prepared'));
      };
      this.readyTimeout = setTimeout(fail, 15_000);
      this.player = new api.Player(frame, { events: {
        onReady: () => {
          if (generation !== this.generation) return;
          clearTimeout(this.readyTimeout);
          this.cancelPreparation = undefined;
          this.ready = true;
          resolve();
        },
        onStateChange: event => {
          if (generation !== this.generation || event.data !== 1) return;
          clearTimeout(this.startTimeout);
          this.callbacks.onPlaying();
        },
        onAutoplayBlocked: () => {
          if (generation !== this.generation) return;
          clearTimeout(this.startTimeout);
          this.callbacks.onBlocked();
        },
        onError: () => {
          if (generation !== this.generation) return;
          clearTimeout(this.startTimeout);
          fail();
          this.callbacks.onError();
        },
      } });
    });
  }

  start(): void {
    if (!this.player || !this.ready) throw new Error('Song player is not ready');
    clearTimeout(this.startTimeout);
    // These calls must stay synchronous inside the user's gift-click handler.
    this.player.unMute();
    this.player.setVolume(75);
    this.startTimeout = setTimeout(() => this.callbacks.onBlocked(), 4_000);
    this.player.playVideo();
    if (this.player.getPlayerState() === 1) {
      clearTimeout(this.startTimeout);
      this.callbacks.onPlaying();
    }
  }

  stop(): void {
    clearTimeout(this.startTimeout);
    this.player?.stopVideo();
  }

  destroy(): void {
    this.generation++;
    clearTimeout(this.startTimeout);
    clearTimeout(this.readyTimeout);
    this.cancelPreparation?.();
    this.cancelPreparation = undefined;
    this.player?.destroy();
    this.frame?.remove();
    this.player = undefined;
    this.frame = undefined;
    this.ready = false;
  }
}
