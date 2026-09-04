import { walkBlocks, clone } from '../core/project.js';
import { missions as missionData } from './data/core.js';

export function listMissions() { return missionData.slice(); }
export function getMission(id) { return missionData.find(function (mission) { return mission.id === id; }) || missionData[1]; }

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
  const equal = counts && lengths.every(function (value) { return Math.abs(value - average) <= tolerance; });
  const first = meaningful[0]; const last = meaningful[meaningful.length - 1];
  const closed = Boolean(first && last && Math.hypot(last.x2 - first.x1, last.y2 - first.y1) <= tolerance);
  return [
    { label: sides + '本の へんが ある', passed: counts },
    { label: 'へんの ながさが そろっている', passed: equal },
    { label: 'さいごが つながっている', passed: polygon.closed ? closed : true }
  ];
}

export function evaluateMission(mission, project, stage) {
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
    const passed = log.length > 0 && log.every(function (entry) {
      const motion = Number(entry.sensors.motion) >= 50;
      const dark = Number(entry.sensors.light) < 35;
      const expected = check.rule === 'motion' ? motion : check.rule === 'dark' ? dark : motion && dark;
      return Boolean(entry.outputs.led) === expected;
    });
    results.push({ label: 'センサーの じょうけんどおりに LEDが うごいた', passed: passed });
  }
  if (check.kind === 'finalState') results.push({ label: 'もくひょうの じょうたいに なった', passed: true });
  (check.required || []).forEach(function (type) { results.push({ label: type + ' を つかった', passed: types.has(type) }); });
  if (check.requireRecord || check.minRecords) {
    const count = check.minRecords || 1;
    results.push({ label: 'つかった じかんを ' + count + '回 きろくした', passed: Boolean(stage.records && stage.records.length >= count) });
  }
  if (check.kind === 'free') results.push({ label: 'じゆうに ためしてみよう', passed: true });
  return results;
}

export function missionProjectData(mission) {
  return {
    name: mission.title, level: mission.level, stage: mission.stage,
    scripts: mission.scripts ? clone(mission.scripts) : [{ id: 'mission-script-' + mission.id, x: 40, y: 40, blocks: clone(mission.starter || []) }],
    sprites: mission.sprites ? clone(mission.sprites) : undefined,
    background: mission.background || 'sky'
  };
}
