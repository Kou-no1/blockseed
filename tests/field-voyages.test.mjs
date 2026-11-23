import test from 'node:test';
import assert from 'node:assert/strict';
import { voyages } from '../js/field/voyages.js';

const [boat, rover] = voyages;
function run(world, rank, program, variant = 0, input) {
  const state = world.create(rank, variant, input);
  assert.ok(world.checks(state, rank).some(value => !value), 'starting is not a solution');
  for (let i = 0; i < 30 && !world.finished(state, rank); i++) {
    world.step(state, program, rank, variant, input);
  }
  assert.ok(world.finished(state, rank), 'the field reaches a visible outcome');
  assert.ok(world.status(state, rank));
  const checks = world.checks(state, rank);
  assert.equal(checks.length, world.lessons[rank - 1].criteria.length);
  return { state, passed: checks.every(Boolean) };
}

test('Palau: the motor must move the boat to the island', () => {
  assert.equal(run(boat, 1, ['wait']).passed, false);
  assert.equal(run(boat, 1, ['sail']).passed, true);
});
test('Palau: running the motor at an exposed reef grounds the boat', () => {
  const unsafe = run(boat, 2, ['reefLow','sail','sail']);
  assert.equal(unsafe.state.grounded, true);
  assert.equal(unsafe.passed, false);
  const safe = run(boat, 2, ['reefLow','wait','sail']);
  assert.equal(safe.state.crossed, 1);
  assert.equal(safe.passed, true);
});
test('Palau: both departures must cross both reefs and unload the cargo', () => {
  for (const variant of [0,1]) for (const input of ['now','later']) {
    const voyage = run(boat, 3, ['reefLow','wait','sail','unload'], variant, input);
    assert.deepEqual([voyage.state.crossed, voyage.state.delivered, voyage.passed], [2,true,true]);
    assert.equal(run(boat, 3, ['reefLow','wait','sail','keep'], variant, input).passed, false);
    assert.equal(run(boat, 3, ['reefHigh','wait','sail','unload'], variant, input).passed, false);
  }
});
test('McMurdo: the rover must drive to a flag and collect a real sample', () => {
  assert.equal(run(rover, 1, ['park','sample']).passed, false);
  assert.equal(run(rover, 1, ['drive','skip']).passed, false);
  assert.equal(run(rover, 1, ['drive','sample']).passed, true);
});
test('McMurdo: observations come from three distinct places and return to base', () => {
  assert.equal(run(rover, 2, ['skip','home']).passed, false);
  assert.equal(run(rover, 2, ['sample','stay']).passed, false);
  const trip = run(rover, 2, ['sample','home']);
  assert.deepEqual(trip.state.samples, [1,2,3]);
  assert.equal(trip.passed, true);
});
test('McMurdo: an overly late energy switch fails the smaller battery expedition', () => {
  const late = ['2','eco','fast','sample'];
  assert.equal(run(rover, 3, late, 0).passed, true);
  const stranded = run(rover, 3, late, 1);
  assert.equal(stranded.state.stranded, true);
  assert.equal(stranded.passed, false);
  for (const variant of [0,1]) {
    assert.equal(run(rover, 3, ['5','eco','fast','sample'], variant).passed, true);
    assert.equal(run(rover, 3, ['5','fast','fast','sample'], variant).passed, false);
  }
});
