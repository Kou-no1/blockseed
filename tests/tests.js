import { createProject, normalizeProject, validateProject, walkBlocks } from '../js/core/project.js';
import { History } from '../js/core/history.js';
import { encodeProject, decodeProject } from '../js/core/share.js';
import { allDefinitions, getDefinition, getLabel } from '../js/blocks/registry.js';
import { Interpreter } from '../js/runtime/interpreter.js';
import { Scheduler } from '../js/runtime/scheduler.js';
import { TurtleStage } from '../js/stages/turtle.js';
import { jsToBlocks, projectToJS } from '../js/runtime/tojs.js';
import { getMission, listMissions, evaluateMission } from '../js/missions/missions.js';

const tests = [];
function test(name, run) { tests.push({ name: name, run: run }); }
function assert(value, message) { if (!value) throw new Error(message || 'assertion failed'); }
function equal(actual, expected, message) { if (actual !== expected) throw new Error((message || 'not equal') + ': ' + JSON.stringify(actual) + ' !== ' + JSON.stringify(expected)); }

function mockStage() {
  const state = { x: 0, y: 0, dir: 0, segments: [] };
  const api = {
    forward: function (distance) { const rad = state.dir * Math.PI / 180; const nx = state.x + Math.sin(rad) * distance; const ny = state.y + Math.cos(rad) * distance; state.segments.push({ x1: state.x, y1: state.y, x2: nx, y2: ny }); state.x = nx; state.y = ny; },
    back: function (distance) { api.forward(-distance); }, right: function (degrees) { state.dir += degrees; }, left: function (degrees) { state.dir -= degrees; },
    penDown: function () {}, penUp: function () {}, penColor: function () {}, penWidth: function () {}, clear: function () { state.segments = []; },
    x: function () { return state.x; }, y: function () { return state.y; }, direction: function () { return state.dir; }
  };
  return { state: state, getAPI: function () { return api; }, render: function () {}, tick: function () {} };
}

function exhaust(iterator, limit) {
  let count = 0; let result;
  do { result = iterator.next(); count += 1; if (count > (limit || 10000)) throw new Error('generator did not finish'); } while (!result.done);
}

test('既定作品が正しいschema v1で、IDが重複しない', function () {
  const project = createProject({ author: '6-2 のむら' });
  const validation = validateProject(project);
  assert(validation.ok, validation.issues.join(','));
  const ids = []; walkBlocks(project, function (block) { ids.push(block.id); }); equal(new Set(ids).size, ids.length);
});

test('未知のブロックを読み込み時に消さない', function () {
  const project = createProject(); project.scripts[0].blocks.push({ id: 'mystery', type: 'future_block', fields: { X: 1 }, inputs: {} });
  const normalized = normalizeProject(project);
  equal(normalized.scripts[0].blocks.at(-1).type, 'future_block');
});

test('レジストリのtypeが一意で、全定義にラベルがある', function () {
  const definitions = allDefinitions(); const types = definitions.map(function (item) { return item.type; });
  equal(new Set(types).size, types.length); assert(definitions.length >= 70, 'block count ' + definitions.length);
  definitions.forEach(function (definition) { assert(getLabel(definition, 1), definition.type); assert(['hat', 'stack', 'cap', 'c', 'c2', 'value', 'bool'].includes(definition.shape), definition.type); });
});

test('高レベルのラベルは低レベル表示でもフォールバックする', function () {
  equal(getLabel(getDefinition('device_out_power'), 1).length > 0, true);
});

test('Undoを50回続けても初期状態まで正しく戻れる', function () {
  const history = new History(100); const project = createProject(); history.reset(project);
  for (let index = 1; index <= 60; index += 1) { project.name = '作品' + index; history.record(project); }
  for (let index = 0; index < 50; index += 1) assert(history.undo());
  equal(history.undo().name, '作品9');
  assert(history.redo());
});

test('あいことばB方式で日本語と入れ子が往復する', async function () {
  const project = createProject({ author: '5-1 たね', name: '正六角形' });
  const code = await encodeProject(project, true); assert(code.startsWith('B')); assert(/^[A-Za-z0-9_~\-]+$/.test(code));
  const restored = await decodeProject(code); equal(restored.name, project.name); equal(restored.author, project.author); equal(restored.scripts[0].blocks[2].body.length, 2);
});

test('repeatの正方形プログラムが4辺を描く', function () {
  const project = createProject(); const stage = mockStage(); const audio = { tone: function () {}, effect: function () {} };
  const interpreter = new Interpreter({ project: project, stage: stage, audio: audio });
  exhaust(interpreter.runBlocks(project.scripts[0].blocks.slice(1), 0));
  equal(stage.state.segments.length, 4); assert(Math.hypot(stage.state.x, stage.state.y) < .001);
});

test('ゆっくり設定では、かめの線が300msかけて伸びる', async function () {
  const pen = document.createElement('canvas'); const actor = document.createElement('canvas');
  pen.width = actor.width = 480; pen.height = actor.height = 360;
  const stage = new TurtleStage(pen, actor);
  const done = stage.forward(100, 300);
  stage.tick(.15);
  assert(stage.state.y > 0 && stage.state.y < 100, '途中位置を描画する');
  stage.tick(.15);
  await done;
  assert(Math.abs(stage.state.y - 100) < .001, '終点まで進む');
});

test('10秒変化がない実行をスケジューラが検知する', function () {
  let noticed = 0;
  const stage = mockStage(); stage.changedAt = 0;
  const iterator = (function* () { while (true) yield { kind: 'tick' }; }());
  const scheduler = new Scheduler({
    project: { scripts: [] }, interpreter: {}, stage: stage, audio: { stop: function () {} }, stepsPerFrame: function () { return 1; },
    onHighlight: function () {}, onState: function () {}, onMonitors: function () {}, onDone: function () {}, onError: function () {}, onStuck: function () { noticed += 1; }
  });
  scheduler.threads = [{ hatId: 'hat', iterator: iterator, waitUntil: 0, pending: false, nextValue: undefined }];
  scheduler.running = true; scheduler.lastFrame = 10000; scheduler.frame(11001); scheduler.stop();
  equal(noticed, 1);
});

test('0除算は例外にせず0を返し、警告する', function () {
  const warnings = []; const project = createProject(); const stage = mockStage();
  const interpreter = new Interpreter({ project: project, stage: stage, audio: {}, warn: function (code) { warnings.push(code); } });
  const value = interpreter.evalValue({ id: 'd', type: 'op_div', fields: { A: 5, B: 0 }, inputs: { A: null, B: null } }, 0);
  equal(value, 0); equal(warnings[0], 'E_DIV0');
});

test('ブロックからJSを生成し、限定JSをブロックへ戻せる', function () {
  const project = createProject(); const code = projectToJS(project); assert(code.includes('for (let i = 0; i < 4; i++)')); assert(code.includes('forward(80)'));
  const blocks = jsToBlocks('penDown();\nfor (let i = 0; i < 3; i++) {\n  forward(50);\n  turnRight(120);\n}');
  equal(blocks[0].type, 'event_start'); equal(blocks[2].type, 'control_repeat'); equal(blocks[2].body.length, 2);
});

test('引数つき自作ブロックをJavaScriptへ変換できる', function () {
  const project = createProject({ level: 4, funcs: [{ id: 'f1', name: '線', params: ['長さ'], body: [] }], scripts: [
    { id: 'def', x: 0, y: 0, blocks: [{ id: 'hat', type: 'func_define', fields: { NAME: '線', PARAMS: '長さ' }, inputs: { NAME: null, PARAMS: null } }, { id: 'move', type: 'turtle_forward', fields: { STEPS: 0 }, inputs: { STEPS: { id: 'arg', type: 'func_arg', fields: { VALUE: 0 }, inputs: { VALUE: null } } } }] },
    { id: 'call', x: 0, y: 0, blocks: [{ id: 'start', type: 'event_start', fields: {}, inputs: {} }, { id: 'invoke', type: 'func_call', fields: { NAME: '線', ARGS: '25' }, inputs: { ARGS: null } }] }
  ] });
  const code = projectToJS(project); assert(code.includes('function 線(長さ)')); assert(code.includes('arguments[0]')); assert(code.includes('線(25)'));
});

test('初期ミッションに算数・理科・技術・双方向・自由制作がそろう', function () {
  const ids = new Set(listMissions().map(function (item) { return item.id; }));
  ['math5_polygon_3', 'math5_polygon_12', 'science_motion', 'science_energy', 'tech_door', 'tech_signal', 'tech_fan', 'bidi_chat', 'bidi_bot', 'free_draw', 'free_maze', 'free_shoot', 'free_music'].forEach(function (id) { assert(ids.has(id), id); });
});

test('正多角形ミッションを3辺から12辺まで判定できる', function () {
  for (let sides = 3; sides <= 12; sides += 1) {
    const mission = getMission('math5_polygon_' + sides); const project = createProject(); project.scripts[0].blocks[2].fields.TIMES = sides;
    const segments = []; let x = 0; let y = 0; let dir = 0;
    for (let index = 0; index < sides; index += 1) { const rad = dir * Math.PI / 180; const nx = x + Math.sin(rad) * 50; const ny = y + Math.cos(rad) * 50; segments.push({ x1: x, y1: y, x2: nx, y2: ny }); x = nx; y = ny; dir += 360 / sides; }
    const results = evaluateMission(mission, project, { segments: segments }); assert(results.every(function (item) { return item.passed; }), sides + ' sides');
  }
});

test('探検課題は形とセンサーの両状態を確かめる', function () {
  const square = getMission('intro_square');
  const line = [0, 50, 0, 50, 0];
  const flat = line.slice(1).map((x, index) => ({ x1: line[index], y1: 0, x2: x, y2: 0 }));
  assert(evaluateMission(square, createProject(), { segments: flat }).some(item => !item.passed));

  const mission = getMission('sossusvlei_survey');
  const project = createProject({ scripts: [{ id: 'route', blocks: structuredClone(mission.starter) }] });
  const repeat = project.scripts[0].blocks.find(item => item.type === 'control_repeat');
  equal(repeat.fields.TIMES, 2);
  function draw() {
    const stage = mockStage();
    exhaust(new Interpreter({ project, stage, audio: {} }).runBlocks(project.scripts[0].blocks.slice(1), 0));
    return evaluateMission(mission, project, stage.state).every(item => item.passed);
  }
  equal(draw(), false);
  repeat.fields.TIMES = 3;
  equal(draw(), true);

  const canopy = getMission('yakushima_canopy');
  const sensorProject = createProject({ stage: 'device', scripts: [{ id: 'sensor', blocks: canopy.starter }] });
  const log = [{ sensors: { light: 20 }, outputs: { led: 100 } }];
  assert(evaluateMission(canopy, sensorProject, { log }).some(item => !item.passed));
  log.push({ sensors: { light: 70 }, outputs: { led: 0 } });
  assert(evaluateMission(canopy, sensorProject, { log }).every(item => item.passed));
});

test('Lv4作品をLv1にしても上級ブロックが保持される', function () {
  const project = createProject({ level: 4 }); project.scripts[0].blocks.push({ id: 'advanced', type: 'func_call', fields: { NAME: 'しかく' }, inputs: { NAME: null } });
  project.level = 1; const normalized = normalizeProject(project); assert(normalized.scripts[0].blocks.some(function (block) { return block.id === 'advanced'; }));
});

async function run() {
  const root = document.getElementById('results'); let passed = 0;
  for (const item of tests) {
    const li = document.createElement('li'); const title = document.createElement('strong'); title.textContent = item.name; li.appendChild(title);
    try { await Promise.race([Promise.resolve(item.run()), new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, 4000); })]); li.className = 'pass'; passed += 1; }
    catch (error) { li.className = 'fail'; const pre = document.createElement('pre'); pre.textContent = error.stack || error.message; li.appendChild(pre); console.error(item.name, error); }
    root.appendChild(li);
  }
  const summary = document.getElementById('summary'); summary.textContent = passed + ' / ' + tests.length + ' テスト成功'; summary.style.borderLeft = '8px solid ' + (passed === tests.length ? '#318443' : '#c53242');
  document.documentElement.dataset.tests = passed === tests.length ? 'pass' : 'fail';
}

run();
