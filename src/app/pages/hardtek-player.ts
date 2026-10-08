/** Locally synthesized, looping 200 BPM hardtek beat. No external music requests. */
export class HardtekPlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;

  async start(): Promise<void> {
    this.stop();
    const context = new AudioContext();
    this.context = context;
    const beatDuration = 60 / 200;
    const duration = beatDuration * 32;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const output = buffer.getChannelData(0);
    const notes = [45, 45, 48, 45, 52, 48, 43, 45, 45, 48, 55, 52, 48, 43, 40, 43];
    let seed = 123456;
    let previousNoise = 0;
    for (let i = 0; i < output.length; i++) {
      const time = i / context.sampleRate;
      const beat = Math.floor(time / beatDuration);
      const phase = time % beatDuration;
      // Swept, distorted four-on-the-floor kick.
      const kickPhase = 2 * Math.PI * (48 * phase + 150 * 0.018 * (1 - Math.exp(-phase / 0.018)));
      const kick = Math.tanh(Math.sin(kickPhase) * 4.5) * Math.exp(-phase * 20);
      // Short offbeat bass notes between kicks.
      const bassTime = phase - beatDuration / 2;
      const bassFrequency = 55 * Math.pow(2, (notes[Math.floor(beat / 2) % notes.length] - 33) / 12);
      const bass = bassTime >= 0 ? Math.tanh(Math.sin(2 * Math.PI * bassFrequency * bassTime) * 3) * Math.exp(-bassTime * 24) : 0;
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
      const highNoise = noise - previousNoise;
      previousNoise = noise;
      const hatPhase = time % (beatDuration / 4);
      const hat = highNoise * Math.exp(-hatPhase * 150) * 0.16;
      const snare = beat % 2 === 1 ? highNoise * Math.exp(-phase * 36) * 0.19 : 0;
      // Syncopated acid-style synth pattern over the beat.
      const stepDuration = beatDuration / 2;
      const step = Math.floor(time / stepDuration);
      const synthPhase = time % stepDuration;
      const frequency = 440 * Math.pow(2, (notes[step % notes.length] - 69) / 12);
      const saw = 2 * ((synthPhase * frequency) % 1) - 1;
      const synth = Math.tanh(saw * 1.7) * Math.exp(-synthPhase * 28) * 0.13;
      const edgeFade = Math.min(1, time / 0.004, (duration - time) / 0.004);
      output[i] = Math.tanh(kick * 0.8 + bass * 0.38 + hat + snare + synth) * 0.28 * edgeFade;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = 0.65;
    source.connect(gain);
    gain.connect(context.destination);
    this.source = source;
    source.start();
    try {
      await context.resume();
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
    if (source) {
      source.stop();
      source.disconnect();
    }
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
