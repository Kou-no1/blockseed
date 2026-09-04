import { Stage, clamp } from './stage.js';

export class TurtleStage extends Stage {
  constructor(penCanvas, actorCanvas) {
    super();
    this.penCanvas = penCanvas;
    this.actorCanvas = actorCanvas;
    this.penContext = penCanvas.getContext('2d');
    this.actorContext = actorCanvas.getContext('2d');
    this.grid = false;
    this.animation = null;
    this.animationQueue = [];
    this.reset();
  }

  reset() {
    this.cancelPending();
    this.state = { x: 0, y: 0, dir: 0, penDown: true, color: '#1672b8', width: 3 };
    this.segments = [];
    this.changedAt = performance.now();
    this.redrawPen();
    this.render();
  }

  markChanged() { this.changedAt = performance.now(); }

  point(x, y) { return { x: 240 + x, y: 180 - y }; }

  redrawPen() {
    const ctx = this.penContext;
    ctx.clearRect(0, 0, 480, 360);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.segments.forEach((segment) => {
      const a = this.point(segment.x1, segment.y1);
      const b = this.point(segment.x2, segment.y2);
      ctx.strokeStyle = segment.color;
      ctx.lineWidth = segment.width;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    });
  }

  clippedTarget(dx, dy) {
    let scale = 1;
    if (dx > 0) scale = Math.min(scale, (232 - this.state.x) / dx);
    if (dx < 0) scale = Math.min(scale, (-232 - this.state.x) / dx);
    if (dy > 0) scale = Math.min(scale, (172 - this.state.y) / dy);
    if (dy < 0) scale = Math.min(scale, (-172 - this.state.y) / dy);
    scale = clamp(scale, 0, 1);
    return { x: this.state.x + dx * scale, y: this.state.y + dy * scale };
  }

  forward(distance, duration) {
    if (Number(duration) > 0) {
      return new Promise((resolve) => {
        this.animationQueue.push({ distance: Number(distance) || 0, duration: Number(duration), resolve: resolve });
        this.startNextAnimation();
      });
    }
    const radians = this.state.dir * Math.PI / 180;
    const target = this.clippedTarget(Math.sin(radians) * Number(distance || 0), Math.cos(radians) * Number(distance || 0));
    if (this.state.penDown && (target.x !== this.state.x || target.y !== this.state.y)) {
      this.segments.push({ x1: this.state.x, y1: this.state.y, x2: target.x, y2: target.y, color: this.state.color, width: this.state.width });
      this.redrawPen();
    }
    this.state.x = target.x;
    this.state.y = target.y;
    this.markChanged();
  }

  startNextAnimation() {
    if (this.animation || !this.animationQueue.length) return;
    const request = this.animationQueue.shift();
    const radians = this.state.dir * Math.PI / 180;
    const target = this.clippedTarget(Math.sin(radians) * request.distance, Math.cos(radians) * request.distance);
    const animation = {
      fromX: this.state.x, fromY: this.state.y, toX: target.x, toY: target.y,
      elapsed: 0, duration: Math.max(1, request.duration), resolve: request.resolve, segment: null
    };
    if (this.state.penDown && (target.x !== this.state.x || target.y !== this.state.y)) {
      animation.segment = { x1: this.state.x, y1: this.state.y, x2: this.state.x, y2: this.state.y, color: this.state.color, width: this.state.width };
      this.segments.push(animation.segment);
    }
    this.animation = animation;
  }

  tick(deltaSeconds) {
    if (!this.animation) return;
    const item = this.animation;
    item.elapsed += Math.max(0, Number(deltaSeconds) || 0) * 1000;
    const progress = Math.min(1, item.elapsed / item.duration);
    this.state.x = item.fromX + (item.toX - item.fromX) * progress;
    this.state.y = item.fromY + (item.toY - item.fromY) * progress;
    if (item.segment) { item.segment.x2 = this.state.x; item.segment.y2 = this.state.y; this.redrawPen(); }
    this.markChanged();
    if (progress >= 1) {
      this.animation = null;
      item.resolve();
      this.startNextAnimation();
    }
  }

  cancelPending() {
    if (this.animation) { this.animation.resolve(); this.animation = null; }
    this.animationQueue.forEach(function (item) { item.resolve(); });
    this.animationQueue = [];
  }

  turn(degrees) { this.state.dir = ((this.state.dir + Number(degrees || 0)) % 360 + 360) % 360; this.markChanged(); }
  goto(x, y) {
    const targetX = clamp(x, -232, 232);
    const targetY = clamp(y, -172, 172);
    if (this.state.penDown) this.segments.push({ x1: this.state.x, y1: this.state.y, x2: targetX, y2: targetY, color: this.state.color, width: this.state.width });
    this.state.x = targetX;
    this.state.y = targetY;
    this.redrawPen();
    this.markChanged();
  }
  home() { this.goto(0, 0); this.state.dir = 0; }
  setDirection(value) { this.state.dir = ((Number(value) || 0) % 360 + 360) % 360; this.markChanged(); }
  clear() { this.segments = []; this.redrawPen(); this.markChanged(); }
  setPen(value) { this.state.penDown = Boolean(value); }
  setColor(value) { if (/^#[0-9a-f]{6}$/i.test(value)) this.state.color = value; }
  setWidth(value) { this.state.width = clamp(value, 1, 30); }
  setGrid(value) { this.grid = Boolean(value); this.render(); }

  renderGrid(ctx) {
    if (!this.grid) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(61, 97, 93, .16)';
    ctx.fillStyle = 'rgba(35, 77, 73, .62)';
    ctx.lineWidth = 1;
    for (let x = 40; x < 480; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 360); ctx.stroke(); }
    for (let y = 20; y < 360; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(480, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(240, 0); ctx.lineTo(240, 360); ctx.moveTo(0, 180); ctx.lineTo(480, 180); ctx.strokeStyle = 'rgba(23, 107, 100, .35)'; ctx.stroke();
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = 'rgba(23, 107, 100, .18)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let angle = 0; angle < 360; angle += 30) {
      const radians = angle * Math.PI / 180;
      const x = 240 + Math.sin(radians) * 158;
      const y = 180 - Math.cos(radians) * 158;
      ctx.beginPath(); ctx.moveTo(240, 180); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillText(String(angle) + '°', 240 + Math.sin(radians) * 170, 180 - Math.cos(radians) * 170);
    }
    ctx.setLineDash([]);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'; ctx.fillText('0', 245, 194);
    ctx.restore();
  }

  render() {
    const ctx = this.actorContext;
    ctx.clearRect(0, 0, 480, 360);
    this.renderGrid(ctx);
    const point = this.point(this.state.x, this.state.y);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(this.state.dir * Math.PI / 180);
    ctx.fillStyle = '#176b64';
    ctx.strokeStyle = '#083f3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(13, 13);
    ctx.lineTo(0, 8);
    ctx.lineTo(-13, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  getAPI() {
    return {
      forward: this.forward.bind(this), back: (value, duration) => this.forward(-Number(value || 0), duration),
      right: this.turn.bind(this), left: (value) => this.turn(-Number(value || 0)),
      home: this.home.bind(this), goto: this.goto.bind(this), setDirection: this.setDirection.bind(this),
      penDown: () => this.setPen(true), penUp: () => this.setPen(false), penColor: this.setColor.bind(this), penWidth: this.setWidth.bind(this), clear: this.clear.bind(this),
      x: () => this.state.x, y: () => this.state.y, direction: () => this.state.dir
    };
  }

  serialize() { return { state: Object.assign({}, this.state), segments: this.segments.slice() }; }
  restore(data) { if (data && data.state) this.state = Object.assign({}, data.state); if (data && Array.isArray(data.segments)) this.segments = data.segments.slice(); this.redrawPen(); this.render(); }
  captureThumbnail() {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 480, 360);
    ctx.drawImage(this.penCanvas, 0, 0); ctx.drawImage(this.actorCanvas, 0, 0);
    return canvas.toDataURL('image/png');
  }
}
