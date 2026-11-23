import { Stage, clamp } from './stage.js';
import { walkBlocks } from '../core/project.js';

const SENSOR_LABELS = { motion: '人感', light: '明るさ', temp: '温度', sound: '音', switch: 'スイッチ' };
const OUTPUT_LABELS = { led: '観測灯（LED）', motor: 'モーター', buzzer: 'ブザー', heater: 'ヒーター' };

// Only the moving or illuminated parts follow the electrical output.
const drawings = {
  led: `
    <g class="lamp-light">
      <circle cx="86" cy="62" r="54" fill="url(#lamp-halo)" stroke="none"/>
      <path d="M42 45l-7-4m6 20H31m12 17-8 4m95-37 7-4m-6 20h10m-12 17 8 4" stroke="var(--lamp)" stroke-width="3"/>
    </g>
    <path d="M65 36v-8a21 19 0 0 1 42 0v8" fill="none" stroke="#59726b" stroke-width="4"/>
    <path d="M69 41q-6 21-5 36 22 10 44 0 1-15-5-36z" fill="#abc6bc"/>
    <path class="lamp-light" d="M69 41q-6 21-5 36 22 10 44 0 1-15-5-36z" fill="var(--lamp)" stroke="none"/>
    <path d="M73 48l-2 18" stroke="white" stroke-opacity=".75" stroke-width="3"/>
    <path d="M62 41l5-9h38l5 9zM65 79h42l5 11H60z" fill="#3d6559"/>
    <rect x="58" y="90" width="56" height="7" rx="3" fill="#29473f"/>
    <path d="M62 42l-4 35 7 5m45-40 4 35-7 5" fill="none"/>
    <path d="M81 71v-9q5-6 10 0v9" fill="#f8edbc"/>
    <rect x="78" y="71" width="16" height="6" rx="2" fill="#526b60"/>
  `,
  motor: `
    <path d="M81 69h10l2 19 18 5v4H61v-4l18-5z" fill="#466d60"/>
    <circle cx="86" cy="46" r="35" fill="#c5dbd2" stroke-width="3"/>
    <g class="rotor" fill="#3a8170">
      <path id="fan-blade" d="M86 46c-13-5-21-17-16-22 6-7 18-6 22 0 4 6-1 16-6 22z"/>
      <use href="#fan-blade" transform="rotate(120 86 46)"/><use href="#fan-blade" transform="rotate(240 86 46)"/>
    </g>
    <circle cx="86" cy="46" r="29" stroke="#698c7e" stroke-width="1" fill="none"/>
    <circle cx="86" cy="46" r="6" fill="#ffc571"/>
    <path class="wind-lines" d="M132 34q9-4 16-1m-15 12h20m-21 11q9 4 16 1" fill="none" stroke="#4a887f"/>
  `,
  buzzer: `
    <path d="M64 82h39l6 11H58z" fill="#416656"/>
    <path d="M55 41h24l24-14v51L79 65H55z" fill="#ecb86b"/>
    <path d="M55 41h13v24H55z" fill="#507466"/>
    <ellipse cx="103" cy="52" rx="9" ry="26" fill="#344f47"/><ellipse cx="103" cy="52" rx="3" ry="11" fill="#e0ad65"/>
    <path class="sound-waves" d="M120 42q8 10 0 20m7-27q14 17 0 34m7-42q20 25 0 50" fill="none" stroke="#458176" stroke-width="3"/>
  `,
  heater: `
    <path d="M59 89v7m55-7v7" stroke-width="5"/>
    <rect x="49" y="43" width="75" height="46" rx="8" fill="#547468"/>
    <rect x="56" y="50" width="61" height="29" rx="3" fill="#253f38"/>
    <path class="heating-coil" d="M61 67q4-23 8-4t8 0 8 0 8 0 8 0 8 0" fill="none" stroke-width="4"/>
    <path class="heat-waves" d="M69 35q-5-5 0-11t0-11m17 22q-5-5 0-11t0-11m17 22q-5-5 0-11t0-11" fill="none" stroke="#c76a3e"/>
  `
};

function outputIllustration(key) {
  const card = document.createElement('div');
  card.className = 'output-item';
  card.dataset.output = key;
  card.innerHTML = `<svg class="device-art" viewBox="0 0 172 106" aria-hidden="true" focusable="false">
    ${key === 'led' ? '<defs><radialGradient id="lamp-halo"><stop offset="0" stop-color="var(--lamp)" stop-opacity=".98"/><stop offset="1" stop-color="var(--lamp)" stop-opacity="0"/></radialGradient></defs>' : ''}
    <ellipse cx="86" cy="96" rx="41" ry="4" fill="#8ba79a" opacity=".3"/>
    <g stroke="#29483f" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${drawings[key]}</g>
    </svg><div class="output-caption"><strong>${OUTPUT_LABELS[key]}</strong><span class="output-value" aria-live="polite"></span></div>`;
  return card;
}

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
    this.root.innerHTML = `
      <div class="device-grid experiment">
        <div class="apparatus-rack" aria-label="プログラムで動く装置"></div>
        <section class="device-card">
          <h3>LEDがつく条件</h3>
          <div class="condition-rule"></div>
          <p class="experiment-guide"></p>
        </section>
        <section class="device-card">
          <h3>まわりの様子を変える</h3>
          <div class="scene-options">
            <button type="button" data-light="20">木かげ（暗い）</button>
            <button type="button" data-light="70">日なた（明るい）</button>
            <button type="button" data-sensor="motion" aria-label="人がいる" aria-pressed="false">人はいない</button>
          </div>
          <div class="main-sensors"></div>
        </section>
        <details class="device-card">
          <summary>ほかのセンサーと装置</summary>
          <div class="sensor-list"></div>
          <div class="device-actions"><button type="button" data-auto aria-pressed="false">センサーを自動で変える</button></div>
          <div class="output-grid"></div>
        </details>
        <details class="device-card">
          <summary>電気の使用時間を記録</summary>
          <div class="device-meter">
            <strong class="use-time"></strong><output class="energy-score"></output>
            <div class="energy-bar"><span></span></div>
            <button type="button" data-record>きろくする</button>
            <button type="button" data-copy>CSVをコピー</button><div class="record-list"></div>
          </div>
        </details>
      </div>`;
    const find = selector => this.root.querySelector(selector);
    this.ruleBox = find('.condition-rule');
    this.guide = find('.experiment-guide');
    this.autoButton = find('[data-auto]');
    this.autoButton.onclick = () => { this.auto = !this.auto; this.syncSensors(); };
    for (const button of this.root.querySelectorAll('[data-light]')) {
      button.onclick = () => this.changeSensor('light', Number(button.dataset.light));
    }
    this.inputs = { motion: find('[data-sensor="motion"]') };
    this.inputs.motion.onclick = () => this.changeSensor('motion', this.sensorOn('motion') ? 0 : 100);
    for (const key of ['light','temp','sound','switch']) {
      const row = document.createElement('label');
      row.className = 'sensor-row';
      const label = document.createElement('span');
      label.textContent = SENSOR_LABELS[key];
      const input = document.createElement(key === 'switch' ? 'button' : 'input');
      input.dataset.sensor = key;
      input.setAttribute('aria-label', SENSOR_LABELS[key]);
      if (key === 'switch') {
        input.type = 'button';
        input.onclick = () => this.changeSensor(key, this.sensorOn(key) ? 0 : 100);
      } else {
        input.type = 'range'; input.min = '0'; input.max = key === 'temp' ? '40' : '100';
        input.oninput = () => this.changeSensor(key, Number(input.value));
      }
      this.inputs[key] = input;
      row.append(label, input, document.createElement('output'));
      find('.sensor-list').appendChild(row);
    }
    this.apparatus = {};
    for (const key of Object.keys(OUTPUT_LABELS)) {
      const item = outputIllustration(key);
      this.apparatus[key] = item;
      find(key === 'led' ? '.apparatus-rack' : '.output-grid').appendChild(item);
    }
    find('[data-record]').onclick = () => this.record();
    find('[data-copy]').onclick = event => this.copyRecords(event.currentTarget);
    this.syncSensors();
    this.render();
  }

  changeSensor(key, value) {
    this.auto = false;
    this.sensors[key] = value;
    this.markChanged();
    this.syncSensors();
  }

  syncSensors() {
    this.autoButton.setAttribute('aria-pressed', String(this.auto));
    for (const button of this.root.querySelectorAll('[data-light]')) button.setAttribute('aria-pressed', String(this.sensors.light === Number(button.dataset.light)));
    for (const [key, input] of Object.entries(this.inputs)) {
      const value = this.sensor(key);
      if (key === 'motion' || key === 'switch') {
        const on = this.sensorOn(key);
        input.setAttribute('aria-pressed', String(on));
        input.textContent = key === 'motion' ? (on ? '人がいる' : '人はいない') : (on ? 'オン' : 'オフ');
      } else input.value = value;
      if (key !== 'motion') input.nextElementSibling.textContent = String(value);
    }
  }

  setProgram(project, running, onChange) {
    const outputs = new Set(), sensors = new Set();
    walkBlocks(project, block => {
      if (block.type === 'device_led_color') outputs.add('led');
      if (block.type === 'device_out_set' || block.type === 'device_out_power') {
        if (block.inputs?.OUTPUT) Object.keys(OUTPUT_LABELS).forEach(key => outputs.add(key));
        else outputs.add(block.fields.OUTPUT);
      }
      if (block.type === 'device_sensor' || block.type === 'device_sensor_on') sensors.add(block.fields.SENSOR);
    });
    if (!outputs.size) { outputs.add('led'); outputs.add('motor'); }
    for (const [key, item] of Object.entries(this.apparatus)) {
      const shelf = this.root.querySelector(outputs.has(key) ? '.apparatus-rack' : '.output-grid');
      if (item.parentNode !== shelf) shelf.appendChild(item);
    }
    for (const key of ['light', 'temp', 'sound', 'switch']) {
      const row = this.inputs[key].parentNode;
      const shelf = this.root.querySelector(sensors.has(key) && key !== 'light' ? '.main-sensors' : '.sensor-list');
      if (row.parentNode !== shelf) shelf.appendChild(row);
    }
    // Keep the light and occupancy controls together for experimenting with LED rules.
    this.root.querySelector('.scene-options').hidden = sensors.size > 0 && !sensors.has('light') && !sensors.has('motion') && !outputs.has('led');
    // Show an editable rule only when this single loop describes the complete LED program.
    const blocks = project.scripts.length === 1 ? project.scripts[0].blocks : [];
    const loop = blocks[1];
    const branch = blocks.length === 2 && blocks[0].type === 'event_start' && loop?.type === 'control_forever' && loop.body?.length === 1 ? loop.body[0] : null;
    const setsLed = (body, value) => body?.length === 1 && body[0].type === 'device_out_set' &&
      body[0].fields.OUTPUT === 'led' && Number(body[0].fields.STATE) === value && !Object.values(body[0].inputs || {}).some(Boolean);
    const condition = branch?.type === 'control_if_else' && setsLed(branch.body, 1) && setsLed(branch.body2, 0) ? branch.inputs.COND : null;
    const members = condition?.type === 'op_and' ? [condition.inputs.A, condition.inputs.B] : [condition];
    const labels = { light: '暗い（明るさ35未満）', motion: '人がいる', temp: '28度以上', sound: '音が55以上', switch: 'スイッチがオン' };
    this.ruleMembers = members.every(item => item?.type === 'device_sensor_on' && Object.hasOwn(labels, item.fields.SENSOR) && !item.inputs?.SENSOR) ? members : [];
    this.onConditionChange = onChange;
    this.ruleBox.parentElement.hidden = !this.ruleMembers.length;
    const signature = this.ruleMembers.map(item => item.fields.SENSOR).join(',');
    if (this.ruleSignature !== signature) {
      this.ruleSignature = signature;
      this.ruleBox.replaceChildren();
      this.ruleMembers.forEach((item, index) => {
        if (index) this.ruleBox.append('かつ');
        const select = document.createElement('select'); select.setAttribute('aria-label', 'LEDがつく条件 ' + (index + 1));
        for (const [key, label] of Object.entries(labels)) select.add(new Option(label, key));
        select.value = item.fields.SENSOR;
        select.onchange = () => {
          this.ruleMembers[index].fields.SENSOR = select.value;
          this.onConditionChange();
        };
        this.ruleBox.appendChild(select);
      });
      if (this.ruleMembers.length) this.ruleBox.append('なら点灯。それ以外は消灯。');
      else this.ruleBox.textContent = 'プログラムのブロックで装置を動かそう。';
    }
    this.ruleBox.querySelectorAll('select').forEach(select => { select.disabled = running; });
    this.guide.textContent = running ? '実験中。まわりの様子を変えて、LEDを見よう。' : '「うごかす」を押して、条件を試そう。';
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
    this.ledColor = '#ffd23f';
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
      this.syncSensors();
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
    Object.entries(this.apparatus).forEach(([key, item]) => {
      const power = this.outputs[key], on = power > 0;
      if (item.power === power && (key !== 'led' || item.color === this.ledColor)) return;
      item.power = power;
      item.classList.toggle('is-on', on);
      if (key === 'led') {
        item.color = this.ledColor;
        item.style.setProperty('--lamp', this.ledColor);
      }
      item.style.setProperty('--power', String(power / 100));
      if (key === 'motor' && on) item.style.setProperty('--turn-time', (2.3 - .019 * power) + 's');
      const output = item.querySelector('.output-value');
      const states = { led: ['消えている','ついている'], motor: ['止まっている','回転中'], buzzer: ['止まっている','オン'], heater: ['切れている','加熱中'] };
      const value = states[key][Number(on)] + (on && (key !== 'led' || power < 100) ? ' ' + Math.round(power) + '%' : '');
      if (output.textContent !== value) output.textContent = value;
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
