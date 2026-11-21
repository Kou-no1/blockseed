import { walkBlocks, clone } from '../core/project.js';
import { getDefinition, getLabel } from '../blocks/registry.js';
import { missions as missionData } from './data/core.js';

export function listMissions() { return missionData.slice(); }
export function getMission(id) { return missionData.find(function (mission) { return mission.id === id; }) || missionData[0]; }

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
  const equal = counts && lengths.every(function (value) { return Math.abs(value - average) <= positionTolerance; });
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
    { label: 'へんの ながさが そろっている', passed: equal },
    { label: '同じ向きに ' + Number((360 / sides).toFixed(1)) + '度ずつ曲がる', passed: regular },
    { label: 'すべての へんが つながっている', passed: polygon.closed ? counts && contiguous : true }
  ];
}

export function evaluateMission(mission, project, stage, completed = false) {
  if (!mission) return [];
  const check = mission.check || { kind: 'free' };
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
    const correct = log.length > 0 && log.every(matchesRule);
    if (check.requireBothStates) {
      const darkIndex = log.findIndex(entry => entry.sensors.light < 35 && entry.outputs.led > 0);
      const brightAfterDark = darkIndex >= 0 && log.some((entry, index) =>
        index > darkIndex && entry.sensors.light >= 35 && !entry.outputs.led);
      results.push({ label: '暗い場所で LED をつけた', passed: darkIndex >= 0 });
      results.push({ label: '明るくもどして LED を消した', passed: brightAfterDark });
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
    scripts: mission.scripts ? clone(mission.scripts) : [{ id: 'mission-script-' + mission.id, x: 40, y: 40, blocks: clone(mission.starter || []) }],
    sprites: mission.sprites ? clone(mission.sprites) : undefined,
    background: mission.background || 'sky'
  };
}
