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
    if (!block || event.target.closest('[data-no-drag]') || event.button > 0) return;
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
    if (state.target) state.target.classList.remove('is-drop-target');
    const underneath = document.elementFromPoint(event.clientX, event.clientY);
    state.target = underneath ? underneath.closest('.blk[data-source="editor"]') : null;
    if (state.target && state.target.dataset.id !== state.id) state.target.classList.add('is-drop-target');
  }

  onUp(event) {
    const state = this.state;
    if (!state || state.pointerId !== event.pointerId) return;
    let snapped = false;
    if (state.moved) {
      const point = document.elementFromPoint(event.clientX, event.clientY);
      const target = point ? point.closest('.blk[data-source="editor"]') : null;
      const inEditor = point && point.closest('#script-canvas');
      const inPalette = point && point.closest('#palette-panel');
      if (state.source === 'palette' && inEditor) { this.options.onAdd(state.type, target ? target.dataset.id : null); snapped = true; }
      else if (state.source === 'editor' && target && target.dataset.id !== state.id) { this.options.onMove(state.id, target.dataset.id); snapped = true; }
      else if (state.source === 'editor' && inPalette) { this.options.onDelete(state.id); snapped = true; }
      if (snapped) {
        if (this.options.onSnap) this.options.onSnap();
        if (navigator.vibrate) navigator.vibrate(10);
      }
    }
    this.cleanup();
  }

  cancel() { this.cleanup(); }

  cleanup() {
    const state = this.state;
    if (!state) return;
    if (state.target) state.target.classList.remove('is-drop-target');
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
