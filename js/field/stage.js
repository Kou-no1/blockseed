import { Stage } from '../stages/stage.js';
import { worlds } from './worlds.js';

function readCommands(entries, lines) {
  const commands = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    // The slot identifies the command even when two commands accept the same value.
    const match = /^(\d+):(.*)$/.exec(entry);
    if (!match) continue;
    const slot = Number(match[1]), line = lines[slot];
    if (!line) continue;
    const value = match[2];
    commands.push({slot, value: line.options.some(option => option[0] === value) ? value : ''});
  }
  return commands;
}

function commandProblem(commands, lines) {
  if (!commands.length) return '使える命令の「＋」を押して、プログラムに最初の命令を足そう。';
  for (let slot = 0; slot < lines.length; slot++) {
    if (!commands.some(command => command.slot === slot)) return '「' + lines[slot].label + '」の命令を足そう。';
    if (commands[slot]?.slot !== slot) return '「' + lines[slot].label + '」を' + (slot + 1) + '番目に移そう。';
    if (!commands[slot].value) return '「' + lines[slot].label + '」の中身をえらぼう。';
  }
  return commands.length > lines.length ? '同じ命令が2つあるよ。「はずす」で1つにしよう。' : '';
}

function commandButton(text, description, action) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = text;
  if (description) button.setAttribute('aria-label', description);
  button.addEventListener('click', action);
  return button;
}

export class FieldStage extends Stage {
  constructor(onEdit, audio, onRun) {
    super();
    this.onEdit = onEdit;
    this.audio = audio;
    this.onRun = onRun;
    this.canvas = document.getElementById('field-canvas');
    this.context = this.canvas.getContext('2d');
    this.lines = document.getElementById('field-lines');
    this.tools = document.getElementById('field-tools');
    this.note = document.getElementById('field-state');
    this.trial = document.getElementById('field-trial');
    this.canvas.addEventListener('click', event => {
      if (this.busy || !this.world?.tap) return;
      const box = this.canvas.getBoundingClientRect();
      const input = this.world.tap(this.state, (event.clientX-box.left)*480/box.width, (event.clientY-box.top)*270/box.height, this.rank, this.input);
      if (input !== undefined) this.changeInput(input);
    });
  }

  configure(project, mission) {
    const world = worlds.get(mission.area);
    if (!world) return false;
    const lesson = world.lessons[mission.rank - 1];
    this.project = project;
    const blank = project.buildFromBlank === true;
    const signature = JSON.stringify([project.id, mission.id, blank, project.fieldProgram]);
    if (signature === this.signature) return true;
    this.stop();
    const newScene = this.projectId !== project.id || this.missionId !== mission.id;
    this.projectId = project.id; this.missionId = mission.id; this.signature = signature;
    this.world = world; this.rank = mission.rank; this.lesson = lesson;
    this.blank = blank;
    if (newScene) { this.input = undefined; this.variant = 0; }
    if (blank) {
      this.commands = readCommands(project.fieldProgram, lesson.lines);
      this.program = this.commands.map(command => command.value);
      this.renderBuilder();
    } else {
      this.program = lesson.lines.map((line, i) => line.options.some(([value]) => value === project.fieldProgram?.[i])
        ? project.fieldProgram[i] : line.initial);
      this.renderGuidedLines();
    }
    this.renderTools();
    this.canvas.setAttribute('aria-label', mission.unit + 'の実験風景');
    this.reset();
    return true;
  }

  saveProgram() {
    this.project.fieldProgram = this.blank
      ? this.commands.map(command => command.slot + ':' + command.value) : this.program.slice();
    this.signature = JSON.stringify([this.project.id, this.missionId, this.blank, this.project.fieldProgram]);
    this.reset(); this.onEdit();
  }

  renderGuidedLines() {
    this.lines.replaceChildren();
    this.lesson.lines.forEach((line, i) => {
      const label = document.createElement('label');
      const caption = document.createElement('span'); caption.textContent = line.label;
      const select = document.createElement('select');
      for (const [value, name] of line.options) select.add(new Option(name, value));
      select.value = this.program[i]; select.dataset.line = String(i);
      select.addEventListener('change', () => {
        this.program[i] = select.value; this.saveProgram();
      });
      label.append(caption, select); this.lines.appendChild(label);
    });
  }

  renderBuilder() {
    const {lines} = this.lesson;
    const palette = document.createElement('div'); palette.className = 'field-command-palette';
    const partsTitle = document.createElement('h3'); partsTitle.textContent = '使える命令';
    palette.append(partsTitle);
    lines.forEach((line, slot) => {
      const add = commandButton('＋ ' + line.label, '「' + line.label + '」を足す', () => {
        this.commands.push({slot, value:''});
        this.rebuild('select[data-line="' + slot + '"]');
      });
      add.dataset.addLine = String(slot); add.disabled = this.commands.some(command => command.slot === slot);
      palette.appendChild(add);
    });
    const program = document.createElement('div'); program.className = 'field-command-program';
    const title = document.createElement('h3'); title.textContent = '組んだプログラム';
    program.appendChild(title);
    if (!this.commands.length) {
      const empty = document.createElement('p'); empty.className = 'field-command-empty';
      empty.textContent = 'まだ命令はありません。上の「＋」で命令を足そう。';
      program.appendChild(empty);
    } else {
      const list = document.createElement('ol');
      this.commands.forEach((command, index) => {
        const {slot} = command, line = lines[slot];
        const entry = document.createElement('li');
        const label = document.createElement('label'); label.textContent = line.label;
        const select = document.createElement('select'); select.dataset.line = String(slot);
        select.add(new Option('中身をえらぶ', '')); select.options[0].disabled = true;
        for (const [value, name] of line.options) select.add(new Option(name, value));
        select.value = command.value;
        select.addEventListener('change', () => {
          command.value = select.value; this.program[index] = select.value; this.saveProgram();
        });
        label.appendChild(select); entry.appendChild(label);
        const actions = document.createElement('div'); actions.className = 'field-command-actions';
        if (lines.length > 1) for (const [direction, offset] of [['上へ', -1], ['下へ', 1]]) {
          const target = index + offset;
          const move = commandButton(direction, '「' + line.label + '」を' + direction, () => {
            this.commands.splice(index, 1); this.commands.splice(target, 0, command);
            this.rebuild('select[data-line="' + slot + '"]');
          });
          move.dataset.move = offset < 0 ? 'up' : 'down';
          move.disabled = target < 0 || target >= this.commands.length;
          actions.appendChild(move);
        }
        const remove = commandButton('はずす', '「' + line.label + '」をはずす', () => {
          this.commands.splice(index, 1); this.rebuild('[data-add-line="' + slot + '"]');
        });
        remove.dataset.removeLine = String(slot); actions.appendChild(remove);
        entry.appendChild(actions); list.appendChild(entry);
      });
      program.appendChild(list);
    }
    this.lines.replaceChildren(palette, program);
  }

  rebuild(focusSelector) {
    this.program = this.commands.map(command => command.value);
    this.renderBuilder(); this.saveProgram();
    this.lines.querySelector(focusSelector)?.focus();
  }

  renderTools() {
    const world = this.world;
    this.tools.replaceChildren();
    const addButton = (label, fn) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label; button.addEventListener('click', fn);
      this.tools.appendChild(button);
    };
    for (const option of world.inputs?.(this.rank) || []) addButton(option.label, () => {
      const next = world.configure ? world.configure(option.value, this.input, this.rank) : option.value;
      if (next !== this.input && Number.isFinite(option.note)) this.audio.tone(option.note, .1, 'sine');
      this.changeInput(next);
    });
    const trigger = world.triggerLabel?.(this.rank);
    if (trigger) addButton(trigger, this.onRun);
    if (this.rank === 3) addButton('場面をかえる', () => { this.variant = 1 - this.variant; this.changeInput(undefined); });
    this.tools.hidden = !this.tools.childElementCount;
  }

  changeInput(input) {
    if (this.busy) return;
    this.input = input; this.reset();
    this.onEdit(false);
  }

  setTrial(variant, input) {
    this.currentVariant = variant;
    this.state = this.world.create(this.rank, variant, input);
    this.runInput = input;
    this.stepCount = 0;
    this.draw(1); this.describe();
  }

  reset() {
    this.stop();
    this.completed = false; this.firstPassed = false; this.attempted = false;
    if (this.world) this.setTrial(this.variant, this.input);
  }

  stop() {
    cancelAnimationFrame(this.frame);
    this.busy = false;
    this.setLocked(false);
  }

  setLocked(locked) {
    this.lines.disabled = locked; this.tools.disabled = locked;
  }

  draw(phase) {
    const ctx = this.context;
    ctx.save(); ctx.setTransform(2,0,0,2,0,0); ctx.clearRect(0,0,480,270);
    this.world.draw(ctx, this.state, this.rank, phase);
    ctx.restore();
  }

  render() { if (this.world && this.state) this.draw(1); }

  describe() {
    const input = this.world.inputLabel?.(this.runInput, this.rank);
    this.note.textContent = this.world.status(this.state, this.rank);
    this.trial.hidden = this.rank < 3 && !input;
    this.trial.textContent = (this.rank === 3 ? ['場面 A','場面 B'][this.currentVariant] : '') + (input ? '　' + input : '') +
      (this.rank === 3 ? '　試せた場面 ' + (this.completed && this.firstPassed ? 2 : this.firstPassed ? 1 : 0) + ' / 2' : '');
  }

  results() {
    if (!this.world) return [];
    const checks = this.world.checks(this.state, this.rank);
    const rows = this.lesson.criteria.map((label, i) => ({label, passed: this.attempted && Boolean(checks[i])}));
    if (this.blank) rows.unshift({label: '命令をそろえて順番に組んだ', passed: !commandProblem(this.commands, this.lesson.lines)});
    if (this.rank === 3) rows.push({label:'同じプログラムで 2つの場面をクリア', passed:this.firstPassed && this.completed && rows.every(row => row.passed)});
    return rows;
  }

  run(stepsPerFrame, onProgress, done) {
    this.reset();
    if (this.blank) {
      const problem = commandProblem(this.commands, this.lesson.lines);
      if (problem) { this.note.textContent = problem; onProgress(); done(false); return; }
    }
    this.busy = true; this.attempted = true; this.setLocked(true);
    const duration = stepsPerFrame <= 1 ? 500 : stepsPerFrame <= 20 ? 260 : 130;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const startStep = now => {
      this.world.step(this.state, this.program, this.rank, this.currentVariant, this.runInput);
      this.stepCount++;
      const note = this.world.sound?.(this.state, this.rank);
      if (Number.isFinite(note)) this.audio.tone(note, .12, 'sine');
      this.describe(); onProgress();
      const animate = time => {
        const t = Math.min(1, (time - now) / duration);
        this.draw(reduce ? 1 : t);
        if (t < 1) { this.frame = requestAnimationFrame(animate); return; }
        if (!this.world.finished(this.state, this.rank) && this.stepCount < 30) {
          this.frame = requestAnimationFrame(startStep); return;
        }
        const passed = this.world.finished(this.state, this.rank) && this.world.checks(this.state, this.rank).every(Boolean);
        if (passed && this.rank === 3 && !this.firstPassed) {
          this.firstPassed = true; this.describe(); onProgress();
          const next = stamp => {
            if (stamp < time + 700) { this.frame = requestAnimationFrame(next); return; }
            this.setTrial(1 - this.variant, undefined);
            this.frame = requestAnimationFrame(startStep);
          };
          this.frame = requestAnimationFrame(next);
        } else {
          this.completed = passed; this.busy = false; this.setLocked(false); this.describe(); done();
        }
      };
      this.frame = requestAnimationFrame(animate);
    };
    this.frame = requestAnimationFrame(startStep);
  }

  captureThumbnail() { return this.canvas.toDataURL('image/png'); }
}
