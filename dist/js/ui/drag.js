function dropTarget(point, y) {
const block = point?.closest('.blk[data-source="editor"]');
if (!block) return null;
const slot = point.closest('[data-slot]');
if (slot && slot.closest('.blk') === block) return { block, marker: slot, placement: 'after', slot: slot.dataset.slot };
const body = point.closest('.blk-body');
if (body && body.parentElement === block) return { block, marker: body, placement: body.dataset.bodyKey === 'body2' ? 'else' : 'inside' };
const box = block.getBoundingClientRect();
const before = !block.classList.contains('blk--hat') && y < box.top + box.height / 2;
return { block, marker: block, placement: before ? 'before' : 'after' };
}

function clearMarker(state) {
if (!state.target) return;
state.target.marker.classList.remove('is-drop-target');
delete state.target.marker.dataset.dropPosition;
}

export class DragController {
constructor(layer, options) {
this.layer = layer;
this.options = options;
this.state = null;
this.boundDown = this.onDown.bind(this);
document.addEventListener('pointerdown', this.boundDown);
}

onDown(event) {
const block = event.target.closest('.blk');
if (this.state || !block || !['palette', 'editor'].includes(block.dataset.source) || event.target.closest('[data-no-drag]') || event.button > 0) return;
this.state = { block: block, id: block.dataset.id, type: block.dataset.type, source: block.dataset.source, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false, ghost: null, target: null };
this.state.hintTimer = setTimeout(function () { document.dispatchEvent(new CustomEvent('blockhint', { detail: block.getAttribute('aria-label') || '' })); }, 300);
block.setPointerCapture(event.pointerId);
block.addEventListener('pointermove', this.onMoveBound = this.onMove.bind(this));
block.addEventListener('pointerup', this.onUpBound = this.onUp.bind(this), { once: true });
block.addEventListener('pointercancel', this.onCancelBound = this.cancel.bind(this), { once: true });
}

onMove(event) {
const state = this.state;
if (!state || state.pointerId !== event.pointerId) return;
const distance = Math.hypot(event.clientX - state.x, event.clientY - state.y);
if (!state.moved && distance < 8) return;
event.preventDefault();
if (!state.moved) {
state.moved = true;
clearTimeout(state.hintTimer);
state.block.dataset.dragged = '1';
state.ghost = state.block.cloneNode(true);
state.ghost.classList.add('drag-ghost');
state.ghost.style.width = Math.min(380, state.block.getBoundingClientRect().width) + 'px';
this.layer.appendChild(state.ghost);
}
state.ghost.style.transform = 'translate3d(' + (event.clientX + 12) + 'px,' + (event.clientY + 12) + 'px,0)';
clearMarker(state);
const underneath = document.elementFromPoint(event.clientX, event.clientY);
state.target = dropTarget(underneath, event.clientY);
if (state.target && !state.block.contains(state.target.block)) {
state.target.marker.classList.add('is-drop-target');
state.target.marker.dataset.dropPosition = state.target.placement;
}
}

async onUp(event) {
const state = this.state;
if (!state || state.pointerId !== event.pointerId) return;
let snapped = false;
if (state.moved) {
const point = document.elementFromPoint(event.clientX, event.clientY);
const target = dropTarget(point, event.clientY);
const inEditor = point && point.closest('#script-canvas');
const inPalette = point && point.closest('#palette-panel');
this.cleanup();
if (state.source === 'palette' && inEditor) snapped = this.options.onAdd(state.type, target?.block.dataset.id, target?.placement || 'end', target?.slot);
else if (state.source === 'editor' && target && target.block.dataset.id !== state.id) snapped = this.options.onMove(state.id, target.block.dataset.id, target.placement, target.slot);
else if (state.source === 'editor' && inPalette) snapped = await this.options.onDelete(state.id);
if (snapped) {
if (this.options.onSnap) this.options.onSnap();
if (navigator.vibrate) navigator.vibrate(10);
}
return;
}
this.cleanup();
}

cancel() { this.cleanup(); }

cleanup() {
const state = this.state;
if (!state) return;
clearMarker(state);
clearTimeout(state.hintTimer);
if (state.ghost) state.ghost.remove();
state.block.removeEventListener('pointermove', this.onMoveBound);
state.block.removeEventListener('pointerup', this.onUpBound);
state.block.removeEventListener('pointercancel', this.onCancelBound);
try { if (state.block.hasPointerCapture && state.block.hasPointerCapture(state.pointerId)) state.block.releasePointerCapture(state.pointerId); } catch (error) { /* pointer already released */ }
setTimeout(function () { if (state.block) delete state.block.dataset.dragged; }, 80);
this.state = null;
}

destroy() {
this.cleanup();
document.removeEventListener('pointerdown', this.boundDown);
}
}
