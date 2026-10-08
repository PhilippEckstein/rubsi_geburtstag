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
function setupPage(playsImmediately = true) {
  const renders = [];
  const stats = { starts: 0, stops: 0, shown: 0, stopFocused: 0, triggerFocused: 0 };
  let music;
  class Music {
    constructor(callbacks) { this.callbacks = callbacks; music = this; }
    async prepare() {}
    start() { stats.starts++; if (playsImmediately) this.callbacks.onPlaying(); }
    stop() { stats.stops++; }
    destroy() { stats.stops++; }
  }
  const core = {
    Component: decorator, ViewChild: decorator, ViewChildren: decorator, signal,
    inject: () => ({}), afterNextRender: callback => renders.push(callback),
  };
  const { Wishes } = load('src/app/pages/wishes.ts', {
    '@angular/core': core, './cantina-player': { CantinaPlayer: Music },
  }, { document: { getElementById: () => ({ focus: () => stats.triggerFocused++ }) } });
  const page = new Wishes();
  page.songReady.set(true);
  page.songContainer = { nativeElement: { scrollIntoView() {} } };
  const elements = [1, 2, 3, 4, 5].map(id => ({ nativeElement: {
    open: false,
    showModal() { this.open = true; stats.shown++; },
    close() { if (this.open) { this.open = false; page.onDialogClosed(id); } },
  } }));
  page.dialogs = { forEach: callback => elements.forEach(callback) };
  page.stopButton = { nativeElement: { focus: () => stats.stopFocused++ } };
  const render = () => { while (renders.length) renders.shift()(); };
  return { page, stats, elements, render, music };
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

test('blocked autoplay leaves the video accessible and opens dialogs only after a real Play click', () => {
  const { page, stats, render, music } = setupPage(false);
  page.startPrank(); render();
  assert.equal(page.startPending(), true);
  assert.equal(page.prankStarted(), false);
  assert.equal(page.activeDialogs().length, 0);
  assert.equal(stats.shown, 0);
  music.callbacks.onBlocked();
  assert.equal(page.autoplayBlocked(), true);
  music.callbacks.onPlaying(); render();
  assert.equal(page.prankStarted(), true);
  assert.equal(page.autoplayBlocked(), false);
  assert.equal(stats.shown, 5);
  music.callbacks.onPlaying(); render();
  assert.equal(stats.shown, 5);
});

test('gift click waits for readiness and a player failure does not open dialogs', () => {
  const { page, stats, music } = setupPage(false);
  page.songReady.set(false);
  page.startPrank();
  assert.equal(stats.starts, 0);
  page.songReady.set(true);
  page.startPrank();
  music.callbacks.onError();
  assert.equal(page.audioError(), true);
  assert.equal(page.startPending(), false);
  assert.equal(page.activeDialogs().length, 0);
});

function setupSong(apiInitiallyReady = true) {
  const frames = [];
  const players = [];
  const scripts = [];
  const timers = new Map();
  let timerId = 0;
  const calls = { playing: 0, blocked: 0, errors: 0 };
  const host = { children: [], appendChild(frame) { this.children.push(frame); } };
  class Player {
    constructor(frame, options) {
      this.events = options.events;
      this.state = 5;
      this.actions = [];
      frame.player = this;
      players.push(this);
    }
    unMute() { this.actions.push('unmute'); }
    setVolume(value) { this.actions.push('volume:' + value); }
    playVideo() { this.actions.push('play'); }
    getPlayerState() { return this.state; }
    stopVideo() { this.actions.push('stop'); }
    destroy() { this.actions.push('destroy'); }
  }
  const scope = { location: { origin: 'https://philippeckstein.github.io' } };
  if (apiInitiallyReady) scope.YT = { Player };
  const { CantinaPlayer } = load('src/app/pages/cantina-player.ts', {}, {
    URL, URLSearchParams, window: scope,
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: id => timers.delete(id),
    document: {
      head: { appendChild(script) { scripts.push(script); } },
      createElement(tag) {
        const element = { style: {}, removed: 0, remove() { this.removed++; host.children = host.children.filter(item => item !== this); } };
        if (tag === 'iframe') frames.push(element);
        else assert.equal(tag, 'script');
        return element;
      },
    },
  });
  const player = new CantinaPlayer({
    onPlaying: () => calls.playing++, onBlocked: () => calls.blocked++, onError: () => calls.errors++,
  });
  const prepare = async () => {
    const promise = player.prepare(host);
    await Promise.resolve();
    players.at(-1).events.onReady({ target: players.at(-1) });
    await promise;
  };
  return { player, host, frames, players, calls, timers, prepare, scope, scripts, Player };
}

test('Cantina player preloads without autoplay, enables API control and retains the single-video loop', async () => {
  const s = setupSong();
  await s.prepare();
  const url = new URL(s.frames[0].src);
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, '/embed/PgKw__lWALI');
  assert.equal(url.searchParams.get('autoplay'), '0');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('loop'), '1');
  assert.equal(url.searchParams.get('playlist'), 'PgKw__lWALI');
  assert.equal(s.calls.playing, 0);
  assert.equal(s.players[0].actions.length, 0);
  s.player.start();
  assert.deepEqual(s.players[0].actions, ['unmute', 'volume:75', 'play']);
  assert.equal(s.calls.playing, 0);
  s.players[0].events.onStateChange({ data: 1 });
  assert.equal(s.calls.playing, 1);
  assert.equal(s.timers.size, 0);
});

test('autoplay-blocked and timeout events request manual Play without claiming success', async () => {
  const s = setupSong();
  await s.prepare();
  s.player.start();
  s.players[0].events.onAutoplayBlocked({});
  assert.equal(s.calls.blocked, 1);
  assert.equal(s.calls.playing, 0);
  assert.equal(s.timers.size, 0);
  s.player.start();
  const timeout = [...s.timers.values()].find(timer => timer.delay === 4000);
  assert.ok(timeout);
  timeout.callback();
  assert.equal(s.calls.blocked, 2);
  s.players[0].events.onStateChange({ data: 1 });
  assert.equal(s.calls.playing, 1);
});

test('stop preserves the prepared player for another gesture; destroy prevents late playback events', async () => {
  const s = setupSong();
  await s.prepare();
  s.player.start();
  s.player.stop();
  assert.equal(s.timers.size, 0);
  assert.equal(s.host.children.length, 1);
  assert.equal(s.players[0].actions.at(-1), 'stop');
  s.player.start();
  s.player.destroy();
  assert.equal(s.host.children.length, 0);
  assert.equal(s.players[0].actions.at(-1), 'destroy');
  s.players[0].events.onStateChange({ data: 1 });
  assert.equal(s.calls.playing, 0);
});

test('leaving during API loading cannot mount a late iframe; a missing container rejects', async () => {
  const s = setupSong(false);
  const preparing = s.player.prepare(s.host);
  assert.equal(s.scripts[0].src, 'https://www.youtube.com/iframe_api');
  s.player.destroy();
  s.scope.YT = { Player: s.Player };
  s.scope.onYouTubeIframeAPIReady();
  await preparing;
  assert.equal(s.frames.length, 0);
  await assert.rejects(s.player.prepare(), /container is not available/);
});
