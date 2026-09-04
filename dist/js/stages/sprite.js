import { Stage, clamp } from './stage.js';

export class SpriteStage extends Stage {
  constructor(canvas, getProject) {
    super();
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.getProject = getProject;
    this.mouse = { x: 0, y: 0 };
    this.message = '';
    this.costume = 0;
    this.changedAt = performance.now();
    canvas.addEventListener('pointermove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) / rect.width * 480 - 240;
      this.mouse.y = 180 - (event.clientY - rect.top) / rect.height * 360;
    });
  }

  sprite() { return this.getProject().sprites[0]; }
  reset() {
    const sprite = this.sprite();
    if (sprite) { sprite.x = 0; sprite.y = 0; sprite.dir = 90; sprite.visible = true; sprite.size = 100; }
    this.message = '';
    this.costume = 0;
    this.changedAt = performance.now();
    this.render();
  }

  move(distance) {
    const sprite = this.sprite(); if (!sprite) return;
    const radians = (sprite.dir - 90) * Math.PI / 180;
    sprite.x = clamp(sprite.x + Math.cos(radians) * distance, -220, 220);
    sprite.y = clamp(sprite.y + Math.sin(radians) * distance, -160, 160);
    this.changedAt = performance.now();
  }
  turn(value) { const sprite = this.sprite(); if (sprite) sprite.dir = ((sprite.dir + value) % 360 + 360) % 360; this.changedAt = performance.now(); }
  goto(x, y) { const sprite = this.sprite(); if (sprite) { sprite.x = clamp(x, -220, 220); sprite.y = clamp(y, -160, 160); } this.changedAt = performance.now(); }
  bounce() { const sprite = this.sprite(); if (!sprite) return; if (Math.abs(sprite.x) >= 219 || Math.abs(sprite.y) >= 159) sprite.dir = (360 - sprite.dir) % 360; }
  edge() { const sprite = this.sprite(); return Boolean(sprite && (Math.abs(sprite.x) >= 218 || Math.abs(sprite.y) >= 158)); }
  touching(target) {
    const sprite = this.sprite(); if (!sprite) return false;
    if (target === 'edge') return this.edge();
    if (target === 'mouse') return Math.hypot(sprite.x - this.mouse.x, sprite.y - this.mouse.y) <= Math.max(24, sprite.size * .32);
    const other = (this.getProject().sprites || []).find(function (item) { return item.id === target || item.name === target; });
    return Boolean(other && other !== sprite && Math.hypot(sprite.x - other.x, sprite.y - other.y) <= (sprite.size + other.size) * .28);
  }

  drawCharacter(ctx, sprite) {
    const size = clamp(sprite.size, 20, 220) / 100;
    ctx.save();
    ctx.translate(240 + sprite.x, 180 - sprite.y);
    ctx.rotate((sprite.dir - 90) * Math.PI / 180);
    ctx.scale(size * (this.costume ? 1.08 : 1), size * (this.costume ? .92 : 1));
    ctx.fillStyle = sprite.color || '#f5a623';
    ctx.strokeStyle = '#754718';
    ctx.lineWidth = 3;
    const shape = sprite.shape || 'cat';
    if (shape === 'robot') {
      ctx.fillRect(-26, -30, 52, 52); ctx.strokeRect(-26, -30, 52, 52);
      ctx.fillRect(-18, 22, 12, 18); ctx.fillRect(6, 22, 12, 18);
      ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -43); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -46, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#173536'; ctx.fillRect(-14, -14, 8, 8); ctx.fillRect(6, -14, 8, 8); ctx.fillRect(-12, 5, 24, 4);
    } else if (shape === 'car') {
      ctx.fillRect(-38, -12, 76, 30); ctx.strokeRect(-38, -12, 76, 30);
      ctx.beginPath(); ctx.moveTo(-22, -12); ctx.lineTo(-10, -30); ctx.lineTo(20, -30); ctx.lineTo(31, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#173536'; ctx.beginPath(); ctx.arc(-23, 21, 9, 0, Math.PI * 2); ctx.arc(24, 21, 9, 0, Math.PI * 2); ctx.fill();
    } else if (shape === 'ball') {
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-18, 0, 28, -.8, .8); ctx.arc(18, 0, 28, Math.PI - .8, Math.PI + .8); ctx.stroke();
    } else if (shape === 'rocket') {
      ctx.beginPath(); ctx.moveTo(0, -45); ctx.bezierCurveTo(28, -20, 25, 17, 0, 35); ctx.bezierCurveTo(-25, 17, -28, -20, 0, -45); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dff4ff'; ctx.beginPath(); ctx.arc(0, -10, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ef624e'; ctx.beginPath(); ctx.moveTo(-9, 31); ctx.lineTo(0, 50); ctx.lineTo(9, 31); ctx.fill();
    } else if (shape === 'bug') {
      ctx.globalAlpha = .55; ctx.beginPath(); ctx.ellipse(-23, -4, 22, 30, -.45, 0, Math.PI * 2); ctx.ellipse(23, -4, 22, 30, .45, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.ellipse(0, 2, 17, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-15, -44); ctx.moveTo(6, -30); ctx.lineTo(15, -44); ctx.stroke();
    } else if (shape === 'heart') {
      ctx.beginPath(); ctx.moveTo(0, 36); ctx.bezierCurveTo(-10, 23, -40, 5, -35, -18); ctx.bezierCurveTo(-31, -38, -7, -42, 0, -24); ctx.bezierCurveTo(7, -42, 31, -38, 35, -18); ctx.bezierCurveTo(40, 5, 10, 23, 0, 36); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (shape === 'star') {
      ctx.beginPath();
      for (let index = 0; index < 10; index += 1) { const radius = index % 2 ? 16 : 38; const angle = -Math.PI / 2 + index * Math.PI / 5; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, 29, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-23, -19); ctx.lineTo(-18, -43); ctx.lineTo(-5, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23, -19); ctx.lineTo(18, -43); ctx.lineTo(5, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#173536'; ctx.beginPath(); ctx.arc(-10, -5, 3, 0, Math.PI * 2); ctx.arc(10, -5, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#173536'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(-5, 7); ctx.moveTo(0, 1); ctx.lineTo(5, 7); ctx.stroke();
    }
    ctx.restore();
  }

  render() {
    const ctx = this.context;
    const backgrounds = { sky: ['#dff4ff', '#f4f1cf'], mint: ['#d9f6e5', '#f7ffe7'], sunset: ['#ffd9b0', '#f49ba5'], night: ['#182a55', '#3a4072'], candy: ['#f9d8ec', '#d8edff'], paper: ['#ffffff', '#eef0e9'] };
    const colors = backgrounds[this.getProject().background] || backgrounds.sky;
    const gradient = ctx.createLinearGradient(0, 0, 0, 360);
    gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 480, 360);
    const sprites = (this.getProject().sprites || []).slice(0, 8);
    sprites.forEach((sprite) => { if (sprite.visible !== false) this.drawCharacter(ctx, sprite); });
    if (this.message && sprites[0]) {
      const sprite = sprites[0];
      ctx.font = 'bold 15px sans-serif';
      const width = Math.min(230, ctx.measureText(this.message).width + 24);
      const x = clamp(240 + sprite.x + 28, 8, 480 - width - 8);
      const y = clamp(180 - sprite.y - 70, 8, 315);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#566'; ctx.lineWidth = 2;
      ctx.fillRect(x, y, width, 42); ctx.strokeRect(x, y, width, 42);
      ctx.fillStyle = '#173536'; ctx.fillText(this.message.slice(0, 26), x + 12, y + 26);
    }
  }

  getAPI() {
    return {
      move: this.move.bind(this), right: this.turn.bind(this), left: (value) => this.turn(-value), goto: this.goto.bind(this), glide: this.goto.bind(this), bounce: this.bounce.bind(this),
      pointTo: (target) => { const sprite = this.sprite(); if (!sprite) return; const point = target === 'mouse' ? this.mouse : { x: 0, y: 0 }; sprite.dir = Math.atan2(point.y - sprite.y, point.x - sprite.x) * 180 / Math.PI; this.changedAt = performance.now(); },
      x: () => this.sprite() ? this.sprite().x : 0, y: () => this.sprite() ? this.sprite().y : 0,
      say: (text) => { this.message = String(text); this.changedAt = performance.now(); }, show: () => { if (this.sprite()) { this.sprite().visible = true; this.changedAt = performance.now(); } }, hide: () => { if (this.sprite()) { this.sprite().visible = false; this.changedAt = performance.now(); } },
      size: (value) => { if (this.sprite()) { this.sprite().size = clamp(value, 10, 300); this.changedAt = performance.now(); } }, nextCostume: () => { this.costume = this.costume ? 0 : 1; this.changedAt = performance.now(); }, color: (value) => { if (this.sprite()) { this.sprite().color = value; this.changedAt = performance.now(); } },
      edge: this.edge.bind(this), touching: this.touching.bind(this), mouseX: () => this.mouse.x, mouseY: () => this.mouse.y
    };
  }
  captureThumbnail() { return this.canvas.toDataURL('image/png'); }
}
