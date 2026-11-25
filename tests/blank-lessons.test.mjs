import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, normalizeProject, walkBlocks } from '../js/core/project.js';
import { listDefinitions } from '../js/blocks/registry.js';
import { worlds, fieldMissions } from '../js/field/worlds.js';
import { getExampleMission, getMission, isLegacyStarter, listMissions, evaluateMission, missionProjectData } from '../js/missions/missions.js';
import { Interpreter } from '../js/runtime/interpreter.js';
import { DeviceStage } from '../js/stages/device.js';
import { TurtleStage } from '../js/stages/turtle.js';
import { ScriptCanvas } from '../js/ui/canvas.js';

const catalog = listMissions();
const expeditions = catalog.filter(mission => mission.area);

test('nine places offer one observation, a blank repeat, and two further blank problems each', () => {
  const areas = [...new Set(expeditions.map(mission => mission.area))];
  assert.equal(areas.length, 9);
  assert.equal(expeditions.length, 36);
  assert.equal(new Set(catalog.map(mission => mission.id)).size, catalog.length);
  for (const area of areas) {
    const lessons = expeditions.filter(mission => mission.area === area).sort((a, b) => a.rank - b.rank || a.difficulty - b.difficulty);
    assert.deepEqual(lessons.map(mission => [mission.rank, mission.difficulty]), [[1,1],[1,2],[2,2],[3,3]]);
    const [guided, repeat] = lessons;
    assert.equal(repeat.id, guided.id + '_blank');
    assert.equal(repeat.level, guided.level);
    assert.deepEqual(repeat.check, guided.check);
    assert.equal(getExampleMission(repeat.id), guided);
  }
});

test('all built-in difficulty 2 and 3 projects start completely empty and preserve their lesson and equipment', () => {
  for (const lesson of catalog) {
    const project = normalizeProject(createProject(missionProjectData(lesson)));
    assert.equal(project.missionId, lesson.id);
    assert.equal(project.level, lesson.level);
    if (lesson.difficulty === 1) {
      const runnable = project.stage === 'field' ? project.fieldProgram.length : project.scripts[0]?.blocks.length;
      assert.ok(runnable, lesson.id);
      continue;
    }
    assert.ok([2,3].includes(lesson.difficulty), lesson.id);
    assert.equal(project.buildFromBlank, true, lesson.id);
    assert.deepEqual(project.scripts, [], lesson.id);
    if (lesson.stage === 'field') {
      assert.equal(project.fieldScene, lesson.baseId);
      assert.deepEqual(project.fieldProgram, []);
    }
    assert.equal(getExampleMission(lesson.id).buildFromBlank, false);
  }
  for (const id of ['science_dark','tech_fan']) {
    assert.equal(getMission(id).difficulty, 1);
    assert.ok(getMission(id).level > 1);
  }
  const custom = { id: 'teacher', title: '先生の問題', difficulty: 2, level: 3, stage: 'device', starter: [{type:'event_start'}] };
  assert.equal(createProject(missionProjectData(custom)).scripts[0].blocks[0].type, 'event_start');
});

test('all field reference programs solve their actual worlds, including the changed second run', () => {
  for (const source of fieldMissions) {
    const example = getExampleMission(source.id);
    const world = worlds.get(source.area);
    const lines = world.lessons[source.rank - 1].lines;
    assert.equal(example.fieldProgram.length, lines.length);
    for (const [slot, value] of example.fieldProgram.entries()) assert.ok(lines[slot].options.some(option => option[0] === value), source.id);
    for (const variant of [0, 1]) {
      const state = world.create(source.rank, variant);
      for (let step = 0; !world.finished(state, source.rank) && step < 100; step++) {
        world.step(state, example.fieldProgram, source.rank, variant);
      }
      assert.equal(world.finished(state, source.rank), true, source.id);
      assert.ok(world.checks(state, source.rank).every(Boolean), source.id + ' variant ' + variant);
    }
  }
});

test('the two guided apparatus demonstrations respond to changes before any editing', () => {
  for (const [id, sensor, output, trials] of [
    ['science_dark', 'light', 'led', [[70, false], [20, true], [70, false]]],
    ['tech_fan', 'temp', 'motor', [[22, false], [32, true], [28, false]]]
  ]) {
    const project = createProject(missionProjectData(getMission(id)));
    const stage = Object.assign(Object.create(DeviceStage.prototype), {
      sensors: {light: 70, temp: 22}, outputs: {led: 0, motor: 0}, lastSample: '', log: [], elapsed: 0
    });
    const run = new Interpreter({project, stage}).runBlocks(project.scripts[0].blocks.slice(1), 0);
    for (const [value, active] of trials) {
      stage.sensors[sensor] = value;
      for (let step = 0; step < 24; step++) run.next();
      assert.equal(Boolean(stage.outputs[output]), active, id + ' at ' + value);
    }
    run.return();
  }
});

test('migration recognizes unedited legacy programs despite new block IDs and preserves learner changes', () => {
  const oldRoute = createProject(missionProjectData(getExampleMission('paine_long_route')));
  const loop = oldRoute.scripts[0].blocks[2];
  loop.body[0].fields.STEPS = 50;
  oldRoute.scripts[0].id = 'prior-session-script';
  oldRoute.author = '児童';
  oldRoute.level = 4;
  walkBlocks(oldRoute, (block, depth) => { block.id = depth + '-' + block.type; });
  assert.equal(isLegacyStarter(normalizeProject(oldRoute)), true);
  for (const change of [
    p => { p.scripts[0].blocks[2].body[0].fields.STEPS = 60; }, p => { p.scripts[0].x = 55; },
    p => { p.vars[0].value = 1; }, p => { p.sprites[0].name = 'たんけん隊'; },
    p => { p.name = '作った道'; }, p => { p.buildFromBlank = true; }, p => { p.stage = 'sprite'; }
  ]) {
    const edited = structuredClone(oldRoute);
    change(edited);
    assert.equal(isLegacyStarter(edited), false);
  }
  const oldField = createProject(missionProjectData(fieldMissions.find(mission => mission.id === 'palau_2')));
  assert.equal(isLegacyStarter(oldField), true);
  for (const change of [
    p => { p.fieldProgram.reverse(); }, p => { p.fieldProgram[1] = 'wait'; },
    p => { p.fieldProgram[1] = 'invalid'; }, p => { p.fieldScene = 'palau_1'; }
  ]) {
    const edited = structuredClone(oldField);
    change(edited);
    assert.equal(isLegacyStarter(edited), false);
  }
  assert.equal(isLegacyStarter(createProject(missionProjectData(getExampleMission('intro_square')))), false);
  assert.equal(isLegacyStarter(createProject(missionProjectData(getExampleMission('bidi_chat')))), true);
});

// These tests use the same insertion, slot and field actions as tapping the palette.
function workspace(mission) {
  const project = createProject(missionProjectData(mission));
  const allowed = listDefinitions(project.level, project.stage, null, mission.allowedBlocks).map(def => def.type);
  const canvas = Object.assign(Object.create(ScriptCanvas.prototype), {
    options: {getProject: () => project, isRunning: () => false, toast() {}, onChange() {}},
    changed() {}, blockElement: () => null, insertMode: 'inside'
  });
  assert.deepEqual(project.scripts, []);
  assert.equal(canvas.addType('control_repeat'), false);
  assert.deepEqual(project.scripts, []);
  function add(type, parent, placement, slot) {
    assert.ok(allowed.includes(type), mission.id + ' offers ' + type);
    assert.equal(canvas.addType(type, parent, placement, slot), true);
    return canvas.selectedId;
  }
  const set = (id, name, value) => canvas.setField(id, name, value);
  add('event_start');
  return {project, add, set};
}

for (const mission of expeditions.filter(lesson => lesson.buildFromBlank && lesson.stage !== 'field')) {
  test(mission.id + ': assemble from an empty editor and run the real interpreter', () => {
    const {project, add, set} = workspace(mission);
    let stage;
    if (mission.stage === 'turtle') {
      const {sides, lengths = [50]} = mission.check.polygon;
      add('pen_down');
      const loop = add('control_repeat');
      set(loop, 'TIMES', sides / lengths.length);
      for (const length of lengths) {
        set(add('turtle_forward', loop, 'inside'), 'STEPS', length);
        set(add('turtle_right', loop, 'inside'), 'DEG', 360 / sides);
      }
      const ctx = new Proxy({}, {get: (target, key) => target[key] ?? (() => {})});
      const surface = {getContext: () => ctx};
      stage = new TurtleStage(surface, surface);
      Array.from(new Interpreter({project, stage}).runBlocks(project.scripts[0].blocks.slice(1), 0));
    } else {
      const forever = add('control_forever');
      const choose = add('control_if_else', forever, 'inside');
      if (mission.check.rule === 'both') {
        const both = add('op_and', choose, null, 'COND');
        set(add('device_sensor_on', both, null, 'A'), 'SENSOR', 'light');
        set(add('device_sensor_on', both, null, 'B'), 'SENSOR', 'motion');
      } else {
        set(add('device_sensor_on', choose, null, 'COND'), 'SENSOR', mission.check.rule === 'dark' ? 'light' : 'motion');
      }
      add('device_out_set', choose, 'inside');
      set(add('device_out_set', choose, 'else'), 'STATE', 0);
      stage = Object.assign(Object.create(DeviceStage.prototype), {sensors:{light:70,motion:0}, outputs:{led:0}, lastSample:'', log:[], elapsed:0});
      const program = new Interpreter({project, stage}).runBlocks(project.scripts[0].blocks.slice(1), 0);
      for (const [light, motion] of [[70,0],[70,100],[20,100],[20,0],[70,0]]) {
        Object.assign(stage.sensors, {light, motion});
        for (let step = 0; step < 28; step++) program.next();
      }
      program.return();
    }
    const checks = evaluateMission(mission, project, stage, true);
    assert.ok(checks.length && checks.every(check => check.passed), JSON.stringify(checks));
  });
}
