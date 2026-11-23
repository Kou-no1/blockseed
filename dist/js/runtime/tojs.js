import { getDefinition } from '../blocks/registry.js';
import { makeId } from '../core/project.js';

function cleanName(value, fallback) {
  let name = String(value || fallback || 'value').replace(/[^\p{L}\p{N}_$]/gu, '_');
  if (/^\d/.test(name)) name = '_' + name;
  if (['for', 'while', 'if', 'else', 'const', 'let', 'var', 'function', 'return'].includes(name)) name = '_' + name;
  return name || fallback;
}

function literal(value) { return typeof value === 'string' ? JSON.stringify(value) : String(value == null ? 0 : value); }

const commands = {
  pen_down: ['penDown'], pen_up: ['penUp'], pen_clear: ['clearPen'],
  pen_color: ['setPenColor', 'COLOR'], pen_width: ['setPenWidth', 'WIDTH'],
  turtle_home: ['home'], turtle_forward: ['forward', 'STEPS'], turtle_back: ['back', 'STEPS'],
  turtle_left: ['turnLeft', 'DEG'], turtle_right: ['turnRight', 'DEG'],
  turtle_goto: ['goTo', 'X', 'Y'], turtle_setdir: ['setDirection', 'DEG'],
  motion_move: ['move', 'STEPS'], motion_point_to: ['pointTo', 'TARGET'], motion_bounce: ['bounce'],
  motion_turn_l: ['turnSpriteLeft', 'DEG'], motion_turn_r: ['turnSpriteRight', 'DEG'],
  motion_goto_xy: ['goToXY', 'X', 'Y'], motion_glide: ['glide', 'SECS', 'X', 'Y'],
  looks_say: ['say', 'TEXT'], looks_say_secs: ['sayFor', 'TEXT', 'SECS'],
  looks_color: ['setColor', 'COLOR'], looks_size: ['setSize', 'SIZE'], looks_next_costume: ['nextCostume'],
  looks_show: ['show'], looks_hide: ['hide'],
  control_wait: ['wait', 'SECS'], control_stop_all: ['stopAll'],
  control_broadcast: ['broadcast', 'MESSAGE'], control_broadcast_wait: ['broadcastAndWait', 'MESSAGE'],
  sensing_ask: ['ask', 'QUESTION'], sensing_reset_timer: ['resetTimer'],
  sound_note: ['playNote', 'NOTE', 'SECS'], sound_effect: ['playEffect', 'EFFECT'], sound_tempo_set: ['setTempo', 'TEMPO'],
  device_out_set: ['setOutput', 'OUTPUT', 'STATE'], device_out_power: ['setPower', 'OUTPUT', 'POWER'],
  device_led_color: ['setLEDColor', 'COLOR'], device_reset_use_time: ['resetUseTime']
};

const commandByName = new Map(Object.entries(commands).map(([type, [name, ...fields]]) => [name, { type, fields }]));

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
  if (block.type === 'turtle_dir') return 'direction()';
  if (block.type === 'op_round') return 'Math.round(' + read('A') + ')';
  if (block.type === 'op_abs') return 'Math.abs(' + read('A') + ')';
  if (block.type === 'op_join') return '(String(' + read('A') + ') + String(' + read('B') + '))';
  if (block.type === 'op_letter') return '(Array.from(String(' + read('B') + '))[Math.floor(' + read('A') + ') - 1] ?? "")';
  if (block.type === 'op_length') return 'Array.from(String(' + read('A') + ')).length';
  if (block.type === 'sensing_key') return 'keyPressed(' + read('KEY') + ')';
  if (block.type === 'sensing_edge') return 'onEdge()';
  if (block.type === 'sensing_touching') return 'touching(' + read('TARGET') + ')';
  if (block.type === 'sensing_mouse_x') return 'mouseX()';
  if (block.type === 'sensing_mouse_y') return 'mouseY()';
  if (block.type === 'sensing_timer') return 'timer()';
  if (block.type === 'sensing_answer') return 'answer()';
  if (block.type === 'data_list_len') return 'listLength(' + read('LIST') + ')';
  if (block.type === 'data_list_item') return 'listItem(' + read('LIST') + ', ' + read('INDEX') + ')';
  return 'undefined /* ' + String(block.type).replace(/[^\w]/g, '_') + ' */';
}

function lineFor(block, project, depth) {
  const pad = '  '.repeat(depth);
  const v = function (name) { return block.inputs && block.inputs[name] ? expression(block.inputs[name], project) : literal(block.fields[name]); };
  if (Object.hasOwn(commands, block.type)) {
    const [name, ...fields] = commands[block.type];
    return pad + name + '(' + fields.map(v).join(', ') + ');';
  }
  if (block.type === 'control_repeat') return pad + 'for (let i = 0; i < ' + v('TIMES') + '; i++) {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_forever') return pad + 'while (true) {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_repeat_until') return pad + 'while (!(' + v('COND') + ')) {\n' + blocksToJS(block.body || [], project, depth + 1) + '\n' + pad + '}';
  if (block.type === 'control_wait_until') return pad + 'waitUntil(() => ' + v('COND') + ');';
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
  return pad + '// [block] ' + block.type;
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
  const scripts = (project.scripts || []).filter(script => script.blocks?.length && script.blocks[0].type !== 'func_define').map(script => {
    const hat = script.blocks[0];
    if (hat.type === 'event_start') return blocksToJS(script.blocks.slice(1), project, 0);
    const events = { event_key: 'onKey', event_click: 'onClick', event_message: 'onMessage' };
    if (!Object.hasOwn(events, hat.type)) return blocksToJS(script.blocks, project, 0);
    const arg = hat.type === 'event_key' ? literal(hat.fields.KEY) + ', ' : hat.type === 'event_message' ? literal(hat.fields.MESSAGE) + ', ' : '';
    return events[hat.type] + '(' + arg + '() => {\n' + blocksToJS(script.blocks.slice(1), project, 1) + '\n});';
  }).filter(Boolean);
  return declarations.concat(functions, scripts).join('\n\n');
}

function callBlock(type, field, value) {
  const fields = {}; const inputs = {};
  if (field) { fields[field] = value; inputs[field] = null; }
  return { id: makeId('b'), type: type, fields: fields, inputs: inputs };
}

export function jsToBlocks(code, project) {
  const root = [];
  const stack = [{ body: root, block: null }];
  const lines = String(code || '').split(/\r?\n/);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const raw = lines[lineIndex]; const line = raw.trim();
    if (!line || (line.startsWith('//') && !line.startsWith('// [block]'))) continue;
    if (project && (project.vars || []).some(item => line === 'let ' + cleanName(item.name, 'へんすう') + ' = ' + literal(item.value) + ';')) continue;
    if (line === '}') { if (stack.length === 1) throw new Error('このコードは まだ ブロックに できません（' + (lineIndex + 1) + '行）'); stack.pop(); continue; }
    let match = /^for\s*\(\s*let\s+([a-zA-Z_$][\w$]*)\s*=\s*0\s*;\s*\1\s*<\s*(\d+)\s*;\s*\1\+\+\s*\)\s*\{$/.exec(line);
    if (match) { const block = callBlock('control_repeat', 'TIMES', Number(match[2])); block.body = []; stack[stack.length - 1].body.push(block); stack.push({ body: block.body, block: block }); continue; }
    if (/^while\s*\(true\)\s*\{$/.test(line)) { const block = callBlock('control_forever'); block.body = []; stack[stack.length - 1].body.push(block); stack.push({ body: block.body, block: block }); continue; }
    match = /^(\w+)\s*\((.*)\)\s*;?$/.exec(line);
    const command = match && commandByName.get(match[1]);
    if (command) {
      let values;
      try { values = JSON.parse('[' + match[2] + ']'); } catch { /* Unsupported expression. */ }
      if (values && values.length === command.fields.length && values.every(value => ['string', 'number', 'boolean'].includes(typeof value))) {
        const block = callBlock(command.type);
        command.fields.forEach((name, index) => { block.fields[name] = values[index]; block.inputs[name] = null; });
        stack.at(-1).body.push(block);
        continue;
      }
    }
    throw new Error('このコードは まだ ブロックに できません（' + (lineIndex + 1) + '行）');
  }
  if (stack.length !== 1) throw new Error('このコードは まだ ブロックに できません（かっこを たしかめてね）');
  return [{ id: makeId('b'), type: 'event_start', fields: {}, inputs: {} }].concat(root);
}
