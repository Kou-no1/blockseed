import { createProject, walkBlocks, clone } from '../core/project.js';
import { getDefinition, getLabel } from '../blocks/registry.js';
import { missions, legacyStarters } from './data/core.js';
import { fieldMissions } from '../field/worlds.js';

const blankGuides = {
  intro_square: ['しかくい道を描いて、出発した場所にもどろう。', '「はじまり」を置き、ペンをおろそう。「くりかえす」の中に、すすむ・まわるを入れてみよう。'],
  paine_long_route: ['1本が80歩のしかくい道を描こう。', 'ペンをおろし、同じ道を4回くり返そう。すすむ歩数は、ブロックの＋で変えられるよ。'],
  paine_rectangle: ['40歩と80歩の道をかわりばんこに引いて、長方形をとじよう。', '短い辺・曲がる・長い辺・曲がる、の4つをひと組にしよう。何回くり返せばとじるかな？'],
  sossusvlei_survey: ['長さが同じ3本の道で、正三角形をとじよう。', 'くり返しの中で、すすんでから曲がろう。1周で曲がる360度を、3つの角に分けよう。'],
  namib_dune_turn: ['長さが同じ5本の道で、正五角形をとじよう。', '辺の数は5本。何回くり返すかな？ 曲がる角度は360を5でわるとわかるよ。'],
  namib_hexagon: ['長さが同じ6本の道で、正六角形をとじよう。', 'すすむ・まわるをひと組にして、辺の数だけくり返そう。6回曲がると合計で360度だよ。'],
  yakushima_canopy: ['暗くなったらライトをつけ、明るくなったら消す装置を組もう。', '「ずっと」の中の「もし・でなければ」に明るさセンサーを入れよう。LEDのオンとオフを別々の枝に置いて試そう。'],
  yakushima_visitor: ['人がいるときだけライトをつけよう。いるときと、いないときを試そう。', '人感センサーで「もし・でなければ」の行き先を決めよう。「ずっと」でくり返せば、人が去ったあとも調べられるよ。'],
  yakushima_night: ['暗くて人がいるときだけライトをつけよう。明るさと人を切りかえ、4通りとも試そう。', '「もし」の条件に「かつ」を置こう。「かつ」の左右に、明るさと人感のセンサーを1個ずつ入れよう。']
};

const fieldExamples = {
  mulu: [['echo'], ['every', 'one'], ['beats', 'forward']],
  galapagos: [['photo'], ['turtle'], ['turtle', 'new']],
  uyuni: [['mirror'], ['3', 'mirror'], ['each', 'mirror']],
  palau: [['sail'], ['reefLow', 'wait', 'sail'], ['reefLow', 'wait', 'sail', 'unload']],
  aoraki: [['right'], ['2'], ['clear']],
  mcmurdo: [['drive', 'sample'], ['sample', 'home'], ['5', 'eco', 'fast', 'sample']]
};

const observationHints = {
  mulu: '手をたたいた拍と、こだまが返る拍を聞きくらべよう。',
  galapagos: 'カメが画面に来たとき、アルバムに何枚の写真がふえるかな？',
  uyuni: '岸から空の星までと、岸から水面の星までのきょりを見くらべよう。',
  palau: 'スクリューが回ると、小舟がどちらに進むか見てみよう。',
  aoraki: '望遠鏡が動く前と後で、ねらっている星の位置を見てみよう。',
  mcmurdo: '旗に着いたときの観測車と、持ち帰る土の数を見てみよう。'
};

function practiceDifficulty(mission) {
  if (['science_dark', 'tech_fan'].includes(mission.id) || mission.level === 1) return 1;
  if (mission.id.startsWith('math5_polygon_') || ['science_motion', 'free_maze', 'tech_door'].includes(mission.id)) return 2;
  return 3;
}

const examples = new Map();
const missionData = [];
const originals = new Map(missions.concat(fieldMissions).map(mission => [mission.id, mission]));
for (const source of originals.values()) {
  const difficulty = source.rank || practiceDifficulty(source);
  const guide = blankGuides[source.id];
  const example = { ...source, difficulty, buildFromBlank: false };
  if (guide && difficulty > 1) {
    example.goal = guide[0];
    example.hints = [guide[1]];
  }
  if (source.stage === 'field') {
    example.fieldProgram = fieldExamples[source.area][source.rank - 1];
    if (source.rank === 1) example.hints = [observationHints[source.area]];
  }
  examples.set(example.id, example);
  if (difficulty === 1) {
    missionData.push(example);
    if (!example.area) continue;
  }
  const duplicate = difficulty === 1;
  missionData.push({ ...example, id: duplicate ? example.id + '_blank' : example.id,
    baseId: example.id, difficulty: duplicate ? 2 : difficulty, buildFromBlank: true,
    goal: guide ? guide[0] : source.goal, hints: guide ? [guide[1]] : source.hints,
    starter: [], scripts: [], fieldProgram: [] });
}

export function listMissions() { return missionData.slice(); }
export function getMission(id) { return missionData.find(function (mission) { return mission.id === id; }) || missionData[0]; }
export function getExampleMission(id) { return examples.get(getMission(id).baseId || id) || null; }

export function isLegacyStarter(project) {
  const source = originals.get(project?.missionId);
  if (!source || project.buildFromBlank || !getMission(source.id).buildFromBlank || project.stage !== source.stage) return false;
  const historical = createProject(missionProjectData({ ...source, starter: legacyStarters.get(source.id) || source.starter }));
  // Project identity and timestamps change when saving. Script and block IDs change on load.
  // Preserve the IDs in variables, sprites and user-defined fields, which identify real data.
  const program = scripts => JSON.stringify(scripts, function (key, value) {
    if (key === 'id' && (Array.isArray(this.blocks) || this.type && this.inputs && this.fields)) return undefined;
    return value;
  });
  if (program(project.scripts) !== program(historical.scripts)) return false;
  // The app also filled in the current device's author and tool level automatically.
  return ['fieldScene', 'fieldProgram', 'name', 'vars', 'lists', 'funcs', 'sprites', 'device', 'background']
    .every(key => JSON.stringify(project[key]) === JSON.stringify(historical[key]));
}

function usedTypes(project) {
  const types = new Set();
  walkBlocks(project, function (block) { types.add(block.type); });
  return types;
}

function polygonChecks(segments, polygon) {
  const meaningful = (segments || []).filter(function (segment) { return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1) > .5; });
  const sides = polygon.sides;
  const tolerance = polygon.tolerance || 6;
  const counts = meaningful.length === sides;
  const lengths = meaningful.map(function (segment) { return Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1); });
  const average = lengths.reduce(function (sum, value) { return sum + value; }, 0) / Math.max(1, lengths.length);
  const positionTolerance = Math.min(tolerance, average * .08);
  // A rectangle may start on either a long or a short edge.
  const expected = polygon.lengths;
  const equal = expected
    ? counts && expected.some((_, offset) => lengths.every((value, i) => Math.abs(value - expected[(i + offset) % expected.length]) < .5))
    : counts && lengths.every(function (value) { return Math.abs(value - average) <= positionTolerance; });
  const contiguous = meaningful.every((edge, index) => {
    const next = meaningful[(index + 1) % meaningful.length];
    return Math.hypot(edge.x2 - next.x1, edge.y2 - next.y1) <= positionTolerance;
  });
  const turns = meaningful.map((edge, index) => {
    const next = meaningful[(index + 1) % meaningful.length];
    const dx = edge.x2 - edge.x1;
    const dy = edge.y2 - edge.y1;
    const nx = next.x2 - next.x1;
    const ny = next.y2 - next.y1;
    return Math.atan2(dx * ny - dy * nx, dx * nx + dy * ny) * 180 / Math.PI;
  });
  const expectedTurn = Math.sign(turns[0]) * 360 / sides;
  const regular = counts && turns.every(turn => Math.abs(turn - expectedTurn) <= 4 && expectedTurn !== 0);
  return [
    { label: sides + '本の へんが ある', passed: counts },
    { label: expected ? expected.join('歩・') + '歩で 描いた' : 'へんの ながさが そろっている', passed: equal },
    { label: '同じ向きに ' + Number((360 / sides).toFixed(1)) + '度ずつ曲がる', passed: regular },
    { label: 'すべての へんが つながっている', passed: polygon.closed ? counts && contiguous : true }
  ];
}

export function evaluateMission(mission, project, stage, completed = false) {
  if (!mission) return [];
  const check = mission.check || { kind: 'free' };
  if (check.kind === 'field') return stage.results?.() || [];
  const types = usedTypes(project);
  const results = [];
  if (check.kind === 'turtlePath') {
    if (check.polygon) results.push.apply(results, polygonChecks(stage.segments, check.polygon));
    else results.push({ label: 'かめが せんを かいた', passed: (stage.segments || []).length >= (check.minSegments || 1) });
  }
  if (check.kind === 'deviceLog') {
    const log = stage && Array.isArray(stage.log) ? stage.log : [];
    function matchesRule(entry) {
      const motion = Number(entry.sensors.motion) >= 50;
      const dark = Number(entry.sensors.light) < 35;
      const expected = check.rule === 'motion' ? motion : check.rule === 'dark' ? dark : motion && dark;
      return Boolean(entry.outputs.led) === expected;
    }
    // If an input changes between "if" and "turn on", the next scan
    // corrects that transient output. Grade the latest result for each case.
    const observed = new Map();
    for (const entry of log) {
      const light = entry.sensors.light < 35;
      const motion = entry.sensors.motion >= 50;
      observed.set(Number(light) * 2 + Number(motion), entry);
    }
    const correct = observed.size > 0 && [...observed.values()].every(matchesRule);
    if (check.requireBothStates) {
      const darkIndex = log.findIndex(entry => entry.sensors.light < 35 && entry.outputs.led > 0);
      const brightAfterDark = darkIndex >= 0 && log.some((entry, index) =>
        index > darkIndex && entry.sensors.light >= 35 && !entry.outputs.led);
      results.push({ label: '暗い場所で LED をつけた', passed: darkIndex >= 0 });
      results.push({ label: '明るくもどして LED を消した', passed: brightAfterDark });
    }
    if (check.scenarios) {
      if (check.rule === 'motion') {
        let usesMotion = false;
        walkBlocks(project, block => {
          if (['device_sensor', 'device_sensor_on'].includes(block.type) && block.fields.SENSOR === 'motion') usesMotion = true;
        });
        results.push({ label: '人のセンサーを使った', passed: usesMotion });
      }
      const lights = check.rule === 'motion' ? [null] : [false, true];
      for (const dark of lights) for (const person of [false, true]) {
        const lit = person && dark !== false;
        const seen = log.some(entry =>
          (dark === null || (entry.sensors.light < 35) === dark) &&
          (entry.sensors.motion >= 50) === person && Boolean(entry.outputs.led) === lit);
        const lightLabel = dark === null ? '' : dark ? '暗い・' : '明るい・';
        results.push({ label: lightLabel + (person ? '人がいる' : '人がいない') + '：' + (lit ? 'つく' : '消える'), passed: seen });
      }
    }
    results.push({ label: 'センサーの じょうけんどおりに LEDが うごいた', passed: correct });
  }
  if (check.kind === 'finalState') results.push({ label: 'さいごまで 実行した', passed: completed });
  (check.required || []).forEach(function (type) {
    const definition = getDefinition(type);
    const label = definition.unknown ? type : getLabel(definition, 1).replace(/%\d+/g, '□');
    results.push({ label: '「' + label + '」を つかった', passed: types.has(type) });
  });
  if (check.requireRecord || check.minRecords) {
    const count = check.minRecords || 1;
    results.push({ label: 'つかった じかんを ' + count + '回 きろくした', passed: Boolean(stage.records && stage.records.length >= count) });
  }
  if (check.kind === 'free') results.push({ label: 'じゆうに ためしてみよう', passed: true });
  return results;
}

export function missionProjectData(mission) {
  return {
    name: mission.title, missionId: mission.id, level: mission.level, stage: mission.stage,
    fieldScene: mission.stage === 'field' ? mission.baseId || mission.id : undefined, fieldProgram: mission.fieldProgram,
    buildFromBlank: Boolean(mission.buildFromBlank),
    scripts: mission.scripts ? clone(mission.scripts) : [{ id: 'mission-script-' + mission.id, x: 40, y: 40, blocks: clone(mission.starter || []) }],
    sprites: mission.sprites ? clone(mission.sprites) : undefined,
    background: mission.background || 'sky'
  };
}
