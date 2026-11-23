import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../js/core/project.js';
import { getMission, evaluateMission, missionProjectData } from '../js/missions/missions.js';
import { Interpreter } from '../js/runtime/interpreter.js';
import { TurtleStage } from '../js/stages/turtle.js';
import { DeviceStage } from '../js/stages/device.js';

function fixture(id) {
  const mission = getMission(id);
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
  ['intro_square', 'patagonia', 1, null],
  ['paine_long_route', 'patagonia', 2, loop => { loop.body[0].fields.STEPS = 80; }],
  ['paine_rectangle', 'patagonia', 3, loop => { loop.body[2].fields.STEPS = 80; }],
  ['sossusvlei_survey', 'namib', 1, loop => { loop.fields.TIMES = 3; }],
  ['namib_dune_turn', 'namib', 2, loop => { loop.body[1].fields.DEG = 72; }],
  ['namib_hexagon', 'namib', 3, loop => { loop.fields.TIMES = 6; loop.body[1].fields.DEG = 60; }]
];

for (const [id, area, rank, solve] of geometry) {
  test(id + ': drawn route is required and reachable from the starter', () => {
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
    assert.equal(draw(), !solve);
    const loop = blocks.find(block => block.type === 'control_repeat');
    if (solve) { solve(loop); assert.equal(draw(), true); }
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
  ['yakushima_canopy', 1, null],
  ['yakushima_visitor', 2, condition => { condition.fields.SENSOR = 'motion'; }],
  ['yakushima_night', 3, condition => { condition.inputs.B.fields.SENSOR = 'light'; }]
];

for (const [id, rank, solve] of switches) {
  test(id + ': verifies observed sensor responses from the learner program', () => {
    const { mission, project, blocks } = fixture(id);
    assert.deepEqual([mission.area, mission.rank], ['yakushima', rank]);
    const condition = blocks[1].body[0].inputs.COND;
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
    assert.equal(experiment([...trials]), !solve);
    if (solve) solve(condition);
    assert.equal(experiment(trials.slice(0, 1)), false, 'one observation cannot demonstrate a rule');
    assert.equal(experiment(trials), true);
    if (rank === 3) {
      for (const trial of trials.slice(0, 4)) {
        const partial = trials.filter(item => item.light !== trial.light || item.motion !== trial.motion);
        assert.equal(experiment(partial), false, 'every combination must actually have been observed');
      }
    }
  });
}
