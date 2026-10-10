// Original 48-second, 320 BPM stereo beat with synthetic birthday vocal chops.
const fs = require('node:fs');
const path = require('node:path');
const directory = process.argv[2];
if (!directory) throw new Error('Pass the speech WAV directory.');
const sampleRate = 44100;
const beatDuration = 60 / 320;
const duration = beatDuration * 256;
const left = new Float32Array(duration * sampleRate);
const right = new Float32Array(left.length);
const vocal = new Float32Array(left.length);
const notes = [45, 45, 48, 45, 52, 48, 43, 45, 45, 48, 55, 52, 48, 43, 40, 43];
let seed = 123456;
let previousNoise = 0;
for (let i = 0; i < left.length; i++) {
  const time = i / sampleRate;
  const beat = Math.floor(time / beatDuration);
  const phase = time % beatDuration;
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
  const highNoise = noise - previousNoise;
  previousNoise = noise;
  const buildup = beat >= 112 && beat < 128;
  const breakdown = beat >= 80 && beat < 112;
  const kickTime = (beat % 16 >= 14 || buildup) ? phase % (beatDuration / 2) : phase;
  const kickPitch = [52, 52, 49, 55][Math.floor(beat / 16) % 4];
  const kickPhase = 2 * Math.PI * (kickPitch * kickTime + 210 * 0.016 * (1 - Math.exp(-kickTime / 0.016)));
  const kick = Math.tanh((Math.sin(kickPhase) + Math.sin(kickPhase * 3) * 0.34) * 7) * Math.exp(-kickTime * 11);
  const bassTime = phase - beatDuration / 2;
  const bassFrequency = 55 * Math.pow(2, (notes[Math.floor(beat / 2) % notes.length] - 33) / 12);
  const bassSaw = 2 * ((Math.max(0, bassTime) * bassFrequency) % 1) - 1;
  const bass = bassTime >= 0 ? Math.tanh(bassSaw * 5) * Math.exp(-bassTime * 18) : 0;
  const hat = highNoise * Math.exp(-(time % (beatDuration / 4)) * 125) * 0.15;
  const snare = beat % 2 === 1 ? Math.tanh(highNoise * 2) * Math.exp(-phase * 32) * 0.24 : 0;
  const stepDuration = beatDuration / 2;
  const step = Math.floor(time / stepDuration);
  const synthTime = time % stepDuration;
  const note = notes[Math.floor(step / 2) % notes.length] + (beat % 4 >= 2 ? 24 : 12);
  const frequency = 440 * Math.pow(2, (note - 69) / 12);
  const saw = 2 * ((synthTime * frequency) % 1) - 1;
  const detunedSaw = 2 * ((synthTime * frequency * 1.012) % 1) - 1;
  const synth = Math.tanh((saw + detunedSaw * 0.6) * 3) * Math.exp(-synthTime * 22) * 0.22;
  const kickLevel = breakdown ? 0.16 : buildup ? 0.3 : 0.9;
  left[i] = right[i] = Math.tanh((kick * kickLevel + bass * (breakdown ? 0.12 : 0.4) + hat + snare + synth) * 1.5) * 0.33;
}

function readWave(filename) {
  const buffer = fs.readFileSync(path.join(directory, filename));
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Invalid WAV');
  let samples;
  let validFormat = false;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const kind = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (kind === 'fmt ') validFormat = buffer.readUInt16LE(start) === 1 && buffer.readUInt16LE(start + 2) === 1
      && buffer.readUInt32LE(start + 4) === sampleRate && buffer.readUInt16LE(start + 14) === 16;
    if (kind === 'data') samples = Float32Array.from({ length: length / 2 }, (_, i) => buffer.readInt16LE(start + i * 2) / 32768);
    offset = start + length + length % 2;
  }
  if (!validFormat || !samples) throw new Error('Expected 44.1 kHz mono PCM16 WAV');
  let first = 0; let last = samples.length - 1;
  while (first < last && Math.abs(samples[first]) < 0.007) first++;
  while (last > first && Math.abs(samples[last]) < 0.007) last--;
  return samples.slice(Math.max(0, first - 220), Math.min(samples.length, last + 441));
}

function addVoice(samples, startBeat, pitch = 1, level = 0.9, maxBeats = Infinity, echo = true) {
  const start = Math.round(startBeat * beatDuration * sampleRate);
  const count = Math.min(Math.floor(samples.length / pitch), Math.floor(maxBeats * beatDuration * sampleRate));
  for (let i = 0; i < count && start + i < vocal.length; i++) {
    const position = i * pitch;
    const index = Math.floor(position);
    const fraction = position - index;
    const value = samples[index] * (1 - fraction) + (samples[index + 1] ?? 0) * fraction;
    const processed = Math.tanh(value * 2.3) * level * Math.min(1, i / 180, (count - i) / 220);
    vocal[start + i] += processed;
    if (echo) {
      const delay = Math.round(beatDuration * sampleRate * 2);
      if (start + i + delay < left.length) left[start + i + delay] += processed * 0.16;
      if (start + i + delay * 2 < right.length) right[start + i + delay * 2] += processed * 0.1;
    }
  }
}
for (let name = 0; name < 5; name++) {
  const phrase = readWave(`birthday-${name}.wav`);
  const nickname = readWave(`name-${name}.wav`);
  addVoice(phrase, name * 16, 1, 0.8, 15);
  addVoice(nickname, 80 + name * 8, 0.9, 0.8, 5);
  addVoice(nickname, 84 + name * 8, 1.18, 0.65, 3);
  addVoice(phrase, 128 + name * 16, [1.12, 0.94, 1.08, 1, 1.16][name], 0.85, 15);
  for (let repeat = 0; repeat < 3; repeat++) addVoice(nickname, 208 + name * 8 + repeat, 1.1, 0.7, 0.8, false);
  addVoice(nickname, 211 + name * 8, 1, 0.85, 4);
}
addVoice(readWave('outro.wav'), 248, 1.18, 0.8, 8, false);
let peak = 0;
for (let i = 0; i < left.length; i++) {
  const duck = 1 - Math.min(0.5, Math.abs(vocal[i]) * 0.6);
  const fade = Math.min(1, i / 200, (left.length - i) / 200);
  left[i] = Math.tanh(left[i] * duck + vocal[i] * 0.72) * 0.85 * fade;
  right[i] = Math.tanh(right[i] * duck + vocal[i] * 0.72) * 0.85 * fade;
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}
const wav = Buffer.alloc(44 + left.length * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
wav.writeUInt32LE(left.length * 4, 40);
for (let i = 0; i < left.length; i++) {
  wav.writeInt16LE(Math.round(left[i] * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(right[i] * 32767), 46 + i * 4);
}
fs.writeFileSync(path.join(directory, 'birthday-song.wav'), wav);
console.log(`Rendered ${duration}s, 320 BPM, stereo; peak ${peak.toFixed(3)}; all five nicknames in three variations.`);
