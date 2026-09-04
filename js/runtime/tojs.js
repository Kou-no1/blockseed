import { getDefinition } from '../blocks/registry.js';
import { makeId } from '../core/project.js';

function cleanName(value, fallback) {
  let name = String(value || fallback || 'value').replace(/[^\p{L}\p{N}_$]/gu, '_');
  if (/^\d/.test(name)) name = '_' + name;
  if (['for', 'while', 'if', 'else', 'const', 'let', 'var', 'function', 'return'].includes(name)) name = '_' + name;
  return name || fallback;
}

function literal(value) { return typeof value === 'string' ? JSON.stringify(value) : String(value == null ? 0 : value); }

function expression(block, project) {
  if (!block) return '0';
  const read = function (name) { return block.inputs && block.inputs[name] ? expression(block.inputs[name], project) : literal(block.fields[name]); };
  const binary = { op_add: '+', op_sub: '-', op_mul: '*', op_div: '/', op_mod: '%', op_gt: '>', op_lt: '<', op_eq: '===', op_and: '&&', op_or: '||' };
  if (binary[block.type]) return '(' + read('A') + ' ' + binary[block.type] + ' ' + read('B') + ')';
  if (block.type === 'op_not') return '!' + read('A');
  if (block.type === 'op_random') return 'random(' + read('A') + ', ' + read('B') + ')';
  if (block.type === 'data_var') { const item = (project.vars || []).find(function (entry) { return entry.id === block.fields.VAR; }); return cleanName(item ? item.name : 'へんすう', 'へんすう'); }
  if (block.type === 'device_sensor') return 'sensor(' + literal(block.fields.SENSOR) + ')';
  if (block.type === 'device_sensor_on') return 'sensorOn(' + literal(block.fields.SENSOR) + ')';
  if (block.type === 'device_use_time') return 'useTime()';
  if (block.type === 'func_arg') return 'arguments[' + Math.max(0, Math.floor(Number(block.fields.VALUE) || 0)) + ']';
  if (block.type === 'turtle_x' || block.type === 'motion_x') return 'x()';
  if (block.type === 'turtle_y' || block.type === 'motion_y') return 'y()';
  return literal(block.fields && block.fields[Object.keys(block.fields)[0]]);
}

function lineFor(block, project, depth) {
  const pad = '  '.repeat(depth);
  const v = function (name) { return block.inputs && block.inputs[name] ? expression(block.inputs[name], project) : literal(block.fields[name]); };
  const calls = {
    pen_down: 'penDown()', pen_up: 'penUp()', pen_clear: 'clearPen()', turtle_home: 'home()',
    turtle_forward: 'forward(' + v('STEPS') + ')', turtle_back: 'back(' + v('STEPS') + ')', turtle_right: 'turnRight(' + v('DEG') + ')', turtle_left: 'turnLeft(' + v('DEG') + ')',
    turtle_goto: 'goTo(' + v('X') + ', ' + v('Y') + ')', turtle_setdir: 'setDirection(' + v('DEG') + ')',
    pen_color: 'setPenColor(' + v('COLOR') + ')', pen_width: 'setPenWidth(' + v('WIDTH') + ')', control_wait: 'wait(' + v('SECS') + ')',
    sound_note: 'playNote(' + v('NOTE') + ', ' + v('SECS') + ')', sound_effect: 'playEffect(' + v('EFFECT') + ')', sound_tempo_set: 'setTempo(' + v('TEMPO') + ')',
    device_out_set: 'setOutput(' + v('OUTPUT') + ', ' + v('STATE') + ')', device_out_power: 'setPower(' + v('OUTPUT') + ', ' + v('POWER') + ')'
  };
  if (calls[block.type]) return pad + calls[block.type] + ';';
  if (block.type === 'control_repeat') return pad + 'for (let i = 0; i < ' + v('TIMES') + '; i++) {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_forever') return pad + 'while (true) {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_if') return pad + 'if (' + v('COND') + ') {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_if_else') return pad + 'if (' + v('COND') + ') {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '} else {\n' + blocksToJS(block.body2 || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'data_set' || block.type === 'data_change') {
    const item = (project.vars || []).find(function (entry) { return entry.id === block.fields.VAR; }); const name = cleanName(item ? item.name : 'へんすう', 'へんすう');
    return pad + name + (block.type === 'data_set' ? ' = ' : ' += ') + v('VALUE') + ';';
  }
  if (block.type === 'func_call') {
    const args = String(block.fields.ARGS || '').split(',').map(function (item) { const text = item.trim(); return /^-?\d+(\.\d+)?$/.test(text) ? text : JSON.stringify(text); }).filter(Boolean).join(', ');
    return pad + cleanName(block.fields.NAME, 'じぶんのブロック') + '(' + args + ');';
  }
  if (block.type === 'control_stop_all') return pad + 'stopAll();';
  if (getDefinition(block.type).shape === 'value' || getDefinition(block.type).shape === 'bool') return pad + expression(block, project) + ';';
  return pad + '// ' + block.type;
}

export function blocksToJS(blocks, project, depth) {
  return (blocks || []).filter(function (block) { return !block.type.startsWith('event_'); }).map(function (block) { return lineFor(block, project, depth || 0); }).join('\n');
}

export function projectToJS(project) {
  const declarations = (project.vars || []).map(function (item) { return 'let ' + cleanName(item.name, 'へんすう') + ' = ' + literal(item.value) + ';'; });
  const functions = (project.scripts || []).filter(function (script) { return script.blocks && script.blocks[0] && script.blocks[0].type === 'func_define'; }).map(function (script) {
    const name = cleanName(script.blocks[0].fields.NAME, 'じぶんのブロック');
    const params = String(script.blocks[0].fields.PARAMS || '').split(',').map(function (item, index) { return cleanName(item.trim(), 'ひきすう' + index); }).filter(Boolean).join(', ');
    return 'function ' + name + '(' + params + ') {\n' + blocksToJS(script.blocks.slice(1), project, 1) + '\n}';
  });
  const scripts = (project.scripts || []).filter(function (script) { return !script.blocks || !script.blocks[0] || script.blocks[0].type !== 'func_define'; }).map(function (script) { return blocksToJS(script.blocks || [], project, 0); }).filter(Boolean);
  return declarations.concat(functions, scripts).join('\n\n');
}

function callBlock(type, field, value) {
  const fields = {}; const inputs = {};
  if (field) { fields[field] = value; inputs[field] = null; }
  return { id: makeId('b'), type: type, fields: fields, inputs: inputs };
}

export function jsToBlocks(code) {
  const root = [];
  const stack = [{ body: root, block: null }];
  const lines = String(code || '').split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex]; const line = raw.trim();
    if (!line || line.startsWith('//') || /^let\s+[^=]+=[^;]+;$/.test(line)) continue;
    if (line === '}') { if (stack.length === 1) throw new Error('このコードは まだ ブロックに できません（' + (lineIndex + 1) + '行）'); stack.pop(); continue; }
    let match = /^for\s*\([^<]*<\s*(-?\d+(?:\.\d+)?)\s*;[^)]*\)\s*\{$/.exec(line);
    if (match) { const block = callBlock('control_repeat', 'TIMES', Number(match[1])); block.body = []; stack[stack.length - 1].body.push(block); stack.push({ body: block.body, block: block }); continue; }
    if (/^while\s*\(true\)\s*\{$/.test(line)) { const block = callBlock('control_forever'); block.body = []; stack[stack.length - 1].body.push(block); stack.push({ body: block.body, block: block }); continue; }
    const calls = [
      ['penDown', 'pen_down'], ['penUp', 'pen_up'], ['clearPen', 'pen_clear'], ['home', 'turtle_home'], ['forward', 'turtle_forward', 'STEPS'], ['back', 'turtle_back', 'STEPS'],
      ['turnRight', 'turtle_right', 'DEG'], ['turnLeft', 'turtle_left', 'DEG'], ['wait', 'control_wait', 'SECS']
    ];
    let found = false;
    for (const item of calls) {
      const pattern = new RegExp('^' + item[0] + '\\s*\\(\\s*(-?\\d+(?:\\.\\d+)?)?\\s*\\)\\s*;?$');
      match = pattern.exec(line);
      if (match) { stack[stack.length - 1].body.push(callBlock(item[1], item[2], item[2] ? Number(match[1]) : undefined)); found = true; break; }
    }
    if (!found) throw new Error('このコードは まだ ブロックに できません（' + (lineIndex + 1) + '行）');
  }
  if (stack.length !== 1) throw new Error('このコードは まだ ブロックに できません（かっこを たしかめてね）');
  return [{ id: makeId('b'), type: 'event_start', fields: {}, inputs: {} }].concat(root);
}
