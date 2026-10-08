export const CANTINA_VIDEO_ID = 'PgKw__lWALI';

/** Plays the requested recording through YouTube's supported looping embed. */
export class CantinaPlayer {
  private frame?: HTMLIFrameElement;

  async start(host?: HTMLElement): Promise<void> {
    this.stop();
    if (!host) throw new Error('Song player container is not available');
    const frame = document.createElement('iframe');
    const url = new URL('https://www.youtube.com/embed/' + CANTINA_VIDEO_ID);
    url.search = new URLSearchParams({
      autoplay: '1',
      loop: '1',
      playlist: CANTINA_VIDEO_ID,
      playsinline: '1',
      rel: '0',
      origin: window.location.origin,
    }).toString();
    frame.src = url.toString();
    frame.title = 'Cantina Band – Spielt den selben Song nochmal';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    frame.style.width = '100%';
    frame.style.height = '100%';
    frame.style.border = '0';
    this.frame = frame;
    try {
      host.appendChild(frame);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.frame?.remove();
    this.frame = undefined;
  }
}
