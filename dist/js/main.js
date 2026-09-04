import { createProject, createBlock, clone, makeId, normalizeProject } from './core/project.js';
import { ProjectStore, autosave } from './core/store.js';
import { History } from './core/history.js';
import { decodeProject, downloadProject, encodeProject, readProjectFile } from './core/share.js';
import { friendlyError } from './core/errors.js';
import { allDefinitions, getDefinition } from './blocks/registry.js';
import { Palette } from './ui/palette.js';
import { ScriptCanvas } from './ui/canvas.js';
import { DragController } from './ui/drag.js';
import { DialogManager } from './ui/dialogs.js';
import { Toolbar } from './ui/toolbar.js';
import { renderBlock } from './ui/blockview.js';
import { LEVELS, UI } from './ui/labels.js';
import { TurtleStage } from './stages/turtle.js';
import { SpriteStage } from './stages/sprite.js';
import { DeviceStage } from './stages/device.js';
import { Interpreter } from './runtime/interpreter.js';
import { Scheduler } from './runtime/scheduler.js';
import { jsToBlocks, projectToJS } from './runtime/tojs.js';
import { getMission, listMissions, missionProjectData, evaluateMission } from './missions/missions.js';
import { Synth } from './audio/synth.js';

const params = new URLSearchParams(location.search);
const levelFromURL = Number(params.get('level'));
const levelLocked = params.get('lock') === '1';
let teacherMode = params.get('teacher') === '1';
let easyMode = params.get('easy') === '1';
const store = new ProjectStore();
const history = new History(100);
const dialogs = new DialogManager(document.getElementById('dialog-root'));
const audio = new Synth();
const keys = new Set();
let project = createProject({ level: levelFromURL || store.level || 1 });
let currentMission = getMission('intro_square');
let customMission = null;
let allowedBlocks = null;
let scheduler = null;
let interpreter = null;
let running = false;
let successPlayed = false;
let stuckDialogOpen = false;

const turtleStage = new TurtleStage(document.getElementById('pen-canvas'), document.getElementById('actor-canvas'));
const spriteStage = new SpriteStage(document.getElementById('sprite-canvas'), function () { return project; });
const deviceStage = new DeviceStage(document.getElementById('device-stage'), function () { updateMissionProgress(); }, audio);
const stages = { turtle: turtleStage, sprite: spriteStage, device: deviceStage };
const spriteShapes = ['cat', 'robot', 'car', 'ball', 'rocket', 'bug', 'heart', 'star'];
const spriteBackgrounds = ['sky', 'mint', 'sunset', 'night', 'candy', 'paper'];

function activeStage() { return stages[project.stage] || turtleStage; }
function rubyEnabled() { return project.level === 3 || (project.level >= 4 && localStorage.getItem('bs.ruby') !== '0'); }

function toast(message, error) {
  const region = document.getElementById('toast-region');
  const item = document.createElement('div');
  item.className = 'toast' + (error ? ' toast--error' : '');
  item.textContent = message;
  region.appendChild(item);
  setTimeout(function () { item.remove(); }, error ? 5200 : 2600);
}

function copyText(value) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(value);
  const area = document.createElement('textarea');
  area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select();
  const copied = document.execCommand('copy'); area.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error('copy'));
}

function renderLevel() {
  for (let level = 1; level <= 5; level += 1) document.body.classList.remove('level-' + level);
  document.body.classList.add('level-' + project.level);
  if (levelLocked) document.getElementById('level-btn').title = 'せんせいが レベルを きめています';
}

function updateStageTabs() {
  document.querySelectorAll('.stage-tab').forEach(function (button) {
    const active = button.dataset.stage === project.stage;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.stage-view').forEach(function (view) { view.classList.toggle('is-active', view.id === project.stage + '-stage'); });
  document.getElementById('grid-btn').hidden = project.stage !== 'turtle';
  const firstSprite = project.sprites && project.sprites[0];
  if (firstSprite) document.getElementById('sprite-shape-select').value = firstSprite.shape || 'cat';
  document.getElementById('sprite-add-btn').textContent = '＋ キャラ ' + (project.sprites ? project.sprites.length : 0) + '/8';
}

function updateToolbar() {
  toolbar.update({ running: running, level: project.level, levelLocked: levelLocked, canUndo: history.canUndo, canRedo: history.canRedo });
}

function updateCode(force) {
  const panel = document.getElementById('code-panel');
  const editorPanel = document.getElementById('editor-panel');
  const show = project.level >= 4;
  panel.hidden = !show;
  editorPanel.classList.toggle('has-code', show);
  document.getElementById('apply-code-btn').hidden = project.level < 5;
  const area = document.getElementById('code-editor');
  if (show && (force || document.activeElement !== area)) area.value = projectToJS(project);
}

function renderMonitors(runtime) {
  const root = document.getElementById('monitors');
  root.textContent = '';
  (project.vars || []).forEach(function (item) {
    if (item.show === false) return;
    const monitor = document.createElement('span');
    monitor.className = 'monitor';
    const value = runtime && runtime.vars ? runtime.vars.get(item.id) : item.value;
    monitor.textContent = item.name + ' = ' + String(value == null ? 0 : value);
    root.appendChild(monitor);
  });
}

function renderAll() {
  renderLevel();
  document.getElementById('project-name').textContent = project.name;
  updateStageTabs();
  editor.render();
  palette.render();
  updateToolbar();
  updateCode(true);
  renderMonitors(interpreter);
  updateMissionCard();
  activeStage().render();
}

function recordChange(message) {
  history.record(project);
  updateToolbar();
  updateCode(false);
  renderMonitors(interpreter);
  if (message) toast(message);
}

function setProject(next, preserveMission) {
  stopRun(false);
  project = normalizeProject(next);
  if (levelFromURL && levelLocked) project.level = Math.max(1, Math.min(5, levelFromURL));
  history.reset(project);
  editor.selectedId = null;
  editor.runningId = null;
  interpreter = null;
  if (!preserveMission) {
    currentMission = getMission('intro_square');
    allowedBlocks = null;
  }
  activeStage().reset();
  renderAll();
}

function selectionState(state) {
  document.getElementById('move-up-btn').disabled = !state.up || running;
  document.getElementById('move-down-btn').disabled = !state.down || running;
  document.getElementById('delete-btn').disabled = !state.selected || running;
  const insert = document.getElementById('insert-mode');
  insert.hidden = !state.cShape || project.level > 2;
  insert.querySelectorAll('button').forEach(function (button) { button.classList.toggle('is-active', button.dataset.insert === editor.insertMode); });
}

const editor = new ScriptCanvas(document.getElementById('script-canvas'), {
  getProject: function () { return project; },
  rubyEnabled: rubyEnabled,
  onChange: recordChange,
  onSelect: function () {},
  onSelectionState: selectionState,
  toast: toast,
  confirmAllDeletes: function () { return easyMode; },
  confirmDelete: function () { return dialogs.askYesNo('ブロックを けす？', 'もどす ボタンで もとに もどせるよ。', true); }
});

const palette = new Palette(document.getElementById('category-tabs'), document.getElementById('palette'), document.getElementById('palette-search'), {
  getState: function () { return { level: project.level, stage: project.stage, project: project, rubyEnabled: rubyEnabled(), allowedBlocks: allowedBlocks }; },
  onAdd: function (type) { if (!running) editor.addType(type); },
  onCreate: createNamedItem
});

const toolbar = new Toolbar({ onRun: runProject, onStop: function () { stopRun(true); }, onLevel: showLevelDialog, onUndo: undo, onRedo: redo });

new DragController(document.getElementById('drag-layer'), {
  onAdd: function (type, targetId) { if (!running) editor.addType(type, targetId); },
  onMove: function (sourceId, targetId) { if (!running) editor.moveBefore(sourceId, targetId); },
  onDelete: function (id) { if (!running) editor.deleteSelected(id); },
  onSnap: function () { audio.click(); }
});

function makeScheduler() {
  const stage = activeStage();
  interpreter = new Interpreter({
    project: project, stage: stage, stageName: project.stage, audio: audio, keys: keys,
    motionDuration: function () { return toolbar.stepsPerFrame <= 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 0; },
    ask: function (question) { return dialogs.ask('しつもん', question, ''); },
    warn: function (code, blockId) {
      const block = document.querySelector('.blk[data-id="' + blockId + '"]');
      if (block) { block.classList.add('is-error'); setTimeout(function () { block.classList.remove('is-error'); }, 1200); }
      toast(friendlyError({ code: code }, project.level), true);
    }
  });
  return new Scheduler({
    project: project, interpreter: interpreter, stage: stage, audio: audio,
    stepsPerFrame: function () { return toolbar.stepsPerFrame; },
    onHighlight: function (id) { editor.setRunning(id); },
    onState: function (value) { running = value; updateToolbar(); },
    onMonitors: renderMonitors,
    onDone: function () { running = false; updateToolbar(); updateMissionProgress(); if (!scheduler || !scheduler.running) toast(UI.complete); },
    onStuck: async function () {
      if (!running || stuckDialogOpen || dialogs.active) return;
      stuckDialogOpen = true;
      const shouldStop = await dialogs.show({
        title: 'うごきが とまって いるみたい',
        message: 'このまま つづけますか？ ずっとブロックは、じぶんで とめるまで うごきます。',
        buttons: [{ label: 'つづける', value: false }, { label: 'とめる', value: true, danger: true }]
      });
      stuckDialogOpen = false;
      if (shouldStop && running) stopRun(true);
      else if (running) activeStage().changedAt = performance.now();
    },
    onError: function (error) {
      const id = error && error.blockId;
      const block = id ? document.querySelector('.blk[data-id="' + id + '"]') : null;
      if (block) block.classList.add('is-error');
      toast(friendlyError(error, project.level), true);
    }
  });
}

function runProject() {
  if (running) return;
  successPlayed = false;
  activeStage().reset();
  scheduler = makeScheduler();
  scheduler.start('event_start');
  toast(UI.running);
}

function triggerProjectEvent(type, detail) {
  if (!scheduler || !scheduler.running) {
    const next = makeScheduler();
    if (!next.matching(type, detail).length) return;
    scheduler = next;
  }
  scheduler.trigger(type, detail);
}

function stopRun(showMessage) {
  if (scheduler) scheduler.stop();
  scheduler = null; running = false; editor.setRunning(null); updateToolbar();
  if (project.stage === 'device') { Object.keys(deviceStage.outputs).forEach(function (name) { deviceStage.outputs[name] = 0; }); deviceStage.render(); }
  updateMissionProgress();
  if (showMessage) toast(UI.stopped);
}

function undo() {
  if (running) return;
  const snapshot = history.undo();
  if (!snapshot) return;
  project = snapshot; editor.selectedId = null; renderAll();
}

function redo() {
  if (running) return;
  const snapshot = history.redo();
  if (!snapshot) return;
  project = snapshot; editor.selectedId = null; renderAll();
}

function showLevelDialog() {
  if (levelLocked) return;
  const content = document.createElement('div'); content.className = 'dialog-list';
  Object.keys(LEVELS).forEach(function (key) {
    const level = Number(key); const button = document.createElement('button'); button.type = 'button';
    const label = document.createElement('strong'); label.textContent = LEVELS[level].button;
    const note = document.createElement('small'); note.textContent = level === 1 ? 'おおきな ブロック・タップ中心' : level === 2 ? 'もし・へんすうを つかう' : level === 3 ? '算数・理科の ブロック' : level === 4 ? '関数・リスト・JS表示' : 'JSと ブロックを いききする';
    button.append(label, note);
    button.addEventListener('click', function () {
      project.level = level; store.level = level; history.record(project); dialogs.close(true); renderAll();
    });
    content.appendChild(button);
  });
  dialogs.show({ title: 'レベルを えらぶ', message: 'いつでも かえられるよ。つくった ブロックは きえません。', content: content, buttons: [{ label: 'とじる', value: false }] });
}

async function createNamedItem(category) {
  if (running) return;
  let kind = category;
  if (category === 'data') {
    kind = await dialogs.show({ title: 'はこを つくる', message: 'かずを 1つ いれる「へんすう」と、いくつも いれる「リスト」が あります。', buttons: [{ label: 'へんすう', value: 'variable', primary: true }, { label: 'リスト', value: 'list' }, { label: 'やめる', value: null }] });
    if (!kind) return;
  }
  const title = kind === 'variable' ? 'へんすうの なまえ' : kind === 'list' ? 'リストの なまえ' : 'じぶんの ブロックの なまえ';
  const name = await dialogs.ask(title, 'みじかくて わかりやすい なまえに しよう。', kind === 'variable' ? 'かず' : kind === 'list' ? 'きろく' : 'しかく');
  if (!name) return;
  if (kind === 'variable') project.vars.push({ id: makeId('v'), name: name, value: 0, show: true });
  else if (kind === 'list') project.lists.push({ id: makeId('l'), name: name, value: [] });
  else {
    const paramsText = await dialogs.ask('ひきすうの なまえ', 'つかう かずや ことばを、カンマで くぎろう。なくても だいじょうぶ。', 'ながさ');
    const params = String(paramsText || '').split(',').map(function (item) { return item.trim(); }).filter(Boolean).slice(0, 8);
    project.funcs.push({ id: makeId('f'), name: name, params: params, body: [] });
    const definition = getDefinition('func_define'); const hat = createBlock('func_define', definition); hat.fields.NAME = name;
    hat.fields.PARAMS = params.join(', ');
    project.scripts.push({ id: makeId('s'), x: 40, y: 40, blocks: [hat] });
  }
  history.record(project); editor.selectedId = null; renderAll(); toast('「' + name + '」を つくったよ');
}

function updateMissionCard() {
  const mission = customMission || currentMission;
  document.getElementById('mission-title').textContent = mission ? mission.title : 'じゆうに つくろう';
  document.getElementById('mission-progress').textContent = mission ? mission.goal : 'ブロックを うごかしてみよう';
}

function missionResults() {
  return evaluateMission(customMission || currentMission, project, activeStage());
}

function updateMissionProgress() {
  const results = missionResults();
  if (!results.length) return;
  const done = results.filter(function (item) { return item.passed; }).length;
  document.getElementById('mission-progress').textContent = done + ' / ' + results.length + ' できた';
  if (done === results.length && !successPlayed) { successPlayed = true; audio.effect('success'); toast('ミッション クリア！'); }
}

function showMissionDialog() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const list = document.createElement('div'); list.className = 'dialog-list';
  listMissions().filter(function (mission) { return mission.level <= Math.max(project.level, 3) || teacherMode; }).forEach(function (mission) {
    const button = document.createElement('button'); button.type = 'button';
    const title = document.createElement('strong'); title.textContent = mission.title;
    const meta = document.createElement('small'); meta.textContent = mission.grade + '・' + mission.subject + '・★' + mission.level;
    button.append(title, meta);
    button.addEventListener('click', async function () {
      dialogs.close(false);
      const okay = await dialogs.askYesNo('この ミッションを はじめる？', 'いまの さくひんは じどうで ほぞんしてから きりかえるよ。');
      if (!okay) return;
      store.save(project);
      currentMission = mission; customMission = null; allowedBlocks = mission.allowedBlocks || null;
      const data = missionProjectData(mission);
      setProject(createProject(Object.assign({ author: store.author }, data)), true);
      toast('「' + mission.title + '」を はじめるよ');
    });
    list.appendChild(button);
  });
  content.appendChild(list);
  const results = missionResults();
  if (results.length) {
    const checks = document.createElement('ul'); checks.className = 'check-list';
    results.forEach(function (item) { const li = document.createElement('li'); li.className = item.passed ? 'is-done' : ''; li.textContent = (item.passed ? '✓ ' : '○ ') + item.label; checks.appendChild(li); });
    content.appendChild(checks);
  }
  dialogs.show({ title: 'ミッション', message: 'やってみたい もんだいを えらぼう。', content: content, wide: true, buttons: [{ label: 'とじる', value: false }] });
}

async function saveNow(showMessage) {
  try { store.save(project); if (showMessage) toast(UI.saved); } catch (error) { toast('ほぞん できませんでした。ファイルに ほぞんしてね。', true); }
}

function dialogSection(title) {
  const section = document.createElement('section'); section.className = 'dialog-section';
  const heading = document.createElement('h3'); heading.textContent = title; section.appendChild(heading); return section;
}

async function showSaveDialog() {
  await saveNow(false);
  const content = document.createElement('div'); content.className = 'dialog-content';
  const local = dialogSection('この たんまつ');
  const localRow = document.createElement('div'); localRow.className = 'dialog-row';
  const download = document.createElement('button'); download.type = 'button'; download.textContent = 'ファイルに ほぞん'; download.addEventListener('click', function () { downloadProject(project); });
  const open = document.createElement('button'); open.type = 'button'; open.textContent = 'ファイルを ひらく'; open.addEventListener('click', function () { document.getElementById('file-input').click(); });
  localRow.append(download, open); local.appendChild(localRow); content.appendChild(local);
  const share = dialogSection('あいことばで わたす');
  const area = document.createElement('textarea'); area.readOnly = true; area.value = 'つくっています…'; share.appendChild(area);
  const shareRow = document.createElement('div'); shareRow.className = 'dialog-row';
  const copyCode = document.createElement('button'); copyCode.type = 'button'; copyCode.textContent = 'あいことばを コピー'; copyCode.disabled = true;
  const copyURL = document.createElement('button'); copyURL.type = 'button'; copyURL.textContent = 'URLを コピー'; copyURL.disabled = true;
  shareRow.append(copyCode, copyURL); share.appendChild(shareRow); content.appendChild(share);
  encodeProject(project, true).then(function (code) {
    area.value = code; copyCode.disabled = false; copyURL.disabled = false;
    if (code.length > 1800) area.insertAdjacentText('beforebegin', 'あいことばが ながいので、ファイルがおすすめです。');
    copyCode.addEventListener('click', function () { copyText(code).then(function () { toast('あいことばを コピーしたよ'); }).catch(function () { area.select(); }); });
    copyURL.addEventListener('click', function () { const url = location.origin + location.pathname + location.search + '#p=' + code.replace(/-/g, ''); copyText(url).then(function () { toast('URLを コピーしたよ'); }).catch(function () {}); });
  }).catch(function () { area.value = 'あいことばを つくれませんでした'; });
  const previous = store.list();
  if (previous.length) {
    const saved = dialogSection('まえの さくひん'); const list = document.createElement('div'); list.className = 'dialog-list';
    previous.slice(0, 8).forEach(function (entry) {
      const button = document.createElement('button'); button.type = 'button';
      const name = document.createElement('strong'); name.textContent = entry.name;
      const meta = document.createElement('small'); meta.textContent = new Date(entry.updatedAt).toLocaleString('ja-JP'); button.append(name, meta);
      button.addEventListener('click', async function () { const okay = await dialogs.askYesNo('さくひんを きりかえる？', 'いまの さくひんは ほぞんされています。'); if (okay) { const loaded = store.load(entry.id); dialogs.close(true); if (loaded) setProject(loaded); } });
      list.appendChild(button);
    });
    saved.appendChild(list); content.appendChild(saved);
  }
  const settings = dialogSection('みやすさ と データ'); const settingsRow = document.createElement('div'); settingsRow.className = 'dialog-row';
  ['標準', '大', '特大'].forEach(function (label, index) { const button = document.createElement('button'); button.type = 'button'; button.textContent = '文字 ' + label; button.addEventListener('click', function () { document.body.classList.remove('font-large', 'font-xlarge'); if (index === 1) document.body.classList.add('font-large'); if (index === 2) document.body.classList.add('font-xlarge'); localStorage.setItem('bs.font', String(index)); }); settingsRow.appendChild(button); });
  const ruby = document.createElement('button'); ruby.type = 'button'; ruby.textContent = rubyEnabled() ? 'ルビを オフ' : 'ルビを オン'; ruby.addEventListener('click', function () { localStorage.setItem('bs.ruby', rubyEnabled() ? '0' : '1'); ruby.textContent = rubyEnabled() ? 'ルビを オフ' : 'ルビを オン'; editor.render(); palette.render(); }); settingsRow.appendChild(ruby);
  const sound = document.createElement('button'); sound.type = 'button'; sound.textContent = audio.muted ? 'おとを オン' : 'おとを オフ'; sound.addEventListener('click', function () { audio.setMuted(!audio.muted); sound.textContent = audio.muted ? 'おとを オン' : 'おとを オフ'; }); settingsRow.appendChild(sound);
  const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'この たんまつの データを ぜんぶ けす';
  clear.addEventListener('click', async function () { if (await dialogs.askYesNo('データを ぜんぶ けす？', 'さくひんと なまえが きえます。ファイルに ほぞんしたものは のこります。', true)) { store.clearAll(); dialogs.close(true); setProject(createProject({ level: 1 })); toast('この たんまつの データを けしました'); } });
  settings.append(settingsRow, clear); content.appendChild(settings);
  dialogs.show({ title: 'ほぞん・ひらく', message: '5びょうごとに じどうで ほぞんしています。たいせつな さくひんは ファイルにも のこそう。', content: content, wide: true, buttons: [{ label: 'とじる', value: false, primary: true }] });
}

function showHelp() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const steps = dialogSection('3つの ステップ');
  ['1. ひだりの ブロックを タップ', '2. まんなかで ならべる', '3. 「うごかす」を おす'].forEach(function (text) { const p = document.createElement('p'); p.textContent = text; steps.appendChild(p); });
  const tips = dialogSection('こまった とき');
  const p = document.createElement('p'); p.textContent = 'まちがえても「↶ もどす」で なおせます。ブロックは 矢印キーでも うごかせます。'; tips.appendChild(p);
  content.append(steps, tips);
  dialogs.show({ title: 'つかいかた', content: content, buttons: [{ label: 'やってみる', value: true, primary: true }] });
}

function encodeText(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value)); let binary = '';
  bytes.forEach(function (byte) { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeText(value) {
  let code = value.replace(/-/g, '+').replace(/_/g, '/'); while (code.length % 4) code += '=';
  const binary = atob(code); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function preparePrint(mode) {
  const sheet = document.getElementById('print-sheet');
  sheet.textContent = ''; sheet.hidden = mode === 'program'; document.body.dataset.printMode = mode;
  if (mode === 'cards') {
    const title = document.createElement('h1'); title.textContent = 'ブロックカード　★' + project.level; sheet.appendChild(title);
    const cards = document.createElement('div'); cards.className = 'print-cards';
    allDefinitions().filter(function (definition) { return definition.level <= project.level && (!definition.stages || definition.stages.includes(project.stage)); }).forEach(function (definition) {
      cards.appendChild(renderBlock(createBlock(definition.type, definition), { level: project.level, project: project, rubyEnabled: rubyEnabled(), palette: true, onPaletteTap: function () {}, onField: function () {}, onSelect: function () {} }));
    });
    sheet.appendChild(cards);
  } else if (mode === 'worksheet') {
    const mission = customMission || currentMission;
    const title = document.createElement('h1'); title.textContent = mission ? mission.title : project.name;
    const goal = document.createElement('p'); goal.className = 'worksheet-goal'; goal.textContent = mission ? mission.goal : 'もくひょう：';
    const name = document.createElement('p'); name.className = 'worksheet-name'; name.textContent = 'なまえ：　　　　　　　　　　　　　　　　';
    const space = document.createElement('div'); space.className = 'worksheet-space'; space.textContent = 'プログラムを かいたり、ブロックカードを はったり しよう';
    const reflection = document.createElement('div'); reflection.className = 'worksheet-reflection'; reflection.textContent = 'わかったこと・くふうしたこと';
    sheet.append(title, goal, name, space, reflection);
  }
  requestAnimationFrame(function () { window.print(); });
}

window.addEventListener('afterprint', function () { document.body.removeAttribute('data-print-mode'); document.getElementById('print-sheet').hidden = true; });

function showTeacher() {
  teacherMode = true;
  document.getElementById('teacher-btn').hidden = false;
  const content = document.createElement('div'); content.className = 'dialog-content';
  const create = dialogSection('この さくひんを かだいにする');
  const fields = {};
  [['title', 'タイトル', project.name], ['goal', 'もくひょう', 'ブロックを くみあわせて うごかそう。'], ['allowed', 'つかえるブロック（カンマ区切り・空欄は全部）', ''], ['required', 'クリアに ひつようなブロック（カンマ区切り）', '']].forEach(function (item) {
    const label = document.createElement('label'); label.className = 'dialog-field'; const span = document.createElement('span'); span.textContent = item[1]; const input = document.createElement('input'); input.className = 'dialog-input'; input.value = item[2]; label.append(span, input); create.appendChild(label); fields[item[0]] = input;
  });
  const checkLabel = document.createElement('label'); checkLabel.className = 'dialog-field'; const checkText = document.createElement('span'); checkText.textContent = 'クリアの はんてい'; const checkSelect = document.createElement('select');
  [['free', '自由（自動判定なし）'], ['blockUsage', '指定ブロックを使う'], ['turtlePath', '正多角形をかく'], ['deviceLog', '人＋暗さでLED制御'], ['finalState', '最後まで実行する']].forEach(function (item) { const option = document.createElement('option'); option.value = item[0]; option.textContent = item[1]; checkSelect.appendChild(option); });
  checkLabel.append(checkText, checkSelect); create.appendChild(checkLabel);
  const sidesLabel = document.createElement('label'); sidesLabel.className = 'dialog-field'; const sidesText = document.createElement('span'); sidesText.textContent = '正多角形の へんの数（3〜12）'; const sidesInput = document.createElement('input'); sidesInput.className = 'dialog-input'; sidesInput.type = 'number'; sidesInput.min = '3'; sidesInput.max = '12'; sidesInput.value = '4'; sidesLabel.append(sidesText, sidesInput); create.appendChild(sidesLabel);
  const easyLabel = document.createElement('label'); easyLabel.className = 'dialog-check'; const easyInput = document.createElement('input'); easyInput.type = 'checkbox'; easyInput.checked = easyMode; easyLabel.append(easyInput, document.createTextNode(' かんたんモード（けす前に かくにん）')); create.appendChild(easyLabel);
  const urlArea = document.createElement('textarea'); urlArea.readOnly = true; urlArea.placeholder = 'ここに かだいURLが できます'; create.appendChild(urlArea);
  const createRow = document.createElement('div'); createRow.className = 'dialog-row';
  const make = document.createElement('button'); make.type = 'button'; make.className = 'is-primary'; make.textContent = 'かだいURLを つくる';
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'コピー'; copy.disabled = true;
  make.addEventListener('click', function () {
    const required = fields.required.value.split(',').map(function (item) { return item.trim(); }).filter(Boolean);
    let check = { kind: checkSelect.value, required: required };
    if (check.kind === 'turtlePath') check.polygon = { sides: Math.max(3, Math.min(12, Number(sidesInput.value) || 4)), tolerance: 7, closed: true };
    if (check.kind === 'deviceLog') check.rule = 'both';
    const mission = { id: 'custom-' + Date.now(), custom: true, title: fields.title.value || 'せんせいからの かだい', goal: fields.goal.value || '', grade: 'かだい', subject: 'せんせい', level: project.level, stage: project.stage, allowedBlocks: fields.allowed.value.split(',').map(function (item) { return item.trim(); }).filter(Boolean), scripts: clone(project.scripts), sprites: clone(project.sprites), background: project.background, check: check };
    easyMode = easyInput.checked;
    const query = '?level=' + mission.level + '&lock=1' + (easyMode ? '&easy=1' : ''); urlArea.value = location.origin + location.pathname + query + '#m=' + encodeText(mission); copy.disabled = false;
  });
  copy.addEventListener('click', function () { copyText(urlArea.value).then(function () { toast('かだいURLを コピーしたよ'); }).catch(function () { urlArea.select(); }); });
  createRow.append(make, copy); create.appendChild(createRow); content.appendChild(create);
  const collect = dialogSection('あいことばを まとめる'); const codes = document.createElement('textarea'); codes.placeholder = 'ひとり 1行で あいことばを はりつける'; collect.appendChild(codes);
  const csv = document.createElement('button'); csv.type = 'button'; csv.textContent = 'CSVに まとめる';
  csv.addEventListener('click', async function () {
    const rows = [['なまえ', 'さくひん', 'レベル', 'ステージ']];
    for (const code of codes.value.split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean)) {
      try { const item = await decodeProject(code); rows.push([item.author, item.name, item.level, item.stage]); } catch (error) { rows.push(['よみこみエラー', code.slice(0, 20), '', '']); }
    }
    const body = '\ufeff' + rows.map(function (row) { return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([body], { type: 'text/csv' })); link.download = 'blockseed_collection.csv'; link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  });
  const print = document.createElement('button'); print.type = 'button'; print.textContent = 'プログラムを いんさつ'; print.addEventListener('click', function () { dialogs.close(false); preparePrint('program'); });
  const cards = document.createElement('button'); cards.type = 'button'; cards.textContent = 'ブロックカード'; cards.addEventListener('click', function () { dialogs.close(false); preparePrint('cards'); });
  const worksheet = document.createElement('button'); worksheet.type = 'button'; worksheet.textContent = 'ワークシート'; worksheet.addEventListener('click', function () { dialogs.close(false); preparePrint('worksheet'); });
  const collectRow = document.createElement('div'); collectRow.className = 'dialog-row'; collectRow.append(csv, print, cards, worksheet); collect.appendChild(collectRow); content.appendChild(collect);
  dialogs.show({ title: 'せんせいモード', message: 'いまの さくひんを そのまま かだいにして、URLで くばれます。', content: content, wide: true, buttons: [{ label: 'とじる', value: false }] });
}

function registerWebMCP() {
  const context = document.modelContext;
  if (!context || typeof context.registerTool !== 'function') return;
  const report = function (error) { console.warn('WebMCP', error); };
  try {
    Promise.resolve(context.registerTool({
      name: 'add_block_to_project', title: 'ブロックを追加', description: '現在の作品に指定したブロックを追加し、画面を更新します。',
      inputSchema: { type: 'object', properties: { blockType: { type: 'string' } }, required: ['blockType'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: function (input) { if (!input || typeof input.blockType !== 'string' || getDefinition(input.blockType).unknown) throw new Error('Unknown block type'); editor.addType(input.blockType); return { added: input.blockType, projectName: project.name }; }
    })).catch(report);
    Promise.resolve(context.registerTool({
      name: 'read_project_summary', title: '作品を確認', description: '現在開いている作品の名前、レベル、ステージ、スクリプト数を返します。',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: function () { return { name: project.name, author: project.author, level: project.level, stage: project.stage, scripts: project.scripts.length }; }
    })).catch(report);
  } catch (error) { report(error); }
}

async function loadInitial() {
  let initial = null;
  const hash = location.hash.slice(1);
  try {
    if (hash.startsWith('p=')) {
      initial = await decodeProject(hash.slice(2)); initial.id = makeId('p'); initial.createdAt = Date.now();
      toast('あいことばの さくひんを ひらいたよ');
    } else if (hash.startsWith('m=')) {
      customMission = decodeText(hash.slice(2));
      allowedBlocks = customMission.allowedBlocks && customMission.allowedBlocks.length ? customMission.allowedBlocks : null;
      initial = createProject({ name: customMission.title, level: customMission.level, stage: customMission.stage, author: store.author, scripts: customMission.scripts ? clone(customMission.scripts) : [{ id: makeId('s'), x: 40, y: 40, blocks: clone(customMission.starter || []) }], sprites: customMission.sprites ? clone(customMission.sprites) : undefined, background: customMission.background || 'sky' });
    }
  } catch (error) { toast(friendlyError({ code: 'E_LOAD' }, project.level), true); }
  if (!initial && store.list().length) {
    const choice = await dialogs.show({ title: 'まえの つづきが あるよ', message: 'まえに つくった さくひんの つづきから はじめますか？', buttons: [{ label: 'あたらしく つくる', value: false }, { label: 'つづきから', value: true, primary: true }] });
    if (choice) initial = store.latest();
  }
  if (!initial) initial = createProject({ level: levelFromURL || store.level || 1, author: store.author });
  if (levelFromURL) initial.level = Math.max(1, Math.min(5, levelFromURL));
  project = normalizeProject(initial);
  if (!store.author) {
    const author = await dialogs.ask('なまえを おしえてね', 'クラスと なまえを いれると、さくひんに なまえが つくよ。', '');
    if (author) { store.author = author; project.author = author; }
  } else if (!project.author) project.author = store.author;
  const font = Number(localStorage.getItem('bs.font')) || 0; if (font === 1) document.body.classList.add('font-large'); if (font === 2) document.body.classList.add('font-xlarge');
  history.reset(project);
  renderAll();
  autosave(store, function () { return project; }, null, function () { toast('じどうほぞん できませんでした', true); });
  registerWebMCP();
}

document.getElementById('move-up-btn').addEventListener('click', function () { editor.moveSelected(-1); });
document.getElementById('move-down-btn').addEventListener('click', function () { editor.moveSelected(1); });
document.getElementById('delete-btn').addEventListener('click', function () { editor.deleteSelected(); });
document.querySelectorAll('#insert-mode button').forEach(function (button) { button.addEventListener('click', function () { editor.setInsertMode(button.dataset.insert); editor.updateSelectionControls(); }); });
document.getElementById('save-btn').addEventListener('click', showSaveDialog);
document.getElementById('help-btn').addEventListener('click', showHelp);
document.getElementById('teacher-btn').addEventListener('click', showTeacher);
document.getElementById('missions-btn').addEventListener('click', showMissionDialog);
document.getElementById('tidy-btn').addEventListener('click', function () { document.getElementById('script-canvas').scrollTo({ top: 0, left: 0, behavior: 'smooth' }); });
document.getElementById('palette-search-toggle').addEventListener('click', function () { const field = document.querySelector('.search-field'); field.hidden = !field.hidden; if (!field.hidden) document.getElementById('palette-search').focus(); });
document.getElementById('grid-btn').addEventListener('click', function (event) { turtleStage.setGrid(event.currentTarget.getAttribute('aria-pressed') !== 'true'); event.currentTarget.setAttribute('aria-pressed', String(turtleStage.grid)); });
document.getElementById('export-image-btn').addEventListener('click', function () { const url = activeStage().captureThumbnail ? activeStage().captureThumbnail() : ''; if (!url) return; const link = document.createElement('a'); link.href = url; link.download = project.name.replace(/\s+/g, '') + '.png'; link.click(); });
document.getElementById('sprite-shape-select').addEventListener('change', function (event) { const sprite = project.sprites && project.sprites[0]; if (!sprite) return; sprite.shape = event.target.value; sprite.name = event.target.options[event.target.selectedIndex].textContent; history.record(project); spriteStage.render(); updateToolbar(); });
document.getElementById('sprite-add-btn').addEventListener('click', function () { if (project.sprites.length >= 8) { toast('キャラは 8たいまで だよ'); return; } const index = project.sprites.length; project.sprites.push({ id: makeId('sp'), name: 'キャラ ' + (index + 1), shape: spriteShapes[index % spriteShapes.length], x: (index % 4 - 1.5) * 70, y: (Math.floor(index / 4) - .5) * 90, dir: 90, size: 72, visible: true, color: ['#f5a623', '#4c9bd6', '#e95b6d', '#61a85a', '#8c62bd', '#e88d3d', '#df4f75', '#efc13d'][index % 8] }); history.record(project); spriteStage.render(); updateStageTabs(); updateToolbar(); toast('キャラを たしたよ'); });
document.getElementById('sprite-background-btn').addEventListener('click', function () { const current = spriteBackgrounds.indexOf(project.background); project.background = spriteBackgrounds[(current + 1) % spriteBackgrounds.length]; history.record(project); spriteStage.render(); updateToolbar(); });
document.getElementById('refresh-code-btn').addEventListener('click', function () { updateCode(true); document.getElementById('code-message').textContent = 'ブロックから コードを つくりました'; });
document.getElementById('apply-code-btn').addEventListener('click', function () { try { project.scripts[0].blocks = jsToBlocks(document.getElementById('code-editor').value); history.record(project); editor.selectedId = null; editor.render(); document.getElementById('code-message').textContent = 'コードを ブロックに しました'; updateToolbar(); } catch (error) { document.getElementById('code-message').textContent = error.message; } });
document.getElementById('project-name').addEventListener('blur', function (event) { const name = event.target.textContent.trim().slice(0, 80); event.target.textContent = name || project.name; if (name && name !== project.name) { project.name = name; history.record(project); updateToolbar(); } });
document.getElementById('file-input').addEventListener('change', async function (event) { try { const loaded = await readProjectFile(event.target.files[0]); setProject(loaded); dialogs.close(true); toast(UI.loaded); } catch (error) { toast(friendlyError({ code: 'E_LOAD' }, project.level), true); } event.target.value = ''; });
document.getElementById('script-canvas').addEventListener('dragover', function (event) { if (event.dataTransfer && event.dataTransfer.files.length) event.preventDefault(); });
document.getElementById('script-canvas').addEventListener('drop', async function (event) { if (!event.dataTransfer || !event.dataTransfer.files.length) return; event.preventDefault(); try { setProject(await readProjectFile(event.dataTransfer.files[0])); toast(UI.loaded); } catch (error) { toast(friendlyError({ code: 'E_LOAD' }, project.level), true); } });
document.querySelectorAll('.mobile-tab').forEach(function (button) { button.addEventListener('click', function () { document.querySelectorAll('.mobile-tab').forEach(function (item) { item.classList.toggle('is-active', item === button); }); document.getElementById('workspace').classList.toggle('mobile-stage', button.dataset.mobileView === 'stage'); }); });
document.querySelectorAll('.stage-tab').forEach(function (button) { button.addEventListener('click', function () { if (running) stopRun(false); project.stage = button.dataset.stage; history.record(project); renderAll(); if (project.stage === 'device' && project.level < 3) toast('そうちの ブロックは ★3 から つかえるよ'); }); });
window.addEventListener('keydown', function (event) { if (event.ctrlKey && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; } keys.add(event.key); triggerProjectEvent('event_key', event.key); });
window.addEventListener('keyup', function (event) { keys.delete(event.key); });
document.getElementById('sprite-canvas').addEventListener('click', function () { triggerProjectEvent('event_click'); });
document.addEventListener('blockhint', function (event) { if (event.detail) toast(event.detail); });
let brandTaps = 0; let brandTimer = 0;
document.getElementById('brand').addEventListener('click', function () { brandTaps += 1; clearTimeout(brandTimer); brandTimer = setTimeout(function () { brandTaps = 0; }, 1800); if (teacherMode || brandTaps >= 5) { brandTaps = 0; showTeacher(); } });
window.addEventListener('error', function (event) { toast(friendlyError(event.error, project.level), true); });
window.addEventListener('unhandledrejection', function (event) { event.preventDefault(); toast(friendlyError(event.reason, project.level), true); });

loadInitial();

if (teacherMode) document.getElementById('teacher-btn').hidden = false;

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
}
