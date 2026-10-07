const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, globals = {}) {
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
function setup() {
  const timers = [];
  const cleared = [];
  const core = { signal, Injectable: decorator, Component: decorator, ViewChild: decorator, HostListener: decorator };
  const { GiftState } = load('src/app/gift-state.ts', { '@angular/core': core }, {
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: id => cleared.push(id),
  });
  const gift = new GiftState();
  const navigations = [];
  const router = { navigateByUrl: path => { navigations.push(path); return Promise.resolve(true); }, createUrlTree: path => ({ redirect: path }) };
  const routerToken = {};
  core.inject = token => token === GiftState ? gift : router;
  const pending = new Set();
  let nextFrame = 0;
  const { Birthday } = load('src/app/pages/birthday.ts', {
    '@angular/core': core, '@angular/router': { Router: routerToken }, '../gift-state': { GiftState },
  }, {
    window: { innerWidth: 1000, innerHeight: 800 }, performance: { now: () => 0 },
    requestAnimationFrame: () => { pending.add(++nextFrame); return nextFrame; },
    cancelAnimationFrame: id => pending.delete(id),
  });
  const birthday = new Birthday();
  const dialog = {
    open: false,
    showModal() { this.open = true; },
    close() { this.open = false; },
    getBoundingClientRect() { const p = birthday.position(); return { left: p.x, top: p.y, width: 340, height: 270 }; },
  };
  birthday.dialog = { nativeElement: dialog };
  birthday.button = { nativeElement: { getBoundingClientRect() {
    const p = birthday.position(); return { left: p.x + 65, right: p.x + 275, top: p.y + 190, bottom: p.y + 240, width: 210, height: 50 };
  } } };
  const { routes } = load('src/app/app.routes.ts', {
    '@angular/core': core, '@angular/router': { Router: routerToken },
    './pages/birthday': { Birthday }, './pages/wishes': { Wishes: class {} }, './gift-state': { GiftState },
  });
  return { gift, birthday, dialog, timers, cleared, navigations, pending, routes };
}

test('second page stays locked until ten seconds after the dialog opens', () => {
  const s = setup();
  const guard = s.routes.find(r => r.path === 'geschenk').canActivate[0];
  assert.equal(s.gift.unlocked(), false);
  assert.deepEqual(Array.from(guard().redirect), ['/geburtstag']);
  s.birthday.openGift();
  assert.equal(s.timers.length, 1);
  assert.equal(s.timers[0].delay, 10_000);
  s.birthday.revealGift();
  assert.equal(s.navigations.length, 0);
  s.timers[0].callback();
  assert.equal(s.gift.unlocked(), true);
  assert.equal(guard(), true);
  s.birthday.revealGift();
  assert.deepEqual(s.navigations, ['/geschenk']);
  assert.equal(s.dialog.open, false);
});

test('approaching the button moves the whole dialog smoothly within the viewport', () => {
  const s = setup();
  s.birthday.openGift();
  const initial = { ...s.birthday.position() };
  s.birthday.onPointerMove({ clientX: 0, clientY: 0 });
  s.birthday.animate(200);
  assert.equal(s.birthday.position().x, initial.x);
  assert.equal(s.birthday.position().y, initial.y);
  s.birthday.onPointerMove({ clientX: initial.x + 170, clientY: initial.y + 180 });
  s.birthday.animate(400);
  const moved = s.birthday.position();
  assert.notDeepEqual(moved, initial);
  assert.notDeepEqual(moved, s.birthday.target);
  assert.ok(moved.x >= 16 && moved.x <= 644);
  assert.ok(moved.y >= 16 && moved.y <= 514);
});

test('unlocking freezes the current position without finishing the pending move', () => {
  const s = setup();
  s.birthday.openGift();
  const p = s.birthday.position();
  s.birthday.onPointerMove({ clientX: p.x + 170, clientY: p.y + 210 });
  s.birthday.animate(200);
  const current = { ...s.birthday.position() };
  assert.notDeepEqual(current, s.birthday.target);
  s.timers[0].callback();
  s.birthday.animate(300);
  s.birthday.onPointerDown({ clientX: current.x + 170, clientY: current.y + 210 });
  s.birthday.animate(1000);
  assert.equal(s.birthday.position().x, current.x);
  assert.equal(s.birthday.position().y, current.y);
});

test('touch can trigger evasion, reopening cannot reset the timer, cleanup cancels animation', () => {
  const s = setup();
  s.birthday.openGift();
  const p = s.birthday.position();
  s.birthday.lastEscape = -200;
  s.birthday.onPointerDown({ clientX: p.x + 170, clientY: p.y + 210 });
  assert.notDeepEqual(s.birthday.target, p);
  s.birthday.closeGift();
  assert.equal(s.pending.size, 0);
  s.birthday.openGift();
  assert.equal(s.timers.length, 1);
  s.birthday.ngOnDestroy();
  assert.equal(s.dialog.open, false);
  assert.equal(s.pending.size, 0);
  s.gift.ngOnDestroy();
  assert.deepEqual(s.cleared, [1]);
});
