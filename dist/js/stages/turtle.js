import { Stage, clamp } from './stage.js';

export class TurtleStage extends Stage {
  constructor(penCanvas, actorCanvas) {
    super();
    this.penCanvas = penCanvas;
    this.actorCanvas = actorCanvas;
    this.penContext = penCanvas.getContext('2d');
    this.actorContext = actorCanvas.getContext('2d');
    this.grid = false;
    this.region = 'patagonia';
    this.animation = null;
    this.animationQueue = [];
    this.reset();
  }

  reset() {
    this.cancelPending();
    this.state = { x: 0, y: 0, dir: 0, penDown: true, color: '#187b73', width: 3 };
    this.segments = [];
    this.changedAt = performance.now();
    this.redrawPen();
    this.render();
  }

  markChanged() { this.changedAt = performance.now(); }

  point(x, y) { return { x: 240 + x, y: 180 - y }; }

  setRegion(region) {
    if (region === this.region) return;
    this.region = region;
    this.redrawPen();
  }

  drawLandmark(ctx) {
    ctx.save();
    if (this.region === 'namib') {
      for (let row = 0; row < 8; row++) {
        const y = 223 + row * 19;
        ctx.beginPath();
        ctx.moveTo(-8, y);
        ctx.bezierCurveTo(44, y + 18, 88, y - 16, 150 + row * 5, y + 19);
        ctx.bezierCurveTo(80, y - 5, 54, y + 39, -8, y + 12);
        ctx.fillStyle = 'rgba(192, 131, 70, .16)'; ctx.fill();
        ctx.strokeStyle = 'rgba(146, 88, 44, .38)'; ctx.stroke();
      }
    } else if (this.region === 'yakushima') {
      ctx.strokeStyle = 'rgba(51, 100, 73, .44)';
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 7 - Math.floor(row / 2); col++) {
          const x = 14 + col * 23 + 6 * Math.sin(col + row);
          const y = 246 + row * 20 + 8 * Math.cos(col * 1.4 + row);
          ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x, y - 9);
          ctx.lineTo(x + 4, y); ctx.closePath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 3); ctx.stroke();
        }
      }
    } else {
      ctx.translate(51, 320);
      ctx.fillStyle = '#bbd6cc';
      ctx.strokeStyle = 'rgba(57, 111, 105, .55)';
      for (const scale of [1.13, 1, .9]) {
        ctx.save(); ctx.scale(scale, scale);
        ctx.beginPath(); ctx.moveTo(-108, 12);
        ctx.bezierCurveTo(-60, 20, -33, -12, -5, -14);
        ctx.bezierCurveTo(24, -19, 37, -45, 84, -46);
        ctx.bezierCurveTo(65, -34, 60, -14, 32, -6);
        ctx.bezierCurveTo(7, 0, -6, 34, -44, 34);
        ctx.lineTo(-108, 55); ctx.closePath();
        if (scale === 1) ctx.fill();
        ctx.stroke(); ctx.restore();
      }
      ctx.fillStyle = '#3d6761'; ctx.font = '11px sans-serif'; ctx.fillText('氷河湖', -30, 6);
    }
    ctx.restore();
  }

  drawSurveyMap(ctx) {
    ctx.save();
    ctx.lineWidth = .7;
    ctx.strokeStyle = 'rgba(63, 99, 89, .23)';
    const hills = [[-16, 38, 105, 81, .9], [440, 340, 120, 70, 2.3], [475, -23, 88, 70, 2]];
    for (const [cx, cy, rx, ry, phase] of hills) {
      for (let ring = 1; ring <= 9; ring++) {
        ctx.beginPath();
        const scale = ring / 6;
        for (let step = 0; step < 96; step++) {
          const angle = Math.PI * 2 * step / 96;
          const radius = 1 + .09 * Math.sin(angle * 3 + phase) + .06 * Math.cos(angle * 5 - phase + scale);
          const x = cx + Math.cos(angle) * rx * scale * radius;
          const y = cy + Math.sin(angle) * ry * scale * radius + .16 * (x - cx);
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(50, 88, 81, .17)';
    ctx.beginPath();
    for (let x = 0; x <= 480; x += 40) {
      ctx.moveTo(x, 0); ctx.lineTo(x, 5);
      ctx.moveTo(x, 355); ctx.lineTo(x, 360);
      for (let y = 20; y < 360; y += 40) {
        ctx.moveTo(x - 2, y); ctx.lineTo(x + 2, y);
        ctx.moveTo(x, y - 2); ctx.lineTo(x, y + 2);
      }
    }
    ctx.stroke();
    this.drawLandmark(ctx);
    ctx.restore();
  }

  drawSegment(segment) {
    const ctx = this.penContext;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const a = this.point(segment.x1, segment.y1);
    const b = this.point(segment.x2, segment.y2);
    ctx.strokeStyle = segment.color;
    ctx.lineWidth = segment.width;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  redrawPen() {
    this.penContext.clearRect(0, 0, 480, 360);
    this.drawSurveyMap(this.penContext);
    this.segments.forEach(segment => this.drawSegment(segment));
  }

  appendLine(x, y) {
    if (!this.state.penDown || (x === this.state.x && y === this.state.y)) return;
    const segment = { x1: this.state.x, y1: this.state.y, x2: x, y2: y, color: this.state.color, width: this.state.width };
    this.segments.push(segment);
    this.drawSegment(segment);
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
    this.appendLine(target.x, target.y);
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
    if (item.segment) {
      this.drawSegment({ ...item.segment, x1: item.segment.x2, y1: item.segment.y2, x2: this.state.x, y2: this.state.y });
      item.segment.x2 = this.state.x;
      item.segment.y2 = this.state.y;
    }
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
    this.cancelPending();
    this.appendLine(targetX, targetY);
    this.state.x = targetX;
    this.state.y = targetY;
    this.markChanged();
  }
  home() { this.goto(0, 0); this.state.dir = 0; }
  setDirection(value) { this.state.dir = ((Number(value) || 0) % 360 + 360) % 360; this.markChanged(); }
  clear() {
    if (this.animation) this.animation.segment = null;
    this.segments = [];
    this.redrawPen();
    this.markChanged();
  }
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
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(227, 106, 61, .12)';
    ctx.fill();
    ctx.fillStyle = '#de5930';
    ctx.strokeStyle = '#fffdf4';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(10, 11);
    ctx.lineTo(0, 6);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#a63f28';
    ctx.beginPath();
    ctx.moveTo(0, -10); ctx.lineTo(0, 4); ctx.lineTo(7, 8);
    ctx.closePath(); ctx.fill();
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
