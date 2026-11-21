export class Scheduler {
  constructor(options) {
    this.options = options;
    this.threads = [];
    this.running = false;
    this.frameId = 0;
    this.cursor = 0;
    this.lastFrame = 0;
    this.lastStuckNotice = 0;
    this.failed = false;
    this.boundFrame = this.frame.bind(this);
  }

  addThread(script) {
    if (!script || !script.blocks || !script.blocks.length) return;
    const hat = script.blocks[0];
    const previous = this.threads.find(thread => thread.hatId === hat.id);
    if (previous) {
      this.threads.splice(this.threads.indexOf(previous), 1);
      previous.iterator.return();
    }
    const thread = { hatId: hat.id, iterator: this.options.interpreter.runBlocks(script.blocks.slice(1), 0), waitUntil: 0, pending: false, nextValue: undefined };
    this.threads.push(thread);
    return thread;
  }

  matching(eventType, detail) {
    return (this.options.project.scripts || []).filter(function (script) {
      const hat = script.blocks && script.blocks[0];
      if (!hat || hat.type !== eventType) return false;
      if (eventType === 'event_key') return String(hat.fields.KEY) === String(detail === ' ' ? 'space' : detail);
      if (eventType === 'event_message') return String(hat.fields.MESSAGE) === String(detail);
      return true;
    });
  }

  start(eventType, detail) {
    this.matching(eventType || 'event_start', detail).forEach(this.addThread.bind(this));
    if (!this.threads.length) return false;
    if (!this.running) {
      this.running = true;
      this.lastFrame = performance.now();
      this.lastStuckNotice = this.lastFrame;
      this.failed = false;
      this.options.onState(true);
      this.frameId = requestAnimationFrame(this.boundFrame);
    }
    return true;
  }

  trigger(eventType, detail) { this.start(eventType, detail); }

  handleAction(thread, action, now) {
    if (!action) return;
    if (action.kind === 'highlight') this.options.onHighlight(action.blockId);
    else if (action.kind === 'sleep') thread.waitUntil = now + Math.min(600000, Math.max(0, action.ms || 0));
    else if (action.kind === 'promise') {
      thread.pending = true;
      Promise.resolve(action.promise).then(value => {
        if (!this.threads.includes(thread)) return;
        thread.nextValue = value;
        thread.pending = false;
      }, error => {
        const index = this.threads.indexOf(thread);
        if (index < 0) return;
        this.threads.splice(index, 1);
        thread.iterator.return();
        this.failed = true;
        this.options.onError(error);
      });
    } else if (action.kind === 'broadcast') {
      const matches = this.matching('event_message', action.message);
      const receivers = matches.map(script => this.addThread(script));
      if (action.wait && receivers.length) thread.receivers = receivers;
    } else if (action.kind === 'stopAll') this.stop();
  }

  frame(now) {
    if (!this.running) return;
    const frameStart = performance.now();
    const budget = Math.max(1, this.options.stepsPerFrame());
    let steps = 0;
    let idlePasses = 0;
    while (this.threads.length && steps < budget && performance.now() - frameStart < 12) {
      if (this.cursor >= this.threads.length) this.cursor = 0;
      const thread = this.threads[this.cursor];
      if (thread && thread.receivers) {
        const waiting = thread.receivers.some(receiver => this.threads.includes(receiver));
        if (waiting) { this.cursor += 1; idlePasses += 1; if (idlePasses >= this.threads.length) break; continue; }
        thread.receivers = null;
      }
      if (!thread || thread.pending || thread.waitUntil > now) {
        this.cursor += 1;
        idlePasses += 1;
        if (idlePasses >= this.threads.length) break;
        continue;
      }
      idlePasses = 0;
      try {
        const result = thread.iterator.next(thread.nextValue);
        thread.nextValue = undefined;
        steps += 1;
        if (result.done) this.threads.splice(this.cursor, 1);
        else { this.handleAction(thread, result.value, now); this.cursor += 1; }
      } catch (error) {
        this.threads.splice(this.cursor, 1);
        this.failed = true;
        this.options.onError(error);
      }
      if (!this.running) return;
    }
    const delta = Math.min(.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.options.stage.tick(delta);
    this.options.stage.render();
    this.options.onMonitors(this.options.interpreter);
    const changedAt = Math.max(Number(this.options.stage.changedAt) || 0, Number(this.options.interpreter.changedAt) || 0);
    const computing = this.threads.some(thread => !thread.pending && thread.waitUntil <= now && !thread.receivers);
    if (!computing) this.lastStuckNotice = now;
    if (computing && this.options.onStuck && Number.isFinite(changedAt) && now - changedAt >= 10000 && now - this.lastStuckNotice >= 10000) {
      this.lastStuckNotice = now;
      this.options.onStuck();
    }
    if (!this.threads.length) {
      this.running = false;
      this.options.onHighlight(null);
      this.options.onState(false);
      if (!this.failed) this.options.onDone();
      return;
    }
    this.frameId = requestAnimationFrame(this.boundFrame);
  }

  stop() {
    if (this.frameId) cancelAnimationFrame(this.frameId);
    this.threads.forEach(function (thread) { try { thread.iterator.return(); } catch (error) { /* closed */ } });
    this.threads = [];
    this.running = false;
    this.options.audio.stop();
    if (this.options.stage.cancelPending) this.options.stage.cancelPending();
    this.options.onHighlight(null);
    this.options.onState(false);
    this.options.stage.render();
  }
}
