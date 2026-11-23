import test from 'node:test';
import assert from 'node:assert/strict';
import { living } from '../js/field/living.js';

const [mulu, galapagos] = living;

function run(world, rank, program, variant = 0, input) {
  const state = world.create(rank, variant, input);
  let steps = 0;
  assert.equal(world.checks(state,rank).every(Boolean),false);
  while (!world.finished(state,rank)) {
    assert.ok(++steps <= 30, 'field program must terminate within the clock limit');
    world.step(state,program,rank,variant,input);
  }
  assert.equal(world.checks(state,rank).length,world.lessons[rank-1].criteria.length);
  return state;
}

const lessons = [
  [mulu,1,['echo']], [mulu,2,['every','one']], [mulu,3,['beats','forward']],
  [galapagos,1,['photo']], [galapagos,2,['turtle']], [galapagos,3,['turtle','new']]
];

for (const [world,rank,program] of lessons) {
  test(world.id + ' mission ' + rank + ' is reached by observed behavior in either scene', () => {
    const lesson = world.lessons[rank-1];
    for (const [i, item] of lesson.lines.entries()) assert.ok(item.options.some(([value]) => value === program[i]));
    for (const variant of [0,1]) {
      const started=run(world,rank,lesson.lines.map(item=>item.initial),variant);
      assert.equal(world.checks(started,rank).every(Boolean),false);
      const solved=run(world,rank,program,variant);
      assert.ok(world.checks(solved,rank).every(Boolean));
    }
  });
}

test('a partner can enter eight beats, with rests recorded before, between and after notes', () => {
  let rhythm='';
  for(const beat of '01010010') rhythm=mulu.configure(beat==='1'?'hit':'rest',rhythm,3);
  assert.equal(rhythm,'01010010');
  assert.equal(mulu.configure('hit',rhythm,3),rhythm);
  const regular=run(mulu,3,['beats','forward'],0,rhythm);
  const other=run(mulu,3,['beats','forward'],1,rhythm);
  assert.deepEqual(regular.replies.slice(rhythm.length),Array.from(rhythm,Number));
  assert.notDeepEqual(other.pattern,regular.pattern);
  assert.ok(mulu.checks(other,3).every(Boolean));
  assert.equal(mulu.checks(run(mulu,3,['notes','forward'],0,rhythm),3).every(Boolean),false);
  assert.equal(mulu.checks(run(mulu,3,['beats','reverse'],0,rhythm),3).every(Boolean),false);
  assert.equal(mulu.checks(run(mulu,3,['beats','forward'],0,'000'),3).every(Boolean),false);
  assert.equal(mulu.configure('clear',rhythm,3),'');
});

test('the camera saves what was actually in view, including false triggers and repeat visitors', () => {
  assert.deepEqual(run(galapagos,2,['anything']).shots,['rock','hana','sora','rock']);
  assert.deepEqual(run(galapagos,3,['turtle','every']).shots,['hana','hana','sora','sora','hana']);
  assert.deepEqual(run(galapagos,3,['turtle','first']).shots,['hana']);
  assert.deepEqual(run(galapagos,3,['turtle','new'],1).shots,['sora','hana']);
});
