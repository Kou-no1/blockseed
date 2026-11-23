import { LEVELS } from './labels.js';

export class Toolbar {
constructor(options) {
this.options = options;
this.run = document.getElementById('run-btn');
this.stop = document.getElementById('stop-btn');
this.level = document.getElementById('level-btn');
this.undo = document.getElementById('undo-btn');
this.redo = document.getElementById('redo-btn');
this.speed = document.getElementById('speed-select');
this.run.addEventListener('click', options.onRun);
this.stop.addEventListener('click', options.onStop);
this.level.addEventListener('click', options.onLevel);
this.undo.addEventListener('click', options.onUndo);
this.redo.addEventListener('click', options.onRedo);
}

update(state) {
this.run.disabled = state.running;
this.stop.disabled = !state.running;
this.level.textContent = LEVELS[state.level].button;
this.level.disabled = state.levelLocked;
this.undo.disabled = !state.canUndo || state.running;
this.redo.disabled = !state.canRedo || state.running;
}

get stepsPerFrame() { return Number(this.speed.value) || 20; }
}
