const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name], ...globals }, { filename: file });
  return exports;
}
const signal = initial => {
  let value = initial;
  const read = () => value;
  read.set = next => { value = next; };
  read.update = update => { value = update(value); };
  return read;
};
const decorator = () => () => {};
function setupPage() {
  const renders = [];
  const stats = { starts: 0, stops: 0, shown: 0, stopFocused: 0, triggerFocused: 0 };
  class Music {
    async start() { stats.starts++; }
    stop() { stats.stops++; }
  }
  const core = {
    Component: decorator, ViewChild: decorator, ViewChildren: decorator, signal,
    inject: () => ({}), afterNextRender: callback => renders.push(callback),
  };
  const { Wishes } = load('src/app/pages/wishes.ts', {
    '@angular/core': core, './hardtek-player': { HardtekPlayer: Music },
  }, { document: { getElementById: () => ({ focus: () => stats.triggerFocused++ }) } });
  const page = new Wishes();
  const elements = [1, 2, 3, 4, 5].map(id => ({ nativeElement: {
    open: false,
    showModal() { this.open = true; stats.shown++; },
    close() { if (this.open) { this.open = false; page.onDialogClosed(id); } },
  } }));
  page.dialogs = { forEach: callback => elements.forEach(callback) };
  page.stopButton = { nativeElement: { focus: () => stats.stopFocused++ } };
  const render = () => { while (renders.length) renders.shift()(); };
  return { page, stats, elements, render };
}

test('gift click opens exactly five dialogs and only one audio loop', () => {
  const { page, stats, render } = setupPage();
  page.startPrank();
  page.startPrank();
  assert.equal(page.activeDialogs().length, 5);
  assert.deepEqual(Array.from(page.activeDialogs()), [1, 2, 3, 4, 5]);
  assert.equal(stats.starts, 1);
  render();
  assert.equal(stats.shown, 5);
});

test('stop stays blocked until every dialog is gone, closing the last one does not stop audio', () => {
  const { page, stats, elements, render } = setupPage();
  page.startPrank(); render();
  for (const element of elements.slice(0, 4)) {
    page.dismissDialog(element.nativeElement);
    page.stopPrank();
    assert.equal(stats.stops, 0);
  }
  assert.equal(page.activeDialogs().length, 1);
  page.dismissDialog(elements[4].nativeElement);
  render();
  assert.equal(page.activeDialogs().length, 0);
  assert.equal(stats.stops, 0);
  assert.equal(stats.stopFocused, 1);
  page.stopPrank(); render();
  assert.equal(stats.stops, 1);
  assert.equal(page.prankStarted(), false);
  assert.equal(stats.triggerFocused, 1);
});

test('leaving the page closes dialogs and releases audio, a delayed render cannot reopen them', () => {
  const { page, stats, elements, render } = setupPage();
  page.startPrank();
  page.ngOnDestroy();
  render();
  assert.equal(stats.stops, 1);
  assert.equal(stats.shown, 0);
  assert.ok(elements.every(element => !element.nativeElement.open));
});

function setupAudio(rejectResume = false) {
  const contexts = [];
  class AudioContext {
    constructor() {
      this.sampleRate = 2000;
      this.state = 'suspended';
      this.destination = {};
      this.closed = 0;
      contexts.push(this);
    }
    createBuffer(channels, frames) {
      this.samples = new Float32Array(frames);
      return { getChannelData: () => this.samples };
    }
    createBufferSource() {
      this.source = { connect() {}, disconnect() {}, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
      return this.source;
    }
    createGain() { return { gain: { value: 0 }, connect() {} }; }
    async resume() { if (rejectResume) throw new Error('Audio blocked'); this.state = 'running'; }
    async close() { this.state = 'closed'; this.closed++; }
  }
  const { HardtekPlayer } = load('src/app/pages/hardtek-player.ts', {}, { AudioContext });
  return { player: new HardtekPlayer(), contexts };
}

test('hardtek loop contains bounded nonzero audio, loops, and cleans up without overlap', async () => {
  const { player, contexts } = setupAudio();
  await player.start();
  const first = contexts[0];
  assert.equal(first.source.loop, true);
  assert.equal(first.samples.length, 19200);
  assert.equal(first.source.starts, 1);
  let energy = 0;
  for (const sample of first.samples) {
    assert.ok(Number.isFinite(sample));
    assert.ok(Math.abs(sample) <= 0.28);
    energy += Math.abs(sample);
  }
  assert.ok(energy > 100);
  await player.start();
  assert.equal(first.closed, 1);
  assert.equal(first.source.stops, 1);
  player.stop(); player.stop();
  assert.equal(contexts[1].closed, 1);
  assert.equal(contexts[1].source.stops, 1);
});

test('blocked audio releases the context instead of leaving an orphaned loop', async () => {
  const { player, contexts } = setupAudio(true);
  await assert.rejects(player.start(), /Audio blocked/);
  assert.equal(contexts[0].closed, 1);
  assert.equal(contexts[0].source.stops, 1);
});
