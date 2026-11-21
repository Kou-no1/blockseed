import { UserError } from '../core/errors.js';
import { getDefinition } from '../blocks/registry.js';

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asBoolean(value) {
  if (value === 'false' || value === '0' || value === '' || value == null) return false;
  return Boolean(value);
}

export class Interpreter {
  constructor(options) {
    this.project = options.project;
    this.stage = options.stage;
    this.stageName = options.stageName || this.project.stage;
    this.stageAPI = this.stage.getAPI();
    this.audio = options.audio;
    this.keys = options.keys || new Set();
    this.ask = options.ask || function () { return Promise.resolve(''); };
    this.warn = options.warn || function () {};
    this.now = options.now || function () { return performance.now(); };
    this.motionDuration = options.motionDuration || function () { return 0; };
    this.startedAt = this.now();
    this.changedAt = this.startedAt;
    this.answer = '';
    this.vars = new Map((this.project.vars || []).map(function (item) { return [item.id, item.value]; }));
    this.varVisibility = new Map((this.project.vars || []).map(item => [item.id, item.show !== false]));
    this.lists = new Map((this.project.lists || []).map(function (item) { return [item.id, Array.isArray(item.value) ? item.value.slice() : []]; }));
  }

  read(block, name, depth, args) {
    if (block.inputs && block.inputs[name]) return this.evalValue(block.inputs[name], depth + 1, args);
    return block.fields ? block.fields[name] : 0;
  }

  setVariable(id, value) {
    if (!Object.is(this.vars.get(id), value)) this.changedAt = this.now();
    this.vars.set(id, value);
  }

  evalValue(block, depth, args) {
    if (!block) return 0;
    if ((depth || 0) > 1000) throw new UserError('E_DEEP', null, block.id);
    const value = (name) => this.read(block, name, depth || 0, args);
    const number = (name) => asNumber(value(name));
    switch (block.type) {
      case 'op_add': return number('A') + number('B');
      case 'op_sub': return number('A') - number('B');
      case 'op_mul': return number('A') * number('B');
      case 'op_div': {
        const divisor = number('B');
        if (divisor === 0) { this.warn('E_DIV0', block.id); return 0; }
        return number('A') / divisor;
      }
      case 'op_mod': { const divisor = number('B'); if (divisor === 0) { this.warn('E_DIV0', block.id); return 0; } return number('A') % divisor; }
      case 'op_random': {
        const first = number('A');
        const second = number('B');
        const low = Math.min(first, second);
        const high = Math.max(first, second);
        if (Number.isInteger(low) && Number.isInteger(high)) return low + Math.floor(Math.random() * (high - low + 1));
        return low + Math.random() * (high - low);
      }
      case 'op_gt': return number('A') > number('B');
      case 'op_lt': return number('A') < number('B');
      case 'op_eq': return value('A') == value('B');
      case 'op_and': return asBoolean(value('A')) && asBoolean(value('B'));
      case 'op_or': return asBoolean(value('A')) || asBoolean(value('B'));
      case 'op_not': return !asBoolean(value('A'));
      case 'op_round': return Math.round(number('A'));
      case 'op_abs': return Math.abs(number('A'));
      case 'op_join': return String(value('A')) + String(value('B'));
      case 'op_letter': return Array.from(String(value('B')))[Math.floor(number('A')) - 1] || '';
      case 'op_length': return Array.from(String(value('A'))).length;
      case 'data_var': return this.vars.has(block.fields.VAR) ? this.vars.get(block.fields.VAR) : 0;
      case 'data_list_item': { const list = this.lists.get(block.fields.LIST) || []; return list[Math.floor(number('INDEX')) - 1] ?? 0; }
      case 'data_list_len': return (this.lists.get(block.fields.LIST) || []).length;
      case 'turtle_x': case 'motion_x': return this.stageAPI.x ? this.stageAPI.x() : 0;
      case 'turtle_y': case 'motion_y': return this.stageAPI.y ? this.stageAPI.y() : 0;
      case 'turtle_dir': return this.stageAPI.direction ? this.stageAPI.direction() : 0;
      case 'sensing_key': return this.keys.has(block.fields.KEY === 'space' ? ' ' : block.fields.KEY);
      case 'sensing_edge': return this.stageAPI.edge ? this.stageAPI.edge() : false;
      case 'sensing_touching': return this.stageAPI.touching ? this.stageAPI.touching(block.fields.TARGET) : false;
      case 'sensing_mouse_x': return this.stageAPI.mouseX ? this.stageAPI.mouseX() : 0;
      case 'sensing_mouse_y': return this.stageAPI.mouseY ? this.stageAPI.mouseY() : 0;
      case 'sensing_timer': return (this.now() - this.startedAt) / 1000;
      case 'sensing_answer': return this.answer;
      case 'device_sensor': return this.stageAPI.sensor ? this.stageAPI.sensor(block.fields.SENSOR) : 0;
      case 'device_sensor_on': return this.stageAPI.sensorOn ? this.stageAPI.sensorOn(block.fields.SENSOR) : false;
      case 'device_use_time': return this.stageAPI.useTime ? this.stageAPI.useTime() : 0;
      case 'func_arg': return args?.[Math.floor(number('VALUE'))] ?? 0;
      default: return block.fields && Object.keys(block.fields).length ? block.fields[Object.keys(block.fields)[0]] : 0;
    }
  }

  *runBlocks(blocks, depth, args) {
    if ((depth || 0) > 1000) throw new UserError('E_DEEP');
    for (const block of blocks || []) {
      yield { kind: 'highlight', blockId: block.id };
      yield* this.execute(block, depth || 0, args);
    }
  }

  *execute(block, depth, args) {
    const definition = getDefinition(block.type);
    if (definition.stages && definition.stages.indexOf(this.stageName) < 0) {
      this.warn('E_UNKNOWN', block.id);
      yield { kind: 'tick' };
      return;
    }
    const api = this.stageAPI;
    const v = (name) => this.read(block, name, depth, args);
    const n = (name) => asNumber(v(name));
    const body = (branch = 'body') => this.runBlocks(block[branch], depth + 1, args);
    switch (block.type) {
      case 'turtle_forward': { const pending = api.forward(n('STEPS'), this.motionDuration()); if (pending) yield { kind: 'promise', promise: pending }; break; }
      case 'turtle_back': { const pending = api.back(n('STEPS'), this.motionDuration()); if (pending) yield { kind: 'promise', promise: pending }; break; }
      case 'turtle_right': api.right(n('DEG')); break;
      case 'turtle_left': api.left(n('DEG')); break;
      case 'turtle_home': api.home(); break;
      case 'turtle_goto': api.goto(n('X'), n('Y')); break;
      case 'turtle_setdir': api.setDirection(n('DEG')); break;
      case 'motion_move': api.move(n('STEPS')); break;
      case 'motion_turn_r': api.right(n('DEG')); break;
      case 'motion_turn_l': api.left(n('DEG')); break;
      case 'motion_goto_xy': api.goto(n('X'), n('Y')); break;
      case 'motion_glide': {
        const motion = api.glide(n('X'), n('Y'), Math.max(0, n('SECS')));
        if (motion) yield { kind: 'promise', promise: motion };
        break;
      }
      case 'motion_bounce': api.bounce(); break;
      case 'motion_point_to': api.pointTo(v('TARGET')); break;
      case 'pen_down': api.penDown(); break;
      case 'pen_up': api.penUp(); break;
      case 'pen_color': api.penColor(v('COLOR')); break;
      case 'pen_width': api.penWidth(n('WIDTH')); break;
      case 'pen_clear': api.clear(); break;
      case 'looks_say': api.say(v('TEXT')); break;
      case 'looks_say_secs': api.say(v('TEXT')); yield { kind: 'sleep', ms: Math.max(0, n('SECS') * 1000) }; api.say(''); break;
      case 'looks_show': api.show(); break;
      case 'looks_hide': api.hide(); break;
      case 'looks_size': api.size(n('SIZE')); break;
      case 'looks_next_costume': api.nextCostume(); break;
      case 'looks_color': api.color(v('COLOR')); break;
      case 'sound_note': this.audio.tone(n('NOTE'), n('SECS')); yield { kind: 'sleep', ms: Math.max(0, n('SECS') * 1000) }; break;
      case 'sound_effect': this.audio.effect(v('EFFECT')); break;
      case 'sound_tempo_set': if (this.audio.setTempo) this.audio.setTempo(n('TEMPO')); break;
      case 'control_wait': yield { kind: 'sleep', ms: Math.max(0, n('SECS') * 1000) }; break;
      case 'control_repeat': {
        const times = Math.min(100000, Math.max(0, Math.floor(n('TIMES'))));
        for (let index = 0; index < times; index += 1) { yield* body(); yield { kind: 'tick' }; }
        break;
      }
      case 'control_forever': while (true) { yield* body(); yield { kind: 'tick' }; }
      case 'control_if': if (asBoolean(v('COND'))) yield* body(); break;
      case 'control_if_else': yield* body(asBoolean(v('COND')) ? 'body' : 'body2'); break;
      case 'control_wait_until': while (!asBoolean(v('COND'))) yield { kind: 'sleep', ms: 16 }; break;
      case 'control_repeat_until': while (!asBoolean(v('COND'))) { yield* body(); yield { kind: 'tick' }; } break;
      case 'control_stop_all': yield { kind: 'stopAll' }; break;
      case 'control_broadcast': yield { kind: 'broadcast', message: String(v('MESSAGE')), wait: false }; break;
      case 'control_broadcast_wait': yield { kind: 'broadcast', message: String(v('MESSAGE')), wait: true }; break;
      case 'sensing_reset_timer': this.startedAt = this.now(); break;
      case 'sensing_ask': this.answer = yield { kind: 'promise', promise: this.ask(String(v('QUESTION'))) }; break;
      case 'data_set': this.setVariable(block.fields.VAR, v('VALUE')); break;
      case 'data_change': this.setVariable(block.fields.VAR, asNumber(this.vars.get(block.fields.VAR)) + n('VALUE')); break;
      case 'data_show_var': this.varVisibility.set(block.fields.VAR, true); break;
      case 'data_hide_var': this.varVisibility.set(block.fields.VAR, false); break;
      case 'data_list_add': { const list = this.lists.get(block.fields.LIST) || []; list.push(v('VALUE')); this.lists.set(block.fields.LIST, list); this.changedAt = this.now(); break; }
      case 'data_list_del': {
        const list = this.lists.get(block.fields.LIST) || [];
        const index = Math.floor(n('INDEX')) - 1;
        if (index >= 0 && index < list.length) { list.splice(index, 1); this.changedAt = this.now(); }
        break;
      }
      case 'data_list_clear': {
        if (this.lists.get(block.fields.LIST)?.length) this.changedAt = this.now();
        this.lists.set(block.fields.LIST, []);
        break;
      }
      case 'device_out_set': api.setOutput(v('OUTPUT'), asBoolean(v('STATE'))); break;
      case 'device_out_power': api.setPower(v('OUTPUT'), n('POWER')); break;
      case 'device_led_color': api.ledColor(v('COLOR')); break;
      case 'device_reset_use_time': api.resetUseTime(); break;
      case 'func_call': {
        const name = String(v('NAME'));
        const fn = (this.project.funcs || []).find(function (item) { return item.name === name || item.id === name; });
        const script = (this.project.scripts || []).find(function (item) { const hat = item.blocks && item.blocks[0]; return hat && hat.type === 'func_define' && String(hat.fields.NAME) === name; });
        const body = script ? script.blocks.slice(1) : fn ? fn.body || [] : null;
        const rawArgs = v('ARGS');
        const callArgs = String(rawArgs == null ? '' : rawArgs).split(',').map(function (item) { const text = item.trim(); const number = Number(text); return text !== '' && Number.isFinite(number) ? number : text; });
        if (body) yield* this.runBlocks(body, depth + 1, callArgs);
        break;
      }
      default: if (!block.type.startsWith('event_') && !block.type.startsWith('op_') && !block.type.startsWith('data_var')) this.warn('E_UNKNOWN', block.id); break;
    }
    yield { kind: 'tick' };
  }
}
