import test from 'node:test';
import assert from 'node:assert/strict';
import { Interpreter } from '../js/runtime/interpreter.js';
import { Scheduler } from '../js/runtime/scheduler.js';
import { SpriteStage } from '../js/stages/sprite.js';
import { TurtleStage } from '../js/stages/turtle.js';
import { DeviceStage } from '../js/stages/device.js';
import { projectToJS, jsToBlocks } from '../js/runtime/tojs.js';

function canvas() {
  const ctx = new Proxy({}, { get: (obj, key) => obj[key] ?? (() => {}) });
  return { getContext: () => ctx, addEventListener() {} };
}

function block(type, fields = {}, inputs = {}) {
  return { id: type, type, fields, inputs };
}

test('parallel custom calls retain lexical arguments when a hat is suspended or cancelled', () => {
  const distances = [];
  const project = {
    stage: 'turtle',
    funcs: [{ name: 'line', body: [
      block('control_wait', { SECS: 1 }),
      block('turtle_forward', {}, { STEPS: block('func_arg', { VALUE: 0 }) })
    ] }]
  };
  const stage = { getAPI: () => ({ forward: distance => { distances.push(distance); } }) };
  const vm = new Interpreter({ project, stage });
  function call(value) {
    return vm.runBlocks([block('func_call', { NAME: 'line', ARGS: String(value) })], 0);
  }
  const first = call(15);
  const second = call(90);
  const interrupted = call(200);
  for (const iterator of [first, second, interrupted]) {
    assert.equal(iterator.next().value.kind, 'highlight');
    assert.equal(iterator.next().value.kind, 'highlight');
    assert.equal(iterator.next().value.kind, 'sleep');
  }
  interrupted.return();
  Array.from(first);
  Array.from(second);
  assert.deepEqual(distances, [15, 90]);
});

test('sprite coordinates, compass turns and bouncing use the same bearings', () => {
  const source = { id: 'a', x: 20, y: 60, dir: 0, size: 100 };
  const stage = new SpriteStage(canvas(), () => ({ sprites: [source] }));
  stage.move(25);
  assert.equal(stage.sprite().y, 85);
  stage.goto(0, 160);
  stage.bounce();
  assert.equal(stage.sprite().dir, 180);
  stage.move(20);
  assert.equal(stage.sprite().y, 140);
  stage.getAPI().pointTo('center');
  stage.move(10);
  assert.equal(stage.sprite().y, 130);
  assert.deepEqual(source, { id: 'a', x: 20, y: 60, dir: 0, size: 100 });
});

test('a glide advances over time and freezes at its current position on stop', async () => {
  const source = { id: 'a', x: 0, y: 0, dir: 90, size: 100 };
  const stage = new SpriteStage(canvas(), () => ({ sprites: [source] }));
  const complete = stage.glide(80, 40, 2);
  stage.tick(1);
  assert.deepEqual([stage.sprite().x, stage.sprite().y], [40, 20]);
  stage.cancelPending();
  await complete;
  stage.tick(3);
  assert.deepEqual([stage.sprite().x, stage.sprite().y], [40, 20]);
});

test('cancelling a turtle motion clears its queued moves and preserves only the travelled path', async () => {
  const stage = new TurtleStage(canvas(), canvas());
  const first = stage.forward(80, 300);
  const second = stage.forward(80, 300);
  stage.tick(.15);
  stage.cancelPending();
  await Promise.all([first, second]);
  stage.tick(3);
  assert.equal(stage.state.y, 40);
  assert.equal(stage.segments.length, 1);
  assert.equal(stage.segments[0].y2, 40);
});

test('changing survey regions redraws terrain while preserving the learner’s route', () => {
  const calls = [];
  const map = new Proxy({}, { get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])) });
  const stage = new TurtleStage({ getContext: () => map }, canvas());
  assert.ok(calls.some(call => call[0] === 'fillText' && call[1] === '氷河湖'));
  stage.forward(80);
  const before = JSON.stringify(stage.serialize());
  calls.length = 0;
  stage.setRegion('namib');
  assert.ok(calls.some(call => call[0] === 'bezierCurveTo'));
  calls.length = 0;
  stage.setRegion('namib');
  assert.equal(calls.length, 0);
  stage.setRegion('yakushima');
  assert.ok(calls.some(call => call[0] === 'closePath'));
  assert.ok(!calls.some(call => call[0] === 'bezierCurveTo' || call[0] === 'fillText'));
  assert.equal(JSON.stringify(stage.serialize()), before);
});

test('rejected promises from stopped threads cannot report errors in a new run', async () => {
  const errors = [];
  const scheduler = new Scheduler({ audio: { stop() {} }, stage: { render() {} },
    onState() {}, onHighlight() {}, onError: error => errors.push(error) });
  const thread = { iterator: (function* () {})() };
  scheduler.threads.push(thread);
  let rejectAction;
  const pending = new Promise((resolve, reject) => { rejectAction = reject; });
  scheduler.handleAction(thread, { kind: 'promise', promise: pending }, 0);
  scheduler.stop();
  rejectAction(new Error('old thread'));
  await Promise.resolve();
  assert.deepEqual(errors, []);
  assert.equal(scheduler.running, false);
});

test('generated sprite commands round-trip and unsupported edits give an error', () => {
  const project = { scripts: [{ blocks: [
    block('event_start'), block('motion_glide', { X: 55, Y: -33, SECS: .5 }),
    block('looks_say', { TEXT: 'やあ、森！' })
  ] }] };
  const converted = jsToBlocks(projectToJS(project), project);
  assert.equal(converted[1].type, 'motion_glide');
  assert.deepEqual(converted[1].fields, { SECS: .5, X: 55, Y: -33 });
  assert.deepEqual(converted[2].fields, { TEXT: 'やあ、森！' });
  assert.throws(() => jsToBlocks('forward();'));
  assert.throws(() => jsToBlocks('penDown(10);'));
  assert.throws(() => jsToBlocks('// [block] unsupported'));
});

test('a sensor program records dark and bright observations even when its output initially stays off', () => {
  const stage = Object.create(DeviceStage.prototype);
  Object.assign(stage, { sensors: { light: 70 }, outputs: { led: 0 }, lastSample: '', log: [], elapsed: 0 });
  stage.setOutput('led', false);
  stage.elapsed = 2;
  stage.sensors.light = 20;
  stage.setOutput('led', true);
  stage.setOutput('led', true);
  stage.elapsed = 4;
  stage.sensors.light = 70;
  stage.setOutput('led', false);
  assert.deepEqual(stage.log.map(item => [item.time, item.sensors.light, item.outputs.led]), [[0, 70, 0], [2, 20, 100], [4, 70, 0]]);
});

test('a long explicit wait does not prompt for a stuck program', () => {
  let noticed = false;
  const scheduler = new Scheduler({
    interpreter: {}, stage: { changedAt: 0, render() {}, tick() {} },
    onMonitors() {}, stepsPerFrame: () => 1, onStuck: () => { noticed = true; }
  });
  scheduler.threads = [{ waitUntil: 30000 }];
  scheduler.running = true;
  const original = globalThis.requestAnimationFrame;
  try {
    globalThis.requestAnimationFrame = () => 1;
    scheduler.frame(12000);
    assert.equal(noticed, false);
  } finally {
    if (original) globalThis.requestAnimationFrame = original;
    else delete globalThis.requestAnimationFrame;
  }
});
