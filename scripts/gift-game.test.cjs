const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function setupGame() {
  let now = 0;
  let wins = 0;
  const timers = new Map();
  let nextTimer = 0;
  const signal = initial => {
    let value = initial;
    const read = () => value;
    read.set = next => { value = next; };
    read.update = update => { value = update(value); };
    return read;
  };
  const decorator = () => () => {};
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/app/pages/gift-game.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: () => ({ Component: decorator, ViewChild: decorator, inject: () => ({}), afterNextRender: () => {}, signal, output: () => ({ emit: () => wins++ }) }),
    performance: { now: () => now },
    setInterval: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearInterval: id => timers.delete(id),
  });
  return { game: new exports.GiftGame(), timers, setTime: value => { now = value; }, wins: () => wins };
}

test('gift is earned exactly once on the twentieth valid catch, not earlier', () => {
  const s = setupGame();
  s.game.catchGift(0);
  assert.equal(s.game.score(), 0);
  s.game.start();
  for (let i = 1; i <= 19; i++) {
    s.setTime(i * 200);
    s.game.catchGift(s.game.giftId());
    assert.equal(s.wins(), 0);
  }
  assert.equal(s.game.score(), 19);
  s.setTime(4000);
  s.game.catchGift(s.game.giftId());
  assert.equal(s.wins(), 1);
  assert.equal(s.game.state(), 'won');
  assert.equal(s.game.bestScore(), 20);
  assert.equal(s.timers.size, 0);
  s.game.catchGift(s.game.giftId());
  s.game.start();
  assert.equal(s.wins(), 1);
  assert.equal(s.game.score(), 20);
});

test('expired rounds do not accept catches and retries keep the best score', () => {
  const s = setupGame();
  s.game.start();
  for (let i = 1; i <= 5; i++) {
    s.setTime(i * 200);
    s.game.catchGift(s.game.giftId());
  }
  s.setTime(25000);
  s.game.catchGift(s.game.giftId());
  assert.equal(s.game.state(), 'lost');
  assert.equal(s.game.seconds(), 0);
  assert.equal(s.game.score(), 5);
  assert.equal(s.wins(), 0);
  assert.equal(s.timers.size, 0);
  s.game.start();
  assert.equal(s.game.state(), 'playing');
  assert.equal(s.game.score(), 0);
  assert.equal(s.game.seconds(), 25);
  assert.equal(s.game.bestScore(), 5);
});

test('repeated events and stale gift targets do not count twice; moving targets stay in bounds', () => {
  const s = setupGame();
  s.game.start();
  const id = s.game.giftId();
  s.game.catchGift(id);
  s.game.catchGift(id);
  s.game.catchGift(s.game.giftId());
  assert.equal(s.game.score(), 1);
  s.setTime(1000);
  [...s.timers.values()][0]();
  assert.ok(s.game.giftId() > id);
  assert.ok(s.game.position().x >= 15 && s.game.position().x <= 85);
  assert.ok(s.game.position().y >= 15 && s.game.position().y <= 85);
  s.game.ngOnDestroy();
  assert.equal(s.timers.size, 0);
});
