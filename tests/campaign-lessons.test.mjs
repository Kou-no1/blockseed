import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/core/project.js';
import { getExampleMission, evaluateMission, missionProjectData } from '../js/missions/missions.js';
import { Interpreter } from '../js/runtime/interpreter.js';
import { TurtleStage } from '../js/stages/turtle.js';
import { DeviceStage } from '../js/stages/device.js';

function fixture(id) {
  const mission = getExampleMission(id);
  assert.equal(mission.id, id);
  const project = createProject(missionProjectData(mission));
  assert.equal(project.missionId, id);
  return { mission, project, blocks: project.scripts[0].blocks };
}

function passes(mission, project, stage) {
  const checks = evaluateMission(mission, project, stage, true);
  return checks.length > 0 && checks.every(check => check.passed);
}

const geometry = [
  ['intro_square', 'patagonia', 1], ['paine_long_route', 'patagonia', 2], ['paine_rectangle', 'patagonia', 3],
  ['sossusvlei_survey', 'namib', 1], ['namib_dune_turn', 'namib', 2], ['namib_hexagon', 'namib', 3]
];

for (const [id, area, rank] of geometry) {
  test(id + ': example traces the complete route, and an open path fails', () => {
    const { mission, project, blocks } = fixture(id);
    assert.deepEqual([mission.area, mission.rank], [area, rank]);
    assert.ok(mission.hints[0]);
    const ctx = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
    const canvas = { getContext: () => ctx };
    const stage = new TurtleStage(canvas, canvas);
    const draw = () => {
      stage.reset();
      Array.from(new Interpreter({ project, stage }).runBlocks(blocks.slice(1), 0));
      return passes(mission, project, stage);
    };
    assert.equal(passes(mission, project, stage), false);
    assert.equal(draw(), true);
    const loop = blocks.find(block => block.type === 'control_repeat');
    loop.fields.TIMES = 1;
    assert.equal(draw(), false, 'an open path must fail');
  });
}

const trials = [
  { light: 70, motion: 0 }, { light: 70, motion: 100 },
  { light: 20, motion: 100 }, { light: 20, motion: 0 },
  { light: 70, motion: 0 }
];
const switches = [
  ['yakushima_canopy', 1], ['yakushima_visitor', 2], ['yakushima_night', 3]
];

for (const [id, rank] of switches) {
  test(id + ': verifies observed sensor responses from the learner program', () => {
    const { mission, project, blocks } = fixture(id);
    assert.deepEqual([mission.area, mission.rank], ['yakushima', rank]);
    function experiment(sequence) {
      const stage = Object.assign(Object.create(DeviceStage.prototype), {
        sensors: { light: 70, motion: 0 }, outputs: { led: 0 }, lastSample: '', log: [], elapsed: 0
      });
      const run = new Interpreter({ project, stage }).runBlocks(blocks.slice(1), 0);
      for (const observation of sequence) {
        Object.assign(stage.sensors, observation);
        // Hold each scenario through a full scan, even with per-block yields.
        for (let step = 0; step < 28; step++) {
          const event = run.next();
          assert.equal(event.done, false);
        }
      }
      run.return();
      return passes(mission, project, stage);
    }
    assert.equal(experiment(trials.slice(0, 1)), false, 'one observation cannot demonstrate a rule');
    assert.equal(experiment(trials), true);
    if (rank === 3) {
      for (const trial of trials.slice(0, 4)) {
        const partial = trials.filter(item => item.light !== trial.light || item.motion !== trial.motion);
        assert.equal(experiment(partial), false, 'every combination must actually have been observed');
      }
      blocks[1].body[0].inputs.COND.inputs.B.fields.SENSOR = 'motion';
      assert.equal(experiment(trials), false, 'an incorrect condition must fail even after all inputs were tried');
    }
  });
}
