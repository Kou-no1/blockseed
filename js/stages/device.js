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
    this.root.innerHTML = `
      <div class="device-grid experiment">
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
          <div class="led-readout output-item" data-output="led">
            <span class="output-icon" aria-hidden="true">●</span><strong>観測灯（LED）</strong>
            <span class="output-value" aria-live="polite">消えている</span>
          </div>
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
    for (const [key, icon] of [['motor','⚙'], ['buzzer','♪'], ['heater','♨']]) {
      const item = document.createElement('div'); item.className = 'output-item'; item.dataset.output = key;
      item.innerHTML = '<span aria-hidden="true" class="output-icon">' + icon + '</span><strong>' + OUTPUT_LABELS[key] + '</strong><span class="output-value"></span>';
      find('.output-grid').appendChild(item);
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
    const stage = this;
    Object.keys(this.outputs).forEach(function (key) {
      const item = stage.root.querySelector('[data-output="' + key + '"]');
      if (!item) return;
      const on = stage.outputs[key] > 0;
      item.classList.toggle('is-on', on);
      if (key === 'led') item.style.setProperty('--lamp', stage.ledColor);
      const output = item.querySelector('.output-value');
      const value = key === 'led' ? (on ? 'ついている' : '消えている') : (on ? Math.round(stage.outputs[key]) + '%' : 'オフ');
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
