const MAX_DEPTH = 1000;
let sequence = 0;

export function makeId(prefix) {
  sequence += 1;
  const random = Math.floor(Math.random() * 0xffffff).toString(36);
  return (prefix || 'id') + Date.now().toString(36) + sequence.toString(36) + random;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createBlock(type, definition) {
  const fields = {};
  const inputs = {};
  const args = definition && Array.isArray(definition.args) ? definition.args : [];
  args.forEach(function (arg) {
    fields[arg.name] = clone(arg.default);
    if (arg.slot !== false) inputs[arg.name] = null;
  });
  const block = { id: makeId('b'), type: type, fields: fields, inputs: inputs };
  if (definition && (definition.shape === 'c' || definition.shape === 'c2')) block.body = [];
  if (definition && definition.shape === 'c2') block.body2 = [];
  return block;
}

export function squareBlocks() {
  return [
    { id: makeId('b'), type: 'event_start', fields: {}, inputs: {} },
    { id: makeId('b'), type: 'pen_down', fields: {}, inputs: {} },
    {
      id: makeId('b'), type: 'control_repeat', fields: { TIMES: 4 }, inputs: { TIMES: null }, body: [
        { id: makeId('b'), type: 'turtle_forward', fields: { STEPS: 80 }, inputs: { STEPS: null } },
        { id: makeId('b'), type: 'turtle_right', fields: { DEG: 90 }, inputs: { DEG: null } }
      ]
    }
  ];
}

export function createProject(options) {
  const now = Date.now();
  const settings = options || {};
  return {
    v: 1,
    id: settings.id || makeId('p'),
    name: settings.name || 'パタゴニアの観測ルート',
    missionId: typeof settings.missionId === 'string' ? settings.missionId.slice(0, 80) : null,
    ...(settings.buildFromBlank === true ? { buildFromBlank: true } : {}),
    author: settings.author || '',
    level: clampLevel(settings.level || 1),
    stage: ['turtle', 'sprite', 'device', 'field'].includes(settings.stage) ? settings.stage : 'turtle',
    ...fieldSettings(settings),
    vars: Array.isArray(settings.vars) ? clone(settings.vars) : [{ id: 'v1', name: 'かず', value: 0, show: true }],
    lists: Array.isArray(settings.lists) ? clone(settings.lists) : [],
    funcs: Array.isArray(settings.funcs) ? clone(settings.funcs) : [],
    scripts: Array.isArray(settings.scripts) ? clone(settings.scripts) : [{ id: makeId('s'), x: 40, y: 40, blocks: squareBlocks() }],
    sprites: Array.isArray(settings.sprites) ? clone(settings.sprites) : [{ id: 'sp1', name: 'ねこ', shape: 'cat', x: 0, y: 0, dir: 90, size: 100, visible: true, color: '#f5a623' }],
    background: typeof settings.background === 'string' ? settings.background : 'sky',
    device: settings.device ? clone(settings.device) : { sensors: ['motion', 'light', 'temp', 'sound', 'switch'], outputs: ['led', 'motor', 'buzzer', 'heater'] },
    createdAt: settings.createdAt || now,
    updatedAt: now
  };
}

export function clampLevel(value) {
  return Math.min(5, Math.max(1, Number(value) || 1));
}

function fieldSettings(source) {
  if (source.stage !== 'field') return {};
  return { fieldScene: String(source.fieldScene || source.missionId || '').slice(0, 80),
    fieldProgram: Array.isArray(source.fieldProgram) ? source.fieldProgram.slice(0, 20).map(value => String(value).slice(0, 80)) : [] };
}

function normalizeBlock(source, ids, depth) {
  if (!source || typeof source !== 'object' || depth > MAX_DEPTH) return null;
  const id = typeof source.id === 'string' && !ids.has(source.id) ? source.id : makeId('b');
  ids.add(id);
  const block = {
    id: id,
    type: typeof source.type === 'string' ? source.type : 'unknown',
    fields: source.fields && typeof source.fields === 'object' ? clone(source.fields) : {},
    inputs: {}
  };
  const rawInputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : {};
  Object.keys(rawInputs).forEach(function (key) {
    block.inputs[key] = rawInputs[key] ? normalizeBlock(rawInputs[key], ids, depth + 1) : null;
  });
  if (Array.isArray(source.body)) block.body = source.body.map(function (child) { return normalizeBlock(child, ids, depth + 1); }).filter(Boolean);
  if (Array.isArray(source.body2)) block.body2 = source.body2.map(function (child) { return normalizeBlock(child, ids, depth + 1); }).filter(Boolean);
  return block;
}

export function normalizeProject(source) {
  if (!source || typeof source !== 'object') throw new Error('E_LOAD');
  if (Number(source.v) !== 1) throw new Error('E_LOAD');
  const base = createProject({ scripts: [] });
  const ids = new Set();
  base.id = typeof source.id === 'string' ? source.id : makeId('p');
  base.name = typeof source.name === 'string' ? source.name.slice(0, 80) : base.name;
  base.missionId = typeof source.missionId === 'string' ? source.missionId.slice(0, 80) : null;
  if (source.buildFromBlank === true) base.buildFromBlank = true;
  base.author = typeof source.author === 'string' ? source.author.slice(0, 80) : '';
  base.level = clampLevel(source.level);
  base.stage = ['turtle', 'sprite', 'device', 'field'].includes(source.stage) ? source.stage : 'turtle';
  Object.assign(base, fieldSettings(source));
  base.vars = Array.isArray(source.vars) ? clone(source.vars).slice(0, 50) : [];
  base.lists = Array.isArray(source.lists) ? clone(source.lists).slice(0, 20) : [];
  base.funcs = Array.isArray(source.funcs) ? clone(source.funcs).slice(0, 30) : [];
  base.scripts = Array.isArray(source.scripts) ? source.scripts.slice(0, 80).map(function (script) {
    return {
      id: typeof script.id === 'string' ? script.id : makeId('s'),
      x: Number(script.x) || 40,
      y: Number(script.y) || 40,
      blocks: Array.isArray(script.blocks) ? script.blocks.map(function (block) { return normalizeBlock(block, ids, 0); }).filter(Boolean) : []
    };
  }) : [];
  base.sprites = Array.isArray(source.sprites) ? clone(source.sprites).slice(0, 8) : base.sprites;
  base.background = typeof source.background === 'string' ? source.background : 'sky';
  base.device = source.device && typeof source.device === 'object' ? clone(source.device) : base.device;
  base.createdAt = Number(source.createdAt) || Date.now();
  base.updatedAt = Number(source.updatedAt) || Date.now();
  return base;
}

export function walkBlocks(project, visit) {
  function walkList(list, depth) {
    if (depth > MAX_DEPTH) return;
    list.forEach(function (block) {
      visit(block, depth);
      Object.keys(block.inputs || {}).forEach(function (key) {
        if (block.inputs[key]) walkList([block.inputs[key]], depth + 1);
      });
      if (Array.isArray(block.body)) walkList(block.body, depth + 1);
      if (Array.isArray(block.body2)) walkList(block.body2, depth + 1);
    });
  }
  (project.scripts || []).forEach(function (script) { walkList(script.blocks || [], 0); });
  (project.funcs || []).forEach(function (fn) { walkList(fn.body || [], 0); });
}

export function findBlockLocation(project, id) {
  let result = null;
  function searchList(list, script, parent, key, depth) {
    if (result || depth > MAX_DEPTH) return;
    for (let index = 0; index < list.length; index += 1) {
      const block = list[index];
      if (block.id === id) {
        result = { block: block, list: list, index: index, script: script, parent: parent, key: key, kind: 'list' };
        return;
      }
      Object.keys(block.inputs || {}).some(function (inputKey) {
        const input = block.inputs[inputKey];
        if (!input) return false;
        if (input.id === id) {
          result = { block: input, list: null, index: -1, script: script, parent: block, key: inputKey, kind: 'input' };
          return true;
        }
        searchList([input], script, block, inputKey, depth + 1);
        return Boolean(result);
      });
      if (result) return;
      if (Array.isArray(block.body)) searchList(block.body, script, block, 'body', depth + 1);
      if (result) return;
      if (Array.isArray(block.body2)) searchList(block.body2, script, block, 'body2', depth + 1);
      if (result) return;
    }
  }
  (project.scripts || []).some(function (script) {
    searchList(script.blocks || [], script, null, 'blocks', 0);
    return Boolean(result);
  });
  return result;
}

export function containsBlock(block, id) {
  if (!block) return false;
  if (block.id === id) return true;
  const inputs = block.inputs || {};
  if (Object.keys(inputs).some(function (key) { return inputs[key] && containsBlock(inputs[key], id); })) return true;
  return (block.body || []).some(function (child) { return containsBlock(child, id); }) || (block.body2 || []).some(function (child) { return containsBlock(child, id); });
}

export function validateProject(project) {
  const issues = [];
  const ids = new Set();
  if (!project || project.v !== 1) issues.push('スキーマの バージョンが ちがいます');
  walkBlocks(project || { scripts: [] }, function (block) {
    if (!block.id || ids.has(block.id)) issues.push('ブロックの なまえが かさなっています');
    ids.add(block.id);
    if (!block.type) issues.push('しゅるいが ない ブロックが あります');
  });
  return { ok: issues.length === 0, issues: issues };
}
