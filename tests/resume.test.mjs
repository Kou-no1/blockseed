import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../js/expedition.js';
import { createProject } from '../js/core/project.js';
import { ProjectStore } from '../js/core/store.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function installStorage(t) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  return storage;
}

test('a finished expedition has no unfinished mission, even after replay or reload', () => {
  const storage = memoryStorage();
  storage.setItem('bs.expedition.v1', '26');
  const campaign = createCampaign(storage);
  assert.equal(campaign.firstOpen(), 'mcmurdo_3');
  assert.equal(campaign.complete('mcmurdo_2'), false);
  assert.equal(campaign.complete('mcmurdo_3'), true);
  assert.equal(campaign.firstOpen(), null);

  const resumed = createCampaign(storage);
  assert.equal(resumed.complete('intro_square'), false);
  assert.equal(resumed.info('intro_square').cleared, true);
  assert.equal(resumed.info('mcmurdo_3').allDone, true);
  assert.equal(resumed.firstOpen(), null);
  assert.equal(storage.getItem('bs.expedition.v1'), '27');
});

test('a replay saved last cannot displace the most recent draft of the unfinished mission', t => {
  const storage = installStorage(t);
  const store = new ProjectStore();
  const mission = { id: 'mulu_2', stage: 'field' };
  const draft = createProject({ missionId: mission.id, stage: mission.stage, fieldProgram: ['first', 'one'] });
  store.save(draft);
  const edited = createProject({ missionId: mission.id, stage: mission.stage, fieldProgram: ['every', 'one'] });
  store.save(edited);
  const replay = createProject({ missionId: 'mulu_1', stage: 'field' });
  store.save(replay);
  // Older saves have no mission metadata in the index. The projects still contain the full program.
  storage.setItem('bs.index', JSON.stringify(store.list().map(({ id }) => ({ id }))));

  assert.equal(store.latest().id, replay.id);
  const resumed = store.findMission(mission);
  assert.equal(resumed.id, edited.id);
  assert.deepEqual(resumed.fieldProgram, ['every', 'one']);
  assert.equal(store.latest().id, replay.id);
  assert.equal(store.load(draft.id).missionId, mission.id);
});

test('only compatible and readable mission projects can be resumed', t => {
  const storage = installStorage(t);
  const store = new ProjectStore();
  const mission = { id: 'mulu_2', stage: 'field' };
  const save = extra => store.save(createProject({ missionId: mission.id, stage: mission.stage, ...extra }));
  const genuine = save({ fieldProgram: ['every', 'one'] });
  save({ stage: 'turtle' });
  save({ fieldScene: 'galapagos_1' });
  save({ missionId: null, fieldScene: mission.id });
  const invalid = save({});
  storage.setItem('bs.p.' + invalid.id, JSON.stringify({ v: 12 }));
  const unreadable = save({});
  storage.setItem('bs.p.' + unreadable.id, 'not JSON');

  assert.equal(store.findMission(mission)?.id, genuine.id);
  storage.setItem('bs.p.' + genuine.id, 'null');
  assert.equal(store.findMission(mission), null);
  assert.equal(store.findMission({ id: 'mcmurdo_3', stage: 'field' }), null);
});
