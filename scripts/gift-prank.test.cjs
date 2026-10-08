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
    '@angular/core': core, './cantina-player': { CantinaPlayer: Music },
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

function setupSong() {
  const frames = [];
  const host = { children: [], appendChild(frame) { this.children.push(frame); } };
  const { CantinaPlayer } = load('src/app/pages/cantina-player.ts', {}, {
    URL, URLSearchParams,
    window: { location: { origin: 'https://philippeckstein.github.io' } },
    document: { createElement(tag) {
      assert.equal(tag, 'iframe');
      const frame = { style: {}, removed: 0, remove() { this.removed++; host.children = host.children.filter(item => item !== this); } };
      frames.push(frame);
      return frame;
    } },
  });
  return { player: new CantinaPlayer(), host, frames };
}

test('requested Cantina recording starts with autoplay and a single-video loop', async () => {
  const { player, host, frames } = setupSong();
  await player.start(host);
  assert.equal(host.children.length, 1);
  const url = new URL(frames[0].src);
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, '/embed/PgKw__lWALI');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('loop'), '1');
  assert.equal(url.searchParams.get('playlist'), 'PgKw__lWALI');
  assert.equal(url.searchParams.get('origin'), 'https://philippeckstein.github.io');
  assert.equal(frames[0].referrerPolicy, 'strict-origin-when-cross-origin');
  assert.ok(frames[0].allow.includes('autoplay'));
});

test('stop removes the playback frame and repeated starts never overlap', async () => {
  const { player, host, frames } = setupSong();
  await player.start(host);
  await player.start(host);
  assert.equal(frames[0].removed, 1);
  assert.equal(host.children.length, 1);
  player.stop(); player.stop();
  assert.equal(frames[1].removed, 1);
  assert.equal(host.children.length, 0);
});

test('a missing playback container is reported and cleans up the previous song', async () => {
  const { player, host, frames } = setupSong();
  await player.start(host);
  await assert.rejects(player.start(), /container is not available/);
  assert.equal(frames[0].removed, 1);
  assert.equal(host.children.length, 0);
});
