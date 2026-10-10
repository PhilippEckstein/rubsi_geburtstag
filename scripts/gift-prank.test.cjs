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
function setupPage(startFailure = false, pendingStart = undefined) {
  const renders = [];
  const stats = { starts: 0, stops: 0, shown: 0, stopFocused: 0, triggerFocused: 0 };
  class Music {
    async start() { stats.starts++; if (startFailure) throw new Error("Audio blocked"); if (pendingStart) await pendingStart; }
    stop() { stats.stops++; }
  }
  const core = {
    Component: decorator, ViewChild: decorator, ViewChildren: decorator, signal,
    inject: () => ({}), afterNextRender: callback => renders.push(callback),
  };
  const { Wishes } = load('src/app/pages/wishes.ts', {
    '@angular/core': core, './hardstyle-player': { HardstylePlayer: Music }, './gift-game': { GiftGame: class {} },
  }, { document: { getElementById: () => ({ focus: () => stats.triggerFocused++ }) } });
  const page = new Wishes();
  const elements = Array.from({ length: 25 }, (_, index) => index + 1).map(id => ({ nativeElement: {
    open: false,
    showModal() { this.open = true; stats.shown++; },
    close() { if (this.open) { this.open = false; page.onDialogClosed(id); } },
  } }));
  page.dialogs = { forEach: callback => elements.forEach(callback) };
  page.stopButton = { nativeElement: { focus: () => stats.stopFocused++ } };
  const render = () => { while (renders.length) renders.shift()(); };
  return { page, stats, elements, render };
}

test('gift click opens exactly 25 dialogs and only one audio loop', async () => {
  const { page, stats, render } = setupPage();
  await page.startPrank();
  await page.startPrank();
  assert.equal(page.activeDialogs().length, 25);
  assert.deepEqual(Array.from(page.activeDialogs()), Array.from({ length: 25 }, (_, index) => index + 1));
  assert.equal(stats.starts, 1);
  render();
  assert.equal(stats.shown, 25);
});

test('stop stays blocked until every dialog is gone, closing the last one does not stop audio', async () => {
  const { page, stats, elements, render } = setupPage();
  await page.startPrank(); render();
  for (const element of elements.slice(0, 24)) {
    page.dismissDialog(element.nativeElement);
    page.stopPrank();
    assert.equal(stats.stops, 0);
  }
  assert.equal(page.activeDialogs().length, 1);
  page.dismissDialog(elements[24].nativeElement);
  render();
  assert.equal(page.activeDialogs().length, 0);
  assert.equal(stats.stops, 0);
  assert.equal(stats.stopFocused, 1);
  page.stopPrank(); render();
  assert.equal(stats.stops, 1);
  assert.equal(page.prankStarted(), false);
  assert.equal(stats.triggerFocused, 0);
});

test('leaving the page closes dialogs and releases audio, a delayed render cannot reopen them', async () => {
  const { page, stats, elements, render } = setupPage();
  await page.startPrank();
  page.ngOnDestroy();
  render();
  assert.equal(stats.stops, 1);
  assert.equal(stats.shown, 0);
  assert.ok(elements.every(element => !element.nativeElement.open));
});

function setupAudio(rejectResume = false, options = {}) {
  const contexts = [];
  const requests = [];
  const songBuffer = { duration: 48, numberOfChannels: 2 };
  class AudioContext {
    constructor() {
      this.state = 'suspended';
      this.destination = {};
      this.closed = 0;
      contexts.push(this);
    }
    async decodeAudioData(data) {
      this.decoded = data;
      if (options.decodeFailure) throw new Error('Invalid audio');
      if (options.decodeGate) await options.decodeGate;
      return songBuffer;
    }
    createBufferSource() {
      this.source = { connect() {}, disconnect() {}, starts: 0, stops: 0, start() { this.starts++; }, stop() { this.stops++; } };
      return this.source;
    }
    createGain() { return { gain: { value: 0 }, connect() {} }; }
    async resume() { if (rejectResume) throw new Error('Audio blocked'); this.state = 'running'; }
    async close() { this.state = 'closed'; this.closed++; }
  }
  const fetch = async (url, request) => {
    assert.equal(contexts.at(-1).state, 'running', 'unlock audio before fetching');
    requests.push({ url, ...request });
    return { ok: !options.missing, arrayBuffer: async () => new ArrayBuffer(8) };
  };
  const { HardstylePlayer } = load('src/app/pages/hardstyle-player.ts', {}, { AudioContext, AbortController, fetch });
  return { player: new HardstylePlayer(), contexts, requests, songBuffer };
}

test('local birthday song is decoded, loops, and cleans up without overlapping playback', async () => {
  const { player, contexts, requests, songBuffer } = setupAudio();
  await player.start();
  const first = contexts[0];
  assert.equal(requests[0].url, 'audio/happy-birthday-rubsi.mp3');
  assert.equal(first.source.buffer, songBuffer);
  assert.equal(first.source.loop, true);
  assert.equal(first.source.starts, 1);
  await player.start();
  assert.equal(first.closed, 1);
  assert.equal(first.source.stops, 1);
  assert.equal(requests[0].signal.aborted, true);
  player.stop(); player.stop();
  assert.equal(contexts[1].closed, 1);
  assert.equal(contexts[1].source.stops, 1);
  assert.equal(requests[1].signal.aborted, true);
});

test('blocked audio releases the context without requesting the song', async () => {
  const { player, contexts, requests } = setupAudio(true);
  await assert.rejects(player.start(), /Audio blocked/);
  assert.equal(contexts[0].closed, 1);
  assert.equal(contexts[0].source, undefined);
  assert.equal(requests.length, 0);
});

test('failed song loading or decoding releases audio and allows a later retry', async () => {
  for (const options of [{ missing: true }, { decodeFailure: true }]) {
    const { player, contexts, requests } = setupAudio(false, options);
    await assert.rejects(player.start());
    assert.equal(contexts[0].closed, 1);
    assert.equal(contexts[0].source, undefined);
    assert.equal(requests[0].signal.aborted, true);
    options.missing = false;
    options.decodeFailure = false;
    await player.start();
    assert.equal(contexts[1].source.starts, 1);
    player.stop();
  }
});

test('stopping during song decoding prevents late playback and closes the context', async () => {
  let finishDecode;
  const decodeGate = new Promise(resolve => { finishDecode = resolve; });
  const { player, contexts, requests } = setupAudio(false, { decodeGate });
  const starting = player.start();
  await new Promise(resolve => setImmediate(resolve));
  player.stop();
  finishDecode();
  await starting;
  assert.equal(contexts[0].closed, 1);
  assert.equal(contexts[0].source, undefined);
  assert.equal(requests[0].signal.aborted, true);
});

test('failed audio startup keeps the gift button retryable and does not open silent dialogs', async () => {
  const { page, stats, render } = setupPage(true);
  await page.startPrank(); render();
  assert.equal(page.audioError(), true);
  assert.equal(page.startPending(), false);
  assert.equal(page.prankStarted(), false);
  assert.equal(stats.shown, 0);
});

test('leaving while audio starts prevents the resolved startup from reopening the prank', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const { page, stats, render } = setupPage(false, pending);
  const starting = page.startPrank();
  page.startPrank();
  assert.equal(stats.starts, 1);
  page.ngOnDestroy();
  resolve();
  await starting;
  render();
  assert.equal(stats.stops, 1);
  assert.equal(stats.shown, 0);
  assert.equal(page.activeDialogs().length, 0);
});

test('game stays hidden until all 25 dialogs close and music stopping cannot bypass the win', async () => {
  const { page, elements, render } = setupPage();
  page.onDialogClosed(99);
  page.onGameEarned();
  assert.equal(page.gameUnlocked(), false);
  assert.equal(page.gameWon(), false);
  await page.startPrank(); render();
  for (const element of elements.slice(0, 24)) {
    page.dismissDialog(element.nativeElement);
    assert.equal(page.gameUnlocked(), false);
  }
  page.dismissDialog(elements[24].nativeElement); render();
  assert.equal(page.gameUnlocked(), true);
  assert.equal(page.gameWon(), false);
  page.stopPrank(); render();
  assert.equal(page.gameUnlocked(), true);
  assert.equal(page.gameWon(), false);
  page.onGameEarned(); render();
  assert.equal(page.gameWon(), true);
});
