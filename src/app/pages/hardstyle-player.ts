/** Locally synthesized, looping 320 BPM hardstyle beat. No external music requests. */
export class HardstylePlayer {
  private context?: AudioContext;
  private source?: AudioBufferSourceNode;

  async start(): Promise<void> {
    this.stop();
    const context = new AudioContext();
    this.context = context;
    const beatDuration = 60 / 320;
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
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
      const highNoise = noise - previousNoise;
      previousNoise = noise;
      // Saturated pitched kick with a longer crunchy tail and end-of-phrase rolls.
      const kickTime = beat % 8 === 7 ? phase % (beatDuration / 2) : phase;
      const kickPitch = [52, 52, 49, 55][Math.floor(beat / 8) % 4];
      const kickPhase = 2 * Math.PI * (kickPitch * kickTime + 210 * 0.016 * (1 - Math.exp(-kickTime / 0.016)));
      const kickWave = Math.sin(kickPhase) + Math.sin(kickPhase * 3) * 0.34;
      const kick = Math.tanh(kickWave * 7) * Math.exp(-kickTime * 11);
      const attack = highNoise * Math.exp(-kickTime * 240) * 0.22;
      // Overdriven offbeat saw bass gives the kick a rough, rolling answer.
      const bassTime = phase - beatDuration / 2;
      const bassFrequency = 55 * Math.pow(2, (notes[Math.floor(beat / 2) % notes.length] - 33) / 12);
      const bassSaw = 2 * ((Math.max(0, bassTime) * bassFrequency) % 1) - 1;
      const bass = bassTime >= 0 ? Math.tanh(bassSaw * 5) * Math.exp(-bassTime * 18) : 0;
      const hatPhase = time % (beatDuration / 4);
      const hat = highNoise * Math.exp(-hatPhase * 125) * 0.22;
      const snare = beat % 2 === 1 ? Math.tanh(highNoise * 2) * Math.exp(-phase * 32) * 0.28 : 0;
      // Fast detuned hardstyle lead with octave lifts over the distorted kick.
      const stepDuration = beatDuration / 4;
      const step = Math.floor(time / stepDuration);
      const synthTime = time % stepDuration;
      const note = notes[Math.floor(step / 2) % notes.length] + (beat % 4 >= 2 ? 24 : 12);
      const frequency = 440 * Math.pow(2, (note - 69) / 12);
      const saw = 2 * ((synthTime * frequency) % 1) - 1;
      const detunedSaw = 2 * ((synthTime * frequency * 1.012) % 1) - 1;
      const synth = Math.tanh((saw + detunedSaw * 0.6) * 3) * Math.exp(-synthTime * 22) * 0.25;
      const edgeFade = Math.min(1, time / 0.004, (duration - time) / 0.004);
      // Harder timbre comes from distortion and rhythm; keep output bounded.
      output[i] = Math.tanh((kick * 0.95 + bass * 0.42 + attack + hat + snare + synth) * 1.5) * 0.28 * edgeFade;
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
