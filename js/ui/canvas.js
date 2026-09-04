import { containsBlock, createBlock, findBlockLocation, makeId } from '../core/project.js';
import { getDefinition } from '../blocks/registry.js';
import { renderBlock } from './blockview.js';
import { preferredInsertLocation } from './tapinsert.js';
import { UI } from './labels.js';

export class ScriptCanvas {
  constructor(element, options) {
    this.element = element;
    this.scriptsElement = element.querySelector('#scripts') || element;
    this.options = options;
    this.selectedId = null;
    this.runningId = null;
    this.insertMode = 'inside';
    this.trash = null;
    const editor = this;
    element.addEventListener('click', function (event) { if (!event.target.closest('.blk')) editor.select(null); });
    element.addEventListener('keydown', function (event) {
      const focused = event.target.closest && event.target.closest('.blk[data-source="editor"]');
      if (focused && event.target === focused) editor.selectedId = focused.dataset.id;
      if (!editor.selectedId) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); editor.deleteSelected(); }
      if (event.key === 'ArrowUp' && event.target === focused) { event.preventDefault(); editor.moveSelected(-1); }
      if (event.key === 'ArrowDown' && event.target === focused) { event.preventDefault(); editor.moveSelected(1); }
    });
  }

  get project() { return this.options.getProject(); }

  render() {
    const project = this.project;
    const editor = this;
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
          onPaletteTap: function () {},
          onField: editor.setField.bind(editor)
        }));
      });
      editor.scriptsElement.appendChild(stack);
    });
    document.getElementById('drop-hint').hidden = project.scripts.some(function (script) { return script.blocks.length > 0; });
    this.updateSelectionControls();
  }

  select(id) {
    this.selectedId = id;
    this.render();
    this.options.onSelect(id ? findBlockLocation(this.project, id) : null);
  }

  updateSelectionControls() {
    const location = this.selectedId ? findBlockLocation(this.project, this.selectedId) : null;
    const movable = Boolean(location && location.kind === 'list');
    this.options.onSelectionState({
      selected: Boolean(location),
      up: movable && location.index > 0,
      down: movable && location.index < location.list.length - 1,
      cShape: Boolean(location && ['c', 'c2'].includes(getDefinition(location.block.type).shape))
    });
  }

  changed(message) {
    this.project.updatedAt = Date.now();
    this.options.onChange(message);
    this.render();
  }

  setField(id, name, value) {
    const location = findBlockLocation(this.project, id);
    if (!location) return;
    location.block.fields[name] = value;
    this.changed();
  }

  addType(type, targetId) {
    const definition = getDefinition(type);
    const block = createBlock(type, definition);
    if (definition.shape === 'value' || definition.shape === 'bool') {
      const hostLocation = findBlockLocation(this.project, targetId || this.selectedId);
      if (!hostLocation) { this.options.toast(UI.selectSlot); return; }
      const hostDefinition = getDefinition(hostLocation.block.type);
      const slot = (hostDefinition.args || []).find(function (arg) { return arg.slot !== false && (!hostLocation.block.inputs || !hostLocation.block.inputs[arg.name]); });
      if (!slot) { this.options.toast(UI.selectSlot); return; }
      if (!hostLocation.block.inputs) hostLocation.block.inputs = {};
      hostLocation.block.inputs[slot.name] = block;
      this.selectedId = block.id;
      this.changed(UI.added);
      return;
    }
    if (definition.shape === 'hat') {
      this.project.scripts.push({ id: makeId('s'), x: 40, y: 40, blocks: [block] });
      this.selectedId = block.id;
      this.changed(UI.added);
      return;
    }
    const targetLocation = findBlockLocation(this.project, targetId || this.selectedId);
    let destination = null;
    if (targetLocation) destination = preferredInsertLocation(targetLocation, getDefinition(targetLocation.block.type), this.insertMode);
    if (!destination) {
      let script = this.project.scripts[0];
      if (!script) { script = { id: makeId('s'), x: 40, y: 40, blocks: [] }; this.project.scripts.push(script); }
      destination = { list: script.blocks, index: script.blocks.length };
    }
    destination.list.splice(destination.index, 0, block);
    this.selectedId = block.id;
    this.changed(UI.added);
  }

  async deleteSelected(id) {
    const blockId = id || this.selectedId;
    const location = findBlockLocation(this.project, blockId);
    if (!location) return;
    if ((this.project.level === 1 || (this.options.confirmAllDeletes && this.options.confirmAllDeletes())) && !(await this.options.confirmDelete())) return;
    this.trash = location.block;
    if (location.kind === 'input') location.parent.inputs[location.key] = null;
    else location.list.splice(location.index, 1);
    const script = location.script;
    if (script && script.blocks.length === 0 && this.project.scripts.length > 1) this.project.scripts.splice(this.project.scripts.indexOf(script), 1);
    this.selectedId = null;
    this.changed(UI.deleted);
  }

  moveSelected(direction) {
    const location = findBlockLocation(this.project, this.selectedId);
    if (!location || location.kind !== 'list') return;
    const next = location.index + direction;
    if (next < 0 || next >= location.list.length) return;
    const temp = location.list[location.index];
    location.list[location.index] = location.list[next];
    location.list[next] = temp;
    this.changed();
  }

  moveBefore(sourceId, targetId) {
    const source = findBlockLocation(this.project, sourceId);
    const target = findBlockLocation(this.project, targetId);
    if (!source || !target || source.kind !== 'list' || target.kind !== 'list' || containsBlock(source.block, targetId)) return;
    const sourceDef = getDefinition(source.block.type);
    if (sourceDef.shape === 'hat' && target.index !== 0) { this.options.toast('はじまりの ブロックは いちばん うえだよ'); return; }
    const moving = source.list.splice(source.index, 1)[0];
    const refreshedTarget = findBlockLocation(this.project, targetId);
    if (!refreshedTarget || refreshedTarget.kind !== 'list') { source.list.splice(source.index, 0, moving); return; }
    refreshedTarget.list.splice(refreshedTarget.index, 0, moving);
    this.selectedId = sourceId;
    this.changed();
  }

  setRunning(id) {
    if (this.runningId === id) return;
    if (this.runningId) {
      const previous = this.element.querySelector('.blk[data-id="' + this.runningId + '"]');
      if (previous) previous.classList.remove('is-running');
    }
    this.runningId = id;
    if (id) {
      const current = this.element.querySelector('.blk[data-id="' + id + '"]');
      if (current) current.classList.add('is-running');
    }
  }

  setInsertMode(mode) { this.insertMode = mode === 'after' ? 'after' : 'inside'; }
}
