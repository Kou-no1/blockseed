import { createProject, createBlock, clone, makeId, normalizeProject } from './core/project.js';
import { ProjectStore, autosave } from './core/store.js';
import { History } from './core/history.js';
import { decodeProject, downloadProject, encodeProject, readProjectFile } from './core/share.js';
import { friendlyError } from './core/errors.js';
import { allDefinitions, getDefinition, listDefinitions } from './blocks/registry.js';
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
import { campaign, renderLandscape, destinationMenu, showMobileView } from './expedition.js';

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
let runCompleted = false;
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
  const status = document.getElementById('run-status');
  status.textContent = running ? '実行中' : runCompleted ? '実行完了' : '待機中';
  status.dataset.active = String(running);
  if (project.stage === 'device') deviceStage.setProgram(project, running, () => {
    editor.render();
    recordChange('LEDの条件を かえたよ');
  });
  editor.element.inert = running;
  document.getElementById('palette-panel').inert = running;
  editor.updateSelectionControls();
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
  let index = 0;
  (project.vars || []).forEach(function (item) {
    if (runtime ? runtime.varVisibility.get(item.id) === false : item.show === false) return;
    let monitor = root.children[index++];
    if (!monitor) {
      monitor = document.createElement('span');
      monitor.className = 'monitor';
      root.appendChild(monitor);
    }
    const value = runtime && runtime.vars ? runtime.vars.get(item.id) : item.value;
    const label = item.name + ' = ' + String(value ?? 0);
    if (monitor.textContent !== label) monitor.textContent = label;
  });
  while (root.children.length > index) root.lastElementChild.remove();
}

function renderAll() {
  renderLevel();
  turtleStage.setRegion(renderLandscape(project.missionId));
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
  discardExecution();
  history.record(project);
  updateToolbar();
  updateCode(false);
  renderMonitors(interpreter);
  updateMissionProgress();
  if (message) toast(message);
}

function setProject(next, preserveMission) {
  stopRun(false);
  deviceStage.clearRecords();
  project = normalizeProject(next);
  if (levelFromURL && levelLocked) project.level = Math.max(1, Math.min(5, levelFromURL));
  history.reset(project);
  editor.selectedId = null;
  editor.runningId = null;
  interpreter = null;
  if (!preserveMission) {
    customMission = null;
    currentMission = getMission(project.missionId || 'intro_square');
    allowedBlocks = project.missionId ? currentMission.allowedBlocks : null;
  }
  activeStage().reset();
  renderAll();
}

function selectionState(state) {
  document.getElementById('move-up-btn').disabled = !state.up || running;
  document.getElementById('move-down-btn').disabled = !state.down || running;
  document.getElementById('delete-btn').disabled = !state.selected || running;
  const insert = document.getElementById('insert-mode');
  insert.hidden = !state.cShape || running;
  insert.querySelectorAll('button').forEach(function (button) {
    const active = button.dataset.insert === editor.insertMode;
    button.hidden = button.dataset.insert === 'else' && !state.hasElse;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

const editor = new ScriptCanvas(document.getElementById('script-canvas'), {
  getProject: function () { return project; },
  rubyEnabled: rubyEnabled,
  onChange: recordChange,
  isRunning: function () { return running; },
  onSelect: function () {},
  onSelectionState: selectionState,
  toast: toast,
  confirmAllDeletes: function () { return easyMode; },
  confirmDelete: function () { return dialogs.askYesNo('ブロックを けす？', 'もどす ボタンで もとに もどせるよ。', true); }
});

const palette = new Palette(document.getElementById('category-tabs'), document.getElementById('palette'), document.getElementById('palette-search'), {
  getState: function () { return { level: project.level, stage: project.stage, project: project, rubyEnabled: rubyEnabled(), allowedBlocks: availableMissionBlocks() }; },
  onAdd: function (type) {
    if (running) return;
    editor.addType(type);
    if (matchMedia('(max-width: 699px)').matches) showMobileView('edit');
  },
  onCreate: createNamedItem
});

const toolbar = new Toolbar({ onRun: runProject, onStop: function () { stopRun(true); }, onLevel: showLevelDialog, onUndo: undo, onRedo: redo });

new DragController(document.getElementById('drag-layer'), {
  onAdd: editor.addType.bind(editor),
  onMove: editor.moveBefore.bind(editor),
  onDelete: editor.deleteSelected.bind(editor),
  onSnap: function () { audio.click(); }
});

function makeScheduler() {
  const stage = activeStage();
  interpreter = new Interpreter({
    project: project, stage: stage, stageName: project.stage, audio: audio, keys: keys,
    motionDuration: function () { return toolbar.stepsPerFrame <= 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 0; },
    ask: function (question) { return dialogs.ask('しつもん', question, ''); },
    warn: function (code, blockId) {
      const block = document.querySelector('.blk[data-id="' + CSS.escape(String(blockId)) + '"]');
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
    onDone: function () {
      running = false;
      runCompleted = true;
      updateToolbar();
      updateMissionProgress();
      toast(UI.complete);
    },
    onStuck: async function () {
      if (!running || stuckDialogOpen || dialogs.active) return;
      stuckDialogOpen = true;
      const currentScheduler = scheduler;
      const shouldStop = await dialogs.show({
        title: 'うごきが とまって いるみたい',
        message: 'このまま つづけますか？ ずっとブロックは、じぶんで とめるまで うごきます。',
        buttons: [{ label: 'つづける', value: false }, { label: 'とめる', value: true, danger: true }]
      });
      stuckDialogOpen = false;
      if (scheduler !== currentScheduler) return;
      if (shouldStop && running) stopRun(true);
      else if (running) activeStage().changedAt = performance.now();
    },
    onError: function (error) {
      const id = error && error.blockId;
      const block = id ? document.querySelector('.blk[data-id="' + CSS.escape(String(id)) + '"]') : null;
      if (block) block.classList.add('is-error');
      toast(friendlyError(error, project.level), true);
    }
  });
}

function runProject() {
  if (running) return;
  successPlayed = false;
  runCompleted = false;
  activeStage().reset();
  scheduler = makeScheduler();
  updateMissionProgress();
  if (scheduler.start('event_start')) toast(UI.running);
  else if (project.scripts.some(script => ['event_key', 'event_click'].includes(script.blocks[0]?.type))) toast('キーや キャラを おして はじめよう');
  else toast('「はじまり」の ブロックを おこう');
}

function triggerProjectEvent(type, detail) {
  const hasHat = project.scripts.some(script => script.blocks[0]?.type === type);
  if (!hasHat) return;
  if (!scheduler) scheduler = makeScheduler();
  if (!scheduler.matching(type, detail).length) return;
  runCompleted = false;
  scheduler.trigger(type, detail);
}

function stopRun(showMessage) {
  runCompleted = false;
  if (scheduler) scheduler.stop();
  scheduler = null; running = false; editor.setRunning(null); updateToolbar();
  if (!showMessage) interpreter = null;
  if (project.stage === 'device') { Object.keys(deviceStage.outputs).forEach(function (name) { deviceStage.outputs[name] = 0; }); deviceStage.render(); }
  updateMissionProgress();
  if (showMessage) toast(UI.stopped);
}

function discardExecution() {
  if (scheduler) scheduler.stop();
  if (interpreter) activeStage().reset();
  scheduler = null;
  interpreter = null;
  runCompleted = false;
  successPlayed = false;
}

function undo() {
  if (running) return;
  const snapshot = history.undo();
  if (!snapshot) return;
  discardExecution();
  project = snapshot; renderAll();
}

function redo() {
  if (running) return;
  const snapshot = history.redo();
  if (!snapshot) return;
  discardExecution();
  project = snapshot; renderAll();
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

function activeMission() {
  const mission = customMission || currentMission;
  return mission && mission.stage === project.stage ? mission : null;
}

function availableMissionBlocks() {
  return customMission || activeMission() ? allowedBlocks : null;
}

function updateMissionCard() {
  const mission = activeMission();
  document.getElementById('mission-title').textContent = mission ? mission.title : 'じゆうに つくろう';
  document.getElementById('mission-progress').textContent = mission ? mission.goal : 'ブロックを うごかしてみよう';
  document.getElementById('mission-hint').textContent = mission?.hints?.[0] || '';
  updateMissionProgress();
}

function missionResults() {
  return evaluateMission(activeMission(), project, activeStage(), runCompleted);
}

function updateMissionProgress() {
  const mission = activeMission();
  const id = !customMission && mission?.id === project.missionId ? mission.id : null;
  const results = missionResults();
  const done = results.filter(function (item) { return item.passed; }).length;
  const verified = results.length > 0 && done === results.length && (runCompleted || (running && project.stage === 'device'));
  if (verified && !successPlayed) {
    successPlayed = true;
    const stamped = id && campaign.complete(id);
    audio.effect('success');
    toast(stamped ? 'クリア！ 探検マップにスタンプを押したよ' : 'お題をクリア！');
  }
  const info = campaign.info(id);
  const rank = document.getElementById('mission-rank');
  rank.textContent = info ? ['はじめの一歩','ちょうせん','うでだめし'][info.rank - 1] + '　' + info.rank + ' / 3' : '';
  const count = document.getElementById('goal-count');
  const label = info && !info.unlocked ? '保存作品でれんしゅう中（スタンプは探検順）' : info?.cleared ? '✓ クリアずみ' : results.length ? 'できた条件 ' + done + ' / ' + results.length : '';
  if (label !== count.textContent) count.textContent = label;
  const next = document.getElementById('next-mission');
  next.hidden = !info?.cleared;
  next.textContent = info?.allDone ? '全9題クリア！ 探検マップ' : info?.rank === 3 ? '次の探検地をえらぶ' : '次のお題へ';
  const guide = document.getElementById('goal-details-btn');
  guide.hidden = !mission;
  if (!mission) closeGoalDetails();
  if (!document.getElementById('goal-details').hidden) {
    const list = document.getElementById('goal-checks');
    const labels = results.map(item => (item.passed ? '✓ ' : '○ ') + item.label);
    if (list.textContent !== labels.join('')) list.replaceChildren(...labels.map(line => {
      const li = document.createElement('li'); li.textContent = line; return li;
    }));
  }
}

function closeGoalDetails() {
  document.getElementById('goal-details').hidden = true;
  document.getElementById('goal-details-btn').setAttribute('aria-expanded','false');
}

function startMission(mission) {
  if (!campaign.isUnlocked(mission.id) || (levelLocked && mission.level > project.level)) { toast('探検マップで、いま選べるお題を見てね'); return; }
  try { store.save(project); } catch (error) { toast('作品を保存できませんでした。ファイルに保存してね。', true); return; }
  dialogs.close(false);
  stopRun(false);
  closeGoalDetails();
  customMission = null;
  currentMission = mission;
  allowedBlocks = mission.allowedBlocks || null;
  setProject(createProject({ ...missionProjectData(mission), author: store.author }), true);
  saveNow(false);
  showMobileView(mission.stage === 'device' ? 'stage' : 'edit');
  document.getElementById('mission-title').scrollIntoView({block:'nearest'});
  toast('「' + mission.title + '」を はじめるよ');
}

function showMissionDialog() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const list = document.createElement('div'); list.className = 'dialog-list';
  listMissions().filter(function (mission) { return !campaign.info(mission.id) && (levelLocked ? mission.level <= project.level : mission.level <= Math.max(project.level, 3) || teacherMode); }).forEach(function (mission) {
    const button = document.createElement('button'); button.type = 'button';
    const title = document.createElement('strong'); title.textContent = mission.title;
    const meta = document.createElement('small'); meta.textContent = mission.grade + '・' + mission.subject + '・★' + mission.level;
    button.append(title, meta);
    button.addEventListener('click', () => startMission(mission));
    list.appendChild(button);
  });
  content.appendChild(list);
  const results = missionResults();
  if (results.length) {
    const checks = document.createElement('ul'); checks.className = 'check-list';
    results.forEach(function (item) { const li = document.createElement('li'); li.className = item.passed ? 'is-done' : ''; li.textContent = (item.passed ? '✓ ' : '○ ') + item.label; checks.appendChild(li); });
    const current = customMission || currentMission;
    const guide = dialogSection('いまのミッション');
    if (current?.hints?.length) {
      const hint = document.createElement('p');
      hint.textContent = current.hints[0];
      guide.appendChild(hint);
    }
    guide.appendChild(checks);
    content.prepend(guide);
  }
  dialogs.show({ title: '自由にえらべる練習', message: '作品を保存して、選んだ練習を開きます。', content: content, wide: true, buttons: [{ label: 'とじる', value: false }] });
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
  const fresh = document.createElement('button');
  fresh.type = 'button'; fresh.textContent = '新しい作品';
  fresh.addEventListener('click', () => {
    try { store.save(project); } catch (error) { toast('いまの作品を保存できませんでした', true); return; }
    dialogs.close(false);
    const empty = createProject({ name: '自由探検', missionId: 'free_draw', level: project.level, author: store.author });
    empty.scripts = [{ id: makeId('s'), x: 40, y: 40, blocks: [createBlock('event_start')] }];
    setProject(empty);
    showMobileView('edit');
  });
  localRow.appendChild(fresh);
  const author = document.createElement('button');
  author.type = 'button'; author.textContent = '作者名を設定';
  author.addEventListener('click', async () => {
    const value = await dialogs.ask('作品の作者名', 'クラスと名前を作品に記録できます。', project.author || store.author);
    if (value !== null) { project.author = value; store.author = value; await saveNow(true); }
  });
  localRow.appendChild(author);
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
  clear.addEventListener('click', async function () { if (await dialogs.askYesNo('データを ぜんぶ けす？', 'この端末の作品・なまえ・探検スタンプが消えます。', true)) { store.clearAll(); campaign.reset(); dialogs.close(true); setProject(createProject(missionProjectData(getMission('intro_square')))); toast('この たんまつの データを けしました'); } });
  settings.append(settingsRow, clear); content.appendChild(settings);
  dialogs.show({ title: 'ほぞん・ひらく', message: '5びょうごとに じどうで ほぞんしています。たいせつな さくひんは ファイルにも のこそう。', content: content, wide: true, buttons: [{ label: 'とじる', value: false, primary: true }] });
}

function showHelp() {
  const content = document.createElement('div'); content.className = 'dialog-content';
  const steps = dialogSection('3つの ステップ');
  ['1. ひだりの ブロックを タップ', '2. まんなかで ならべる', '3. 「うごかす」を おす'].forEach(function (text) { const p = document.createElement('p'); p.textContent = text; steps.appendChild(p); });
  const tips = dialogSection('こまった とき');
  const p = document.createElement('p'); p.textContent = '上下キーで ブロックを えらべます。Altを おしながら 上下キーで ならべかえます。「もどす」で 前の状態に もどります。'; tips.appendChild(p);
  const mapNote = dialogSection('探検地と地図');
  const mapInfo = document.createElement('p');
  mapInfo.textContent = '風景は実在する探検地をもとにしたイメージです。観測ステージの地形とルートは、プログラムを試すための練習地図です。';
  mapNote.appendChild(mapInfo);
  content.append(steps, tips, mapNote);
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
      execute: function (input) {
        const available = listDefinitions(project.level, project.stage, null, availableMissionBlocks());
        if (!available.some(def => def.type === input?.blockType)) throw new Error('This block is not available in the current palette.');
        if (!editor.addType(input.blockType)) throw new Error('The block could not be inserted at the current selection.');
        return { added: input.blockType, projectName: project.name };
      }
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
  if (!initial) initial = store.latest();
  if (!initial) {
    const suggested = getMission(campaign.firstOpen());
    if (!levelLocked || !levelFromURL || suggested.level <= levelFromURL) currentMission = suggested;
    initial = createProject({ ...missionProjectData(currentMission), level: levelFromURL || Math.max(store.level || 1, currentMission.level), author: store.author });
  }
  if (levelFromURL) initial.level = Math.max(1, Math.min(5, levelFromURL));
  project = normalizeProject(initial);
  if (!project.author) project.author = store.author;
  if (!customMission && project.missionId) {
    currentMission = getMission(project.missionId);
    allowedBlocks = currentMission.allowedBlocks;
  }
  const font = Number(localStorage.getItem('bs.font')) || 0; if (font === 1) document.body.classList.add('font-large'); if (font === 2) document.body.classList.add('font-xlarge');
  history.reset(project);
  renderAll();
  autosave(store, function () { return project; }, null, function () { toast('じどうほぞん できませんでした', true); });
  registerWebMCP();
  if (project.stage === 'device') showMobileView('stage');
}

document.getElementById('move-up-btn').addEventListener('click', function () { editor.moveSelected(-1); });
document.getElementById('move-down-btn').addEventListener('click', function () { editor.moveSelected(1); });
document.getElementById('delete-btn').addEventListener('click', function () { editor.deleteSelected(); });
document.querySelectorAll('#insert-mode button').forEach(function (button) { button.addEventListener('click', function () { editor.setInsertMode(button.dataset.insert); }); });
document.getElementById('save-btn').addEventListener('click', showSaveDialog);
document.getElementById('help-btn').addEventListener('click', showHelp);
document.getElementById('teacher-btn').addEventListener('click', showTeacher);
function openMap() {
  const menu = destinationMenu(getMission, startMission, levelLocked ? project.level : 0, project.missionId);
  const practice = document.createElement('button'); practice.type = 'button';
  practice.textContent = '自由にえらべる練習'; practice.addEventListener('click', showMissionDialog);
  menu.appendChild(practice);
  dialogs.show({ title: '探検マップ', message: '1つの探検地で3つのお題をクリアすると、次の探検地がひらくよ。', content: menu, wide: true, buttons: [{ label: 'とじる', value: false }] });
}
document.getElementById('atlas-missions').addEventListener('click', openMap);
document.getElementById('destination-btn').addEventListener('click', openMap);
document.getElementById('next-mission').addEventListener('click', () => {
  const info = campaign.info(project.missionId);
  if (!info?.cleared) return;
  if (info.rank === 3 || info.allDone || (levelLocked && getMission(info.nextId).level > project.level)) openMap();
  else startMission(getMission(info.nextId));
});
document.getElementById('goal-details-btn').addEventListener('click', event => {
  const panel = document.getElementById('goal-details');
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
  updateMissionProgress();
});
document.getElementById('tidy-btn').addEventListener('click', function () { document.getElementById('script-canvas').scrollTo({ top: 0, left: 0, behavior: 'smooth' }); });
document.getElementById('palette-search-toggle').addEventListener('click', function (event) {
  const field = document.querySelector('.search-field');
  const search = document.getElementById('palette-search');
  field.hidden = !field.hidden;
  event.currentTarget.setAttribute('aria-expanded', String(!field.hidden));
  if (!field.hidden) search.focus();
  else if (search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
});
document.getElementById('grid-btn').addEventListener('click', function (event) { turtleStage.setGrid(event.currentTarget.getAttribute('aria-pressed') !== 'true'); event.currentTarget.setAttribute('aria-pressed', String(turtleStage.grid)); });
document.getElementById('export-image-btn').addEventListener('click', function () { const url = activeStage().captureThumbnail ? activeStage().captureThumbnail() : ''; if (!url) return; const link = document.createElement('a'); link.href = url; link.download = project.name.replace(/\s+/g, '') + '.png'; link.click(); });
document.getElementById('sprite-shape-select').addEventListener('change', function (event) { const sprite = project.sprites && project.sprites[0]; if (!sprite) return; sprite.shape = event.target.value; sprite.name = event.target.options[event.target.selectedIndex].textContent; history.record(project); spriteStage.render(); updateToolbar(); });
document.getElementById('sprite-add-btn').addEventListener('click', function () { if (project.sprites.length >= 8) { toast('キャラは 8たいまで だよ'); return; } const index = project.sprites.length; project.sprites.push({ id: makeId('sp'), name: 'キャラ ' + (index + 1), shape: spriteShapes[index % spriteShapes.length], x: (index % 4 - 1.5) * 70, y: (Math.floor(index / 4) - .5) * 90, dir: 90, size: 72, visible: true, color: ['#f5a623', '#4c9bd6', '#e95b6d', '#61a85a', '#8c62bd', '#e88d3d', '#df4f75', '#efc13d'][index % 8] }); history.record(project); spriteStage.render(); updateStageTabs(); updateToolbar(); toast('キャラを たしたよ'); });
document.getElementById('sprite-background-btn').addEventListener('click', function () { const current = spriteBackgrounds.indexOf(project.background); project.background = spriteBackgrounds[(current + 1) % spriteBackgrounds.length]; history.record(project); spriteStage.render(); updateToolbar(); });
document.getElementById('refresh-code-btn').addEventListener('click', function () { updateCode(true); document.getElementById('code-message').textContent = 'ブロックから コードを つくりました'; });
document.getElementById('apply-code-btn').addEventListener('click', function () {
  const message = document.getElementById('code-message');
  if (running) { message.textContent = 'とめてから コードを へんしゅうしてね'; return; }
  if (project.scripts.length > 1 || (project.scripts[0]?.blocks[0] && project.scripts[0].blocks[0].type !== 'event_start')) {
    message.textContent = 'コードからの変換は「▶ が おされたとき」ひと組の作品で使えます';
    return;
  }
  try {
    const blocks = jsToBlocks(document.getElementById('code-editor').value, project);
    if (project.scripts.length) project.scripts[0].blocks = blocks;
    else project.scripts.push({ id: makeId('s'), x: 40, y: 40, blocks });
    editor.selectedId = null;
    recordChange();
    editor.render();
    message.textContent = 'コードを ブロックに しました';
  } catch (error) {
    message.textContent = error.message;
  }
});
document.getElementById('project-name').addEventListener('blur', function (event) { const name = event.target.textContent.trim().slice(0, 80); event.target.textContent = name || project.name; if (name && name !== project.name) { project.name = name; history.record(project); updateToolbar(); } });
document.getElementById('file-input').addEventListener('change', async function (event) { try { const loaded = await readProjectFile(event.target.files[0]); setProject(loaded); dialogs.close(true); toast(UI.loaded); } catch (error) { toast(friendlyError({ code: 'E_LOAD' }, project.level), true); } event.target.value = ''; });
document.getElementById('script-canvas').addEventListener('dragover', function (event) { if (event.dataTransfer && event.dataTransfer.files.length) event.preventDefault(); });
document.getElementById('script-canvas').addEventListener('drop', async function (event) { if (!event.dataTransfer || !event.dataTransfer.files.length) return; event.preventDefault(); try { setProject(await readProjectFile(event.dataTransfer.files[0])); toast(UI.loaded); } catch (error) { toast(friendlyError({ code: 'E_LOAD' }, project.level), true); } });
document.querySelectorAll('.mobile-tab').forEach(button => button.addEventListener('click', () => showMobileView(button.dataset.mobileView)));
document.getElementById('run-btn').addEventListener('click', () => {
  if (matchMedia('(max-width: 699px)').matches) showMobileView('stage');
  else if (matchMedia('(max-width: 1023px)').matches) {
    document.getElementById('stage-title').focus({preventScroll:true});
    document.getElementById('stage-panel').scrollIntoView({block:'start'});
  }
});
document.getElementById('back-to-goal').addEventListener('click', () => {
  document.getElementById('mission-title').focus({preventScroll:true});
  document.getElementById('mission-card').scrollIntoView({block:'start'});
});
document.querySelectorAll('.stage-tab').forEach(function (button) { button.addEventListener('click', function () { if (project.stage === button.dataset.stage) return; stopRun(false); project.stage = button.dataset.stage; history.record(project); renderAll(); if (project.stage === 'device' && project.level < 3) toast('そうちの ブロックは ★3 から つかえるよ'); }); });
window.addEventListener('keydown', function (event) {
  if (event.defaultPrevented || event.isComposing || dialogs.active || document.querySelector('.number-pad-backdrop')) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea, [contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z' || key === 'y') {
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redo();
      else undo();
    }
    return;
  }
  if (event.altKey || (event.target instanceof Element && event.target.closest('button, [role="button"]') && [' ', 'Enter'].includes(event.key))) return;
  keys.add(event.key);
  if (!event.repeat) triggerProjectEvent('event_key', event.key);
});
window.addEventListener('keyup', function (event) { keys.delete(event.key); });
window.addEventListener('blur', function () { keys.clear(); });
document.getElementById('sprite-canvas').addEventListener('click', function () { triggerProjectEvent('event_click'); });
document.addEventListener('blockhint', function (event) { if (event.detail) toast(event.detail); });
let brandTaps = 0; let brandTimer = 0;
document.getElementById('brand').addEventListener('click', function () { brandTaps += 1; clearTimeout(brandTimer); brandTimer = setTimeout(function () { brandTaps = 0; }, 1800); if (teacherMode || brandTaps >= 5) { brandTaps = 0; showTeacher(); } });
window.addEventListener('error', function (event) { toast(friendlyError(event.error, project.level), true); });
window.addEventListener('unhandledrejection', function (event) { event.preventDefault(); toast(friendlyError(event.reason, project.level), true); });

loadInitial();

if (teacherMode) document.getElementById('teacher-btn').hidden = false;

if (!document.documentElement.hasAttribute('data-standalone') && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('./sw.js').catch(function () {}); });
}
