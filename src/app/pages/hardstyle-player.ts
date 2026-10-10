/** Original local birthday hardstyle song with synthetic nickname vocals. */
export class HardstylePlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;
  private request?: AbortController;

  async start(): Promise<void> {
    this.stop();
    const context = new AudioContext();
    const request = new AbortController();
    this.context = context;
    this.request = request;
    try {
      // Unlock audio directly in the gift click, before loading the song.
      await context.resume();
      if (this.context !== context) return;
      const response = await fetch('audio/happy-birthday-rubsi.mp3', { signal: request.signal });
      if (!response.ok) throw new Error('Birthday song could not be loaded');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (this.context !== context) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      gain.gain.value = 0.65;
      source.connect(gain);
      gain.connect(context.destination);
      this.source = source;
      source.start();
    } catch (error) {
      if (this.context === context) this.stop();
      throw error;
    }
  }

  stop(): void {
    const source = this.source;
    const context = this.context;
    this.source = undefined;
    this.context = undefined;
    this.request?.abort();
    this.request = undefined;
    if (source) {
      source.stop();
      source.disconnect();
    }
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
