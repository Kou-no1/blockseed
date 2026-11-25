import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldStage } from '../js/field/stage.js';

// Observe the real stage's saved-program and grading contracts without a browser clock.
function editor(project) {
  const stage = Object.assign(Object.create(FieldStage.prototype), {
    canvas: { setAttribute() {} }, note: {}, renderTools() {}, renderBuilder() {}, renderGuidedLines() {}, stop() {},
    reset() { this.attempted = this.completed = false; this.state = this.world.create(this.rank, 0); }
  });
  const mission = {id:'palau_2', area:'palau', rank:2, unit:'ロックアイランド'};
  stage.configure(project, mission);
  return stage;
}

test('self-built field programs reject empty, incomplete, unset and misplaced commands before any world step', () => {
  for (const fieldProgram of [[], ['0:reefLow'], ['0:reefLow','1:','2:sail'], ['1:wait','0:reefLow','2:sail'], ['0:reefLow','1:bad','2:sail']]) {
    const stage = editor({id:'saved', buildFromBlank:true, fieldProgram});
    let executed;
    stage.run(20, () => {}, result => { executed = result; });
    assert.equal(executed, false);
    assert.equal(stage.attempted, false);
    assert.equal(stage.completed, false);
    assert.ok(stage.note.textContent);
    assert.equal(stage.results().every(row => row.passed), false);
  }
});

test('self-built field programs keep order and option choices when reopened, and the simulation grades the resulting boat trip', () => {
  for (const [rule, succeeds] of [['wait',true],['sail',false]]) {
    const stored = {id:'saved', buildFromBlank:true, fieldProgram:['0:reefLow','1:' + rule,'2:sail']};
    const stage = editor(JSON.parse(JSON.stringify(stored)));
    assert.deepEqual(stage.program, ['reefLow',rule,'sail']);
    stage.attempted = true;
    for (let i = 0; i < 30 && !stage.world.finished(stage.state,2); i++) stage.world.step(stage.state,stage.program,2,0);
    assert.equal(stage.results().every(row => row.passed), succeeds);
  }
});

test('the same lesson can still open as a guided project with ordinary positional values', () => {
  const stage = editor({id:'guided', fieldProgram:['reefHigh','sail','wait']});
  assert.equal(stage.blank, false);
  assert.deepEqual(stage.program, ['reefHigh','sail','wait']);
});
