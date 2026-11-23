import { eventDefs } from './defs.event.js';
import { motionDefs } from './defs.motion.js';
import { looksDefs } from './defs.looks.js';
import { soundDefs } from './defs.sound.js';
import { controlDefs } from './defs.control.js';
import { sensingDefs } from './defs.sensing.js';
import { deviceDefs } from './defs.device.js';
import { operatorDefs } from './defs.operators.js';
import { dataDefs } from './defs.data.js';
import { functionDefs } from './defs.function.js';

export const categories = [
{ id: 'event', label: 'はじまり', icon: '⚑' },
{ id: 'motion', label: 'うごき', icon: '➜' },
{ id: 'looks', label: 'みため', icon: '✎' },
{ id: 'sound', label: 'おと', icon: '♪' },
{ id: 'control', label: 'せいぎょ', icon: '↻' },
{ id: 'sensing', label: 'しらべる', icon: '?' },
{ id: 'device', label: 'そうち', icon: '◉' },
{ id: 'operators', label: 'けいさん', icon: '+−' },
{ id: 'data', label: 'へんすう', icon: '□' },
{ id: 'function', label: 'じぶん', icon: '◆' }
];

const all = [].concat(eventDefs, motionDefs, looksDefs, soundDefs, controlDefs, sensingDefs, deviceDefs, operatorDefs, dataDefs, functionDefs);
const registry = new Map();
all.forEach(function (definition) {
if (registry.has(definition.type)) throw new Error('Duplicate block type: ' + definition.type);
registry.set(definition.type, Object.freeze(definition));
});

export function getDefinition(type) {
return registry.get(type) || { type: type, level: 1, category: 'event', shape: 'stack', labels: { 1: 'この ブロックは まだ つかえません' }, args: [], unknown: true };
}

export function getLabel(definition, level) {
const labels = definition.labels || {};
const choices = Object.keys(labels).map(Number).sort(function (a, b) { return a - b; });
let selected = choices[0];
choices.forEach(function (choice) { if (choice <= level) selected = choice; });
return labels[selected] || definition.type;
}

export function listDefinitions(level, stage, category, allowed) {
return all.filter(function (definition) {
if (definition.level > level) return false;
if (category && definition.category !== category) return false;
if (definition.stages && definition.stages.indexOf(stage) < 0) return false;
if (allowed && allowed.length && allowed.indexOf(definition.type) < 0) return false;
return true;
});
}

export function allDefinitions() { return all.slice(); }
