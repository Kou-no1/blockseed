import { containsBlock, createBlock, findBlockLocation, makeId } from '../core/project.js';
import { getDefinition } from '../blocks/registry.js';
import { plainLabel, renderBlock } from './blockview.js';
import { createInput } from './inputs.js';
import { preferredInsertLocation } from './tapinsert.js';
import { UI } from './labels.js';

function canMove(location, offset) {
if (!location || location.kind !== 'list' || getDefinition(location.block.type).shape === 'hat') return false;
const neighbor = location.list[location.index + offset];
return Boolean(neighbor && getDefinition(neighbor.type).shape !== 'hat');
}

function slotAccepts(arg, definition) {
return arg.slot !== false && (arg.type === 'bool' ? definition.shape === 'bool' : definition.shape === 'value');
}

export class ScriptCanvas {
constructor(element, options) {
this.element = element;
this.scriptsElement = element.querySelector('#scripts') || element;
this.options = options;
this.selectedId = null;
this.runningId = null;
this.insertMode = 'inside';
this.selectedSlot = null;
const editor = this;
element.addEventListener('click', function (event) { if (!event.target.closest('.blk')) editor.select(null); });
element.addEventListener('focusin', function (event) {
const focused = event.target.closest('.blk[data-source="editor"]');
if (focused) editor.select(focused.dataset.id, event.target.closest('[data-slot]')?.dataset.slot);
});
element.addEventListener('keydown', function (event) {
const focused = event.target.closest('.blk[data-source="editor"]');
if (!focused || event.target !== focused || event.defaultPrevented) return;
if (event.key === 'Delete' || event.key === 'Backspace') {
event.preventDefault();
editor.deleteSelected();
} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
event.preventDefault();
const direction = event.key === 'ArrowUp' ? -1 : 1;
if (event.altKey) editor.moveSelected(direction);
else {
const blocks = Array.from(element.querySelectorAll('.blk[data-source="editor"]'));
blocks[blocks.indexOf(focused) + direction]?.focus();
}
}
});
}

get project() { return this.options.getProject(); }

render() {
const project = this.project;
const editor = this;
const focusWasBlock = document.activeElement?.matches('.blk[data-source="editor"]');
if (!findBlockLocation(project, this.selectedId)) {
this.selectedId = null;
this.selectedSlot = null;
}
this.scriptsElement.textContent = '';
(project.scripts || []).forEach(function (script) {
const stack = document.createElement('div');
stack.className = 'script-stack';
stack.dataset.scriptId = script.id;
(script.blocks || []).forEach(function (block) {
stack.appendChild(renderBlock(block, {
level: project.level,
project: project,
rubyEnabled: editor.options.rubyEnabled(),
selectedId: editor.selectedId,
runningId: editor.runningId,
palette: false,
onSelect: editor.select.bind(editor),
onBody: function (id, key) {
editor.select(id);
editor.setInsertMode(key === 'body2' ? 'else' : 'inside');
},
onPaletteTap: function () {},
onField: editor.setField.bind(editor)
}));
});
editor.scriptsElement.appendChild(stack);
});
document.getElementById('drop-hint').hidden = project.scripts.some(function (script) { return script.blocks.length > 0; });
this.paintSelection();
if (focusWasBlock) this.blockElement(this.selectedId)?.focus();
this.updateSelectionControls();
}

blockElement(id) {
return id ? this.element.querySelector('.blk[data-id="' + CSS.escape(id) + '"]') : null;
}

paintSelection() {
this.element.querySelectorAll('.is-selected,.is-slot-selected').forEach(function (node) {
node.classList.remove('is-selected', 'is-slot-selected');
});
const selected = this.blockElement(this.selectedId);
selected?.classList.add('is-selected');
if (selected && this.selectedSlot) selected.querySelector('[data-slot="' + CSS.escape(this.selectedSlot) + '"]')?.classList.add('is-slot-selected');
}

select(id, slot) {
if (id !== this.selectedId) this.insertMode = 'inside';
this.selectedId = id;
this.selectedSlot = slot || null;
this.paintSelection();
this.updateSelectionControls();
this.options.onSelect(id ? findBlockLocation(this.project, id) : null);
}

updateSelectionControls() {
const location = this.selectedId ? findBlockLocation(this.project, this.selectedId) : null;
const shape = location && getDefinition(location.block.type).shape;
this.options.onSelectionState({
selected: Boolean(location),
up: canMove(location, -1),
down: canMove(location, 1),
cShape: shape === 'c' || shape === 'c2',
hasElse: shape === 'c2'
});
}

changed(message) {
this.project.updatedAt = Date.now();
this.options.onChange(message);
this.render();
}

setField(id, name, value) {
const location = findBlockLocation(this.project, id);
if (!location || this.options.isRunning() || location.block.fields[name] === value) return;
location.block.fields[name] = value;
this.project.updatedAt = Date.now();
this.options.onChange();
const view = this.blockElement(id);
if (!view) return;
view.setAttribute('aria-label', plainLabel(getDefinition(location.block.type), location.block, this.project.level));
const field = view.querySelector('[data-field="' + CSS.escape(name) + '"]');
// A stepper captures its value in its click handlers. Replace just that field,
// retaining focus and leaving other native inputs and their caret positions intact.
if (field?.querySelector('.blk-step')) {
const focused = Array.from(field.children).indexOf(document.activeElement);
const replacement = createInput(getDefinition(location.block.type).args.find(arg => arg.name === name), location.block, {
level: this.project.level, project: this.project, onField: this.setField.bind(this)
});
field.replaceWith(replacement);
if (focused >= 0) replacement.children[focused].focus();
this.paintSelection();
}
}

addType(type, targetId, placement, slotName) {
if (this.options.isRunning()) return false;
const definition = getDefinition(type);
const block = createBlock(type, definition);
for (const arg of definition.args || []) {
const items = arg.type === 'var' ? this.project.vars : arg.name === 'LIST' ? this.project.lists : arg.type === 'func' ? this.project.funcs : null;
if (!items?.length) continue;
const key = arg.type === 'func' ? 'name' : 'id';
if (!items.some(item => item[key] === block.fields[arg.name])) block.fields[arg.name] = items[0][key];
}
if (definition.shape === 'value' || definition.shape === 'bool') {
const hostLocation = findBlockLocation(this.project, targetId || this.selectedId);
if (!hostLocation) { this.options.toast(UI.selectSlot); return false; }
const hostDefinition = getDefinition(hostLocation.block.type);
const requestedSlot = slotName || (!targetId && this.selectedSlot);
const slot = (hostDefinition.args || []).find(arg => slotAccepts(arg, definition) && (!requestedSlot || requestedSlot === arg.name) && !hostLocation.block.inputs?.[arg.name]);
if (!slot) { this.options.toast(definition.shape === 'bool' ? '「もし」などの 条件を えらんでね' : 'かずや ことばを 入れるところを えらんでね'); return false; }
if (!hostLocation.block.inputs) hostLocation.block.inputs = {};
hostLocation.block.inputs[slot.name] = block;
this.selectedId = block.id;
this.selectedSlot = null;
this.changed(UI.added);
return true;
}
if (definition.shape === 'hat') {
this.project.scripts.push({ id: makeId('s'), x: 40, y: 40, blocks: [block] });
this.selectedId = block.id;
this.selectedSlot = null;
this.changed(UI.added);
return true;
}
let targetLocation = findBlockLocation(this.project, targetId || this.selectedId);
while (targetLocation?.kind === 'input') targetLocation = findBlockLocation(this.project, targetLocation.parent.id);
let destination = null;
if (targetLocation && placement !== 'end') destination = preferredInsertLocation(targetLocation, getDefinition(targetLocation.block.type), placement || this.insertMode);
if (!destination) {
let script = targetLocation?.script || this.project.scripts[0];
if (!script) { script = { id: makeId('s'), x: 40, y: 40, blocks: [] }; this.project.scripts.push(script); }
if (!script.blocks.length) script.blocks.push(createBlock('event_start', getDefinition('event_start')));
destination = { list: script.blocks, index: script.blocks.length };
}
destination.list.splice(destination.index, 0, block);
this.selectedId = block.id;
this.selectedSlot = null;
this.insertMode = 'inside';
this.changed(UI.added);
return true;
}

async deleteSelected(id) {
const blockId = id || this.selectedId;
const location = findBlockLocation(this.project, blockId);
if (!location || this.options.isRunning()) return false;
if (getDefinition(location.block.type).shape === 'hat' && location.list?.length > 1) {
this.options.toast('下の ブロックを 移動してから、はじまりを けしてね');
return false;
}
if ((this.project.level === 1 || (this.options.confirmAllDeletes && this.options.confirmAllDeletes())) && !(await this.options.confirmDelete())) return;
if (location.kind === 'input') location.parent.inputs[location.key] = null;
else location.list.splice(location.index, 1);
const script = location.script;
if (script && script.blocks.length === 0 && this.project.scripts.length > 1) this.project.scripts.splice(this.project.scripts.indexOf(script), 1);
this.selectedId = (location.list?.[location.index] || location.list?.[location.index - 1] || location.parent)?.id || null;
this.selectedSlot = null;
this.changed(UI.deleted);
return true;
}

moveSelected(direction) {
const location = findBlockLocation(this.project, this.selectedId);
if (this.options.isRunning() || !canMove(location, direction)) return;
const next = location.index + direction;
if (next < 0 || next >= location.list.length) return;
const temp = location.list[location.index];
location.list[location.index] = location.list[next];
location.list[next] = temp;
this.changed();
}

moveBefore(sourceId, targetId, placement = 'before', slotName) {
const source = findBlockLocation(this.project, sourceId);
const target = findBlockLocation(this.project, targetId);
if (this.options.isRunning() || !source || !target || containsBlock(source.block, targetId)) return false;
const sourceDefinition = getDefinition(source.block.type);
const targetDefinition = getDefinition(target.block.type);
if (source.kind === 'input') {
const slot = targetDefinition.args.find(arg => slotAccepts(arg, sourceDefinition) && (!slotName || arg.name === slotName) && !target.block.inputs?.[arg.name]);
if (!slot) { this.options.toast(UI.selectSlot); return false; }
source.parent.inputs[source.key] = null;
target.block.inputs[slot.name] = source.block;
} else {
if (target.kind !== 'list' || sourceDefinition.shape === 'hat') return false;
const destination = preferredInsertLocation(target, targetDefinition, placement);
if (!destination) return false;
const index = destination.index - (destination.list === source.list && source.index < destination.index ? 1 : 0);
if (source.list === destination.list && source.index === index) return false;
source.list.splice(source.index, 1);
destination.list.splice(index, 0, source.block);
}
this.selectedId = sourceId;
this.selectedSlot = null;
this.changed();
return true;
}

setRunning(id) {
if (this.runningId === id) return;
if (this.runningId) {
const previous = this.blockElement(this.runningId);
if (previous) previous.classList.remove('is-running');
}
this.runningId = id;
if (id) {
const current = this.blockElement(id);
if (current) current.classList.add('is-running');
}
}

setInsertMode(mode) {
this.insertMode = ['after', 'else'].includes(mode) ? mode : 'inside';
this.updateSelectionControls();
}
}
