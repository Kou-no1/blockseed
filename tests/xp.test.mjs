import test from 'node:test';
import assert from 'node:assert/strict';
import { createCampaign } from '../js/expedition.js';

function localStore() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

test('36 first clears earn 1350 XP, nine titles and exactly level 31', () => {
  const game = createCampaign(localStore());
  assert.deepEqual(game.growth(), {
    total: 0, level: 1, within: 0, needed: 20, remaining: 20, titles: [], equipped: null
  });
  let awards = 0;
  for (let region = 1; region <= 9; region++) {
    const guide = game.firstOpen();
    const clear = (id, xp) => {
      assert.equal(game.nextAwardXP(id), xp);
      const result = game.award(id, 'attempt-' + id);
      assert.equal(result.xp, xp);
      assert.equal(result.firstClear, true);
      assert.equal(game.hasAwarded(id, 'attempt-' + id), true);
      awards++;
      return result;
    };
    const sample = clear(guide, 20);
    if (region === 1) {
      assert.equal(sample.levelUp, true);
      assert.equal(game.growth().level, 2);
    }
    assert.equal(sample.title, null);
    assert.equal(clear(guide + '_blank', 30).title, null);
    assert.equal(clear(game.firstOpen(), 40).title, null);
    const {title} = clear(game.firstOpen(), 60);
    const progress = game.growth();
    assert.equal(title.area, progress.equipped.area);
    assert.ok(title.name && title.place && title.skill);
    assert.equal(progress.titles.length, region);
    assert.equal(progress.total, region * 150);
    if (region === 1) {
      assert.deepEqual([progress.level, progress.within, progress.remaining], [7, 20, 10]);
      assert.equal(title.name, '風の谷の地図職人');
    }
  }
  assert.equal(awards, 36);
  const end = game.growth();
  assert.deepEqual([end.total, end.level, end.within, end.needed], [1350, 31, 0, 80]);
  assert.equal(end.equipped.name, '南極ローバー隊長');
});

test('existing crowns earn first clears once and optional blank crowns are independent', () => {
  const store = localStore();
  store.setItem('bs.expedition.v1', '27');
  store.setItem('bs.expedition.blank.mulu_1_blank', 'earned');
  const game = createCampaign(store);
  assert.equal(game.growth().total, 9 * (20 + 40 + 60) + 30);
  assert.equal(game.growth().titles.length, 9);
  assert.equal(game.growth().equipped.area, 'mcmurdo');
  assert.equal(game.nextAwardXP('mulu_1_blank'), 15);
  assert.equal(game.nextAwardXP('intro_square_blank'), 30);
  assert.equal(game.award('mulu_1_blank', 'old-work'), null);
  assert.equal(game.award('mulu_1_blank', 'explicit-practice', true).xp, 15);
  assert.equal(game.award('intro_square_blank', 'new-blank').xp, 30);
  assert.equal(createCampaign(store).growth().total, 1155);
});

test('re-running, reloading and using another tab cannot pay twice for an attempt', () => {
  const store = localStore();
  const tabA = createCampaign(store), tabB = createCampaign(store);
  const id = 'paine_long_route';
  tabA.award('intro_square', 'guided');
  assert.equal(tabB.award(id, 'original').xp, 40);
  assert.equal(tabA.award(id, 'original', true), null);
  assert.equal(tabA.award(id, 'restored-without-selecting-replay'), null);
  assert.equal(tabA.award(id, 'guided', true), null);
  for (const [i, payout] of [20, 10, 5, 2, 1, 1, 1].entries()) {
    const tab = i % 2 ? tabA : tabB;
    const attempt = 'replay-' + i;
    assert.equal(tab.nextAwardXP(id), payout);
    assert.equal(tab.award(id, attempt, true).xp, payout);
    assert.equal(createCampaign(store).award(id, attempt, true), null);
  }
  assert.equal(tabA.growth().total, 100);
  assert.equal(tabB.growth().total, 100);
  assert.equal(tabA.nextAwardXP('intro_square'), 10);
  assert.equal(tabA.nextAwardXP('intro_square_blank'), 30);
});

test('titles can be equipped and persist until a new area title is earned', () => {
  const store = localStore();
  store.setItem('bs.expedition.v1', '6');
  const game = createCampaign(store);
  const tab = createCampaign(store);
  assert.equal(game.chooseTitle('yakushima'), false);
  assert.equal(game.chooseTitle('patagonia'), true);
  assert.equal(tab.growth().equipped.name, '風の谷の地図職人');
  assert.equal(game.award('namib_hexagon', 'replay', true).title, null);
  assert.equal(tab.growth().equipped.area, 'patagonia');
  for (const id of ['yakushima_canopy', 'yakushima_visitor', 'yakushima_night']) tab.award(id, id);
  assert.equal(game.growth().equipped.name, '森のあかり番');
  game.reset();
  assert.equal(tab.growth().equipped, null);
  assert.equal(tab.growth().total, 0);
  assert.equal(tab.hasAwarded('namib_hexagon', 'replay'), false);
  assert.equal(tab.chooseTitle('patagonia'), false);
});

test('only unlocked expedition attempts earn XP, including when storage is unavailable', () => {
  const denied = () => { throw new Error('denied'); };
  for (const storage of [null, {getItem: denied, setItem: denied}, {getItem: () => null, setItem: denied}]) {
    const game = createCampaign(storage);
    assert.equal(game.award('free_draw', 'other'), null);
    assert.equal(game.award('mulu_3', 'locked', true), null);
    assert.equal(game.award('intro_square_blank', 'locked-repeat'), null);
    assert.equal(game.award('intro_square', null), null);
    assert.equal(game.nextAwardXP('free_draw'), null);
    game.award('intro_square', 'first');
    assert.equal(game.award('intro_square', 'first', true), null);
    assert.equal(game.award('intro_square', 'redo', true).xp, 10);
    assert.equal(game.growth().total, 30);
    assert.equal(game.growth().remaining, 10);
    game.reset();
    assert.equal(game.growth().total, 0);
    assert.equal(game.hasAwarded('intro_square', 'first'), false);
  }
});

test('an interrupted first crown write can be resumed once', () => {
  const storage = localStore();
  storage.setItem('bs.expedition.xp.attempt.started', 'first/intro_square');
  const game = createCampaign(storage);
  assert.equal(game.growth().total, 0);
  assert.equal(game.award('intro_square', 'started').xp, 20);
  assert.equal(game.growth().total, 20);
  assert.equal(game.award('intro_square', 'started', true), null);
});
