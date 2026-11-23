import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../js/expedition.js';

const ids = [
  'intro_square', 'paine_long_route', 'paine_rectangle',
  'sossusvlei_survey', 'namib_dune_turn', 'namib_hexagon',
  'yakushima_canopy', 'yakushima_visitor', 'yakushima_night',
  ...['mulu','galapagos','uyuni','palau','aoraki','mcmurdo'].flatMap(area => [1,2,3].map(i => area + '_' + i))
];

function localStore(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
}

test('a new explorer earns 27 stamps in order, including each destination unlock', () => {
  const storage = localStore();
  let game = createCampaign(storage);
  for (const [i, id] of ids.entries()) {
    assert.equal(game.firstOpen(), id);
    assert.equal(game.info(id).rank, (i % 3) + 1);
    assert.equal(game.info(id).completed, i % 3);
    assert.equal(game.isUnlocked(id), true);
    for (const later of ids.slice(i + 1)) {
      assert.equal(game.isUnlocked(later), false);
      assert.equal(game.complete(later), false);
    }
    assert.equal(game.complete(id), true);
    assert.equal(game.complete(id), false);
    game = createCampaign(storage);
    assert.equal(game.info(id).cleared, true);
    assert.equal(game.info(id).nextId, ids[i + 1] ?? null);
    assert.equal(game.info(id).allDone, i === ids.length - 1);
  }
  for (const id of ids) assert.equal(game.info(id).completed, 3);
  game.reset();
  assert.equal(createCampaign(storage).firstOpen(), ids[0]);
});

test('imported and free projects do not grant expedition stamps', () => {
  const game = createCampaign(localStore('broken'));
  assert.equal(game.info('old-project'), null);
  assert.equal(game.isUnlocked('free_draw'), true);
  assert.equal(game.complete('free_draw'), false);
  assert.equal(game.complete('yakushima_canopy'), false);
  assert.equal(game.firstOpen(), ids[0]);
  for (const corrupted of ['2.5','28','-1','NaN','Infinity']) {
    assert.equal(createCampaign(localStore(corrupted)).firstOpen(), ids[0]);
  }
});

test('the old nine-stamp finish opens Mulu without replaying Yakushima', () => {
  const game = createCampaign(localStore('9'));
  assert.equal(game.firstOpen(), 'mulu_1');
  assert.equal(game.info('yakushima_night').cleared, true);
  assert.equal(game.info('yakushima_night').allDone, false);
  assert.equal(game.isUnlocked('mulu_2'), false);
});

test('tabs share progress and repeated clears cannot erase another stamp', () => {
  const storage = localStore();
  const a = createCampaign(storage), b = createCampaign(storage);
  a.complete(ids[0]);
  b.complete(ids[1]);
  assert.equal(a.complete(ids[0]), false);
  assert.equal(a.firstOpen(), ids[2]);
  b.reset();
  assert.equal(a.firstOpen(), ids[0]);
});

test('if writes or reads fail, current-session progress still works', () => {
  const fail = () => { throw new Error('storage denied'); };
  for (const storage of [null, {getItem:fail, setItem:fail}, {getItem:()=>null, setItem:fail}]) {
    const game = createCampaign(storage);
    assert.equal(game.complete(ids[0]), true);
    assert.equal(game.persisted, false);
    assert.equal(game.complete(ids[1]), true);
    assert.equal(game.info(ids[1]).completed, 2);
    game.reset();
    assert.equal(game.firstOpen(), ids[0]);
  }
});
