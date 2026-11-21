import { Stage, clamp } from './stage.js';

const SENSOR_LABELS = { motion: '人感', light: '明るさ', temp: '温度', sound: '音', switch: 'スイッチ' };
const OUTPUT_LABELS = { led: 'LED', motor: 'モーター', buzzer: 'ブザー', heater: 'ヒーター' };

export class DeviceStage extends Stage {
  constructor(root, onRecord, audio) {
    super();
    this.root = root;
    this.onRecord = onRecord;
    this.audio = audio;
    this.sensors = { motion: 0, light: 70, temp: 22, sound: 10, switch: 0 };
    this.outputs = { led: 0, motor: 0, buzzer: 0, heater: 0 };
    this.ledColor = '#ffd23f';
    this.useSeconds = 0;
    this.energy = 0;
    this.auto = false;
    this.autoTime = 0;
    this.records = [];
    this.log = [];
    this.elapsed = 0;
    this.lastSample = '';
    this.changedAt = performance.now();
    this.build();
  }

  build() {
    const stage = this;
    this.root.textContent = '';
    const controls = document.createElement('div'); controls.className = 'device-grid';
    const sensors = document.createElement('section'); sensors.className = 'device-card';
    const sensorTitle = document.createElement('h3'); sensorTitle.textContent = 'センサー（入力）'; sensors.appendChild(sensorTitle);
    Object.keys(this.sensors).forEach(function (key) {
      const row = document.createElement('label'); row.className = 'sensor-row';
      const name = document.createElement('span'); name.textContent = SENSOR_LABELS[key];
      const input = document.createElement(key === 'motion' || key === 'switch' ? 'button' : 'input'); input.dataset.sensor = key;
      if (input.tagName === 'INPUT') { input.type = 'range'; input.min = '0'; input.max = key === 'temp' ? '40' : '100'; input.value = stage.sensors[key]; }
      else { input.type = 'button'; input.setAttribute('aria-pressed', String(stage.sensors[key] >= 50)); input.textContent = key === 'motion' ? (stage.sensors[key] >= 50 ? '人が いる' : 'いない') : (stage.sensors[key] >= 50 ? 'ON' : 'OFF'); }
      const value = document.createElement('output'); value.textContent = String(stage.sensors[key]);
      if (input.tagName === 'INPUT') input.addEventListener('input', function () { stage.sensors[key] = Number(input.value); value.textContent = input.value; stage.markChanged(); });
      else input.addEventListener('click', function () { stage.sensors[key] = stage.sensors[key] >= 50 ? 0 : 100; const on = stage.sensors[key] >= 50; input.setAttribute('aria-pressed', String(on)); input.textContent = key === 'motion' ? (on ? '人が いる' : 'いない') : (on ? 'ON' : 'OFF'); value.textContent = String(stage.sensors[key]); stage.markChanged(); });
      row.append(name, input, value); sensors.appendChild(row);
    });
    const autoRow = document.createElement('div'); autoRow.className = 'device-actions';
    const autoButton = document.createElement('button'); autoButton.type = 'button'; autoButton.textContent = 'じどうモード'; autoButton.setAttribute('aria-pressed', 'false');
    autoButton.addEventListener('click', function () { stage.auto = !stage.auto; autoButton.setAttribute('aria-pressed', String(stage.auto)); autoButton.classList.toggle('is-active', stage.auto); });
    autoRow.appendChild(autoButton); sensors.appendChild(autoRow);
    const outputCard = document.createElement('section'); outputCard.className = 'device-card';
    const outputTitle = document.createElement('h3'); outputTitle.textContent = 'そうち（出力）'; outputCard.appendChild(outputTitle);
    const outputGrid = document.createElement('div'); outputGrid.className = 'output-grid';
    Object.keys(this.outputs).forEach(function (key) {
      const item = document.createElement('div'); item.className = 'output-item'; item.dataset.output = key;
      const icon = document.createElement('span'); icon.className = 'output-icon'; icon.textContent = key === 'led' ? '●' : key === 'motor' ? '⚙' : key === 'buzzer' ? '♪' : '♨';
      const name = document.createElement('strong'); name.textContent = OUTPUT_LABELS[key];
      const value = document.createElement('span'); value.className = 'output-value'; value.textContent = 'オフ';
      item.append(icon, name, value); outputGrid.appendChild(item);
    });
    outputCard.appendChild(outputGrid);
    const meter = document.createElement('section'); meter.className = 'device-card device-meter';
    const meterTitle = document.createElement('h3'); meterTitle.textContent = 'でんきの つかいかた'; meter.appendChild(meterTitle);
    const use = document.createElement('strong'); use.className = 'use-time'; use.textContent = '0.0 びょう'; meter.appendChild(use);
    const score = document.createElement('output'); score.className = 'energy-score'; score.textContent = '省エネ度 100%'; meter.appendChild(score);
    const bar = document.createElement('div'); bar.className = 'energy-bar'; const fill = document.createElement('span'); bar.appendChild(fill); meter.appendChild(bar);
    const recordButton = document.createElement('button'); recordButton.type = 'button'; recordButton.textContent = 'きろくする';
    recordButton.addEventListener('click', function () { stage.record(); }); meter.appendChild(recordButton);
    const copyButton = document.createElement('button'); copyButton.type = 'button'; copyButton.textContent = 'CSVを コピー'; copyButton.addEventListener('click', function () { stage.copyRecords(copyButton); }); meter.appendChild(copyButton);
    const recordList = document.createElement('div'); recordList.className = 'record-list'; meter.appendChild(recordList);
    controls.append(sensors, outputCard, meter); this.root.appendChild(controls);
    this.render();
  }

  markChanged() { this.changedAt = performance.now(); }
  cancelPending() {
    Object.keys(this.outputs).forEach(name => { this.outputs[name] = 0; });
    this.markChanged();
  }
  clearRecords() {
    this.records = [];
    this.log = [];
    this.lastSample = '';
    this.render();
  }
  reset() {
    this.outputs = { led: 0, motor: 0, buzzer: 0, heater: 0 };
    this.useSeconds = 0;
    this.energy = 0;
    this.autoTime = 0;
    this.elapsed = 0;
    this.log = [];
    this.lastSample = '';
    this.markChanged();
    this.render();
  }

  tick(deltaSeconds) {
    const dt = Math.min(.1, Math.max(0, Number(deltaSeconds) || 0));
    this.elapsed += dt;
    if (this.auto) {
      this.autoTime += dt;
      const cycle = this.autoTime % 20;
      this.sensors.light = Math.round(50 + Math.cos(cycle / 20 * Math.PI * 2) * 48);
      this.sensors.motion = cycle > 4 && cycle < 8 || cycle > 13 && cycle < 15 ? 100 : 0;
      const light = this.root.querySelector('[data-sensor="light"]'); const motion = this.root.querySelector('[data-sensor="motion"]');
      if (light) { light.value = this.sensors.light; light.nextElementSibling.textContent = this.sensors.light; }
      if (motion) { motion.value = this.sensors.motion; motion.setAttribute('aria-pressed', String(this.sensors.motion >= 50)); motion.textContent = this.sensors.motion >= 50 ? '人が いる' : 'いない'; motion.nextElementSibling.textContent = this.sensors.motion; }
      this.markChanged();
    }
    const totalPower = Object.values(this.outputs).reduce(function (sum, power) { return sum + clamp(power, 0, 100) / 100; }, 0);
    if (totalPower > 0) { this.useSeconds += dt; this.markChanged(); }
    this.energy += totalPower * dt;
  }

  snapshotLog() {
    const signature = Object.values(this.sensors).concat(Object.values(this.outputs)).join(',');
    if (signature === this.lastSample) return;
    this.lastSample = signature;
    this.log.push({ time: this.elapsed, sensors: { ...this.sensors }, outputs: { ...this.outputs } });
    if (this.log.length > 2000) this.log.shift();
    if (this.onRecord) this.onRecord();
  }

  setOutput(name, value) { this.setPower(name, value ? 100 : 0); }

  setPower(name, value) {
    if (!Object.hasOwn(this.outputs, name)) return;
    const next = clamp(value, 0, 100);
    if (this.outputs[name] !== next) {
      this.outputs[name] = next;
      if (name === 'buzzer' && next > 0 && this.audio) this.audio.tone(67, .12, 'square');
      this.markChanged();
    }
    this.snapshotLog();
  }
  sensor(name) { return Number(this.sensors[name]) || 0; }
  sensorOn(name) {
    const value = this.sensor(name);
    if (name === 'motion' || name === 'switch') return value >= 50;
    if (name === 'light') return value < 35;
    if (name === 'temp') return value >= 28;
    return value >= 55;
  }

  record() {
    const entry = { at: new Date().toLocaleTimeString('ja-JP'), seconds: Number(this.useSeconds.toFixed(1)), energy: Number(this.energy.toFixed(2)) };
    this.records.push(entry);
    if (this.onRecord) this.onRecord(entry, this.records.slice());
    this.render();
  }

  copyRecords(button) {
    const csv = ['時刻,使用時間（秒）,使用量'].concat(this.records.map(function (entry) { return entry.at + ',' + entry.seconds + ',' + entry.energy; })).join('\n');
    const done = function () { const old = button.textContent; button.textContent = 'コピーしたよ'; setTimeout(function () { button.textContent = old; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(csv).then(done).catch(function () {});
  }

  render() {
    const stage = this;
    Object.keys(this.outputs).forEach(function (key) {
      const item = stage.root.querySelector('[data-output="' + key + '"]');
      if (!item) return;
      const on = stage.outputs[key] > 0;
      item.classList.toggle('is-on', on);
      if (key === 'led') item.style.setProperty('--lamp', stage.ledColor);
      item.querySelector('.output-value').textContent = on ? Math.round(stage.outputs[key]) + '%' : 'オフ';
    });
    const use = this.root.querySelector('.use-time'); if (use) use.textContent = this.useSeconds.toFixed(1) + ' びょう';
    const score = this.root.querySelector('.energy-score'); if (score) score.textContent = '省エネ度 ' + Math.max(0, Math.round(100 - this.energy / 30 * 100)) + '%';
    const fill = this.root.querySelector('.energy-bar span'); if (fill) fill.style.width = Math.min(100, this.energy / 30 * 100) + '%';
    const list = this.root.querySelector('.record-list');
    if (list && list.dataset.count !== String(this.records.length)) {
      list.dataset.count = String(this.records.length);
      list.textContent = '';
      const first = Math.max(0, this.records.length - 4);
      this.records.slice(first).forEach((entry, index) => {
        const row = document.createElement('span');
        row.textContent = 'きろく ' + (first + index + 1) + '：' + entry.seconds.toFixed(1) + ' 秒';
        list.appendChild(row);
      });
    }
  }

  getAPI() {
    return {
      sensor: this.sensor.bind(this), sensorOn: this.sensorOn.bind(this), setOutput: this.setOutput.bind(this), setPower: this.setPower.bind(this),
      ledColor: (value) => { this.ledColor = value; this.markChanged(); }, useTime: () => this.useSeconds, resetUseTime: () => { this.useSeconds = 0; this.energy = 0; }
    };
  }
}
