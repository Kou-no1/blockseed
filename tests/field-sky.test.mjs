import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sky } from '../js/field/sky.js';

const [uyuni, aoraki] = sky;

function run(world, rank, program, variant = 0, input) {
  const s = world.create(rank, variant, input);
  assert.equal(world.checks(s, rank).every(Boolean), false);
  let count = 0;
  while (!world.finished(s, rank)) {
    world.step(s, program, rank, variant, input);
    assert.ok(++count < 30);
  }
  assert.equal(world.checks(s, rank).length, world.lessons[rank-1].criteria.length);
  return s;
}

for (const [world, solutions] of [
  [uyuni, [['mirror'], ['3','mirror'], ['each','mirror']]],
  [aoraki, [['right'], ['2'], ['clear']]]
]) {
  solutions.forEach((program,i) => {
    const rank = i+1, lesson = world.lessons[i];
    test(world.id+' '+rank+' clears from editable instructions, not the starter', () => {
      for (const variant of [0,1]) {
        const starter = lesson.lines.map(field => field.initial);
        assert.equal(world.checks(run(world,rank,starter,variant),rank).every(Boolean), false);
        assert.ok(world.checks(run(world,rank,program,variant),rank).every(Boolean));
        assert.ok(program.every((token,n) => lesson.lines[n].options.some(([v]) => token === v)));
      }
    });
  });
}

test('a moved Uyuni star is reflected in the same column at equal depth on both skies', () => {
  const original = uyuni.create(3,0);
  const input = uyuni.tap(original,98,50,3);
  assert.deepEqual(uyuni.tap(original,98,201,3,input), input);
  for (const variant of [0,1]) {
    const before = uyuni.create(3,variant,input);
    assert.deepEqual(before.stars[0], variant ? [382,58] : [98,50]);
    const result = run(uyuni,3,['each','mirror'],variant,input);
    assert.notDeepEqual(result.stars[0], before.stars[0]);
    for (let i=0;i<3;i++) {
      assert.equal(result.copies[i][0],result.stars[i][0]);
      assert.equal(result.copies[i][1] + result.stars[i][1],268);
    }
    assert.deepEqual(uyuni.checks(run(uyuni,3,['once','mirror'],variant,input),3),[true,false]);
    assert.deepEqual(uyuni.checks(run(uyuni,3,['each','half'],variant,input),3),[false,false]);
  }
});

test('Aoraki album contains time-stamped distinct photos and adapts to different nights', () => {
  const photos = run(aoraki,2,['2']).shots;
  assert.deepEqual(photos.map(shot => shot.beat),[1,3,5]);
  assert.equal(new Set(photos.map(shot => shot.point.join(','))).size,3);
  const patterns = [0,1].map(v => run(aoraki,3,['clear'],v).shots.map(shot => shot.beat));
  assert.notDeepEqual(patterns[0],patterns[1]);
  const earlyNight = run(aoraki,3,['clear'],0,'early').shots.map(shot => shot.beat);
  assert.deepEqual(earlyNight,[3,4,5]);
  assert.notDeepEqual(earlyNight,patterns[1], 'a custom first night differs from the automatic second night');
  const clouds = run(aoraki,3,['cloud']);
  assert.equal(clouds.shots.length,3);
  assert.ok(clouds.shots.every(shot => shot.cloudy));
  assert.deepEqual(aoraki.checks(clouds,3),[true,false]);
});
