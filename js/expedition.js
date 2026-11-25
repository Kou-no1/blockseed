import { fieldPlaces, fieldCover } from './field/worlds.js';

const places = [
  { area: 'patagonia', missions: ['intro_square', 'paine_long_route', 'paine_rectangle'], region: 'チリ共和国 ／ パタゴニア', title: 'トーレス・デル・パイネ', latin: 'Torres del Paine National Park' },
  { area: 'namib', missions: ['sossusvlei_survey', 'namib_dune_turn', 'namib_hexagon'], region: 'ナミビア ／ ナミブ砂漠', title: 'ソススフレイ', latin: 'Sossusvlei, Namib Desert' },
  { area: 'yakushima', missions: ['yakushima_canopy', 'yakushima_visitor', 'yakushima_night'], region: '日本 ／ 鹿児島県', title: '屋久島', latin: 'Yakushima Island' }
].concat(fieldPlaces);

const trail = places.flatMap(place => place.missions);
export const stampTotal = trail.length;
const repeats = places.map(place => place.missions[0] + '_blank');
export const crownTotal = stampTotal + repeats.length;
const progressKey = 'bs.expedition.v1';
const repeatKey = 'bs.expedition.blank.';
const attemptKey = 'bs.expedition.xp.attempt.';
const titleKey = 'bs.expedition.xp.title';
export const firstClearXP = Object.freeze({ guided: 20, blank: 30, applied: 40, final: 60 });
const firstXP = new Map(places.flatMap(({ missions: [guide, applied, final] }) =>
  [[guide, firstClearXP.guided], [guide + '_blank', firstClearXP.blank],
    [applied, firstClearXP.applied], [final, firstClearXP.final]]));

const titlesByArea = {
  patagonia: ['風の谷の地図職人', '歩数とくり返しを使って、長方形の道を描けた。'],
  namib: ['砂丘の図形使い', '曲がる角度とくり返す回数を決めて、正多角形を描けた。'],
  yakushima: ['森のあかり番', '暗さと人の動き、2つの条件を組み合わせてライトを点けられた。'],
  mulu: ['こだまの指揮者', '音と休みの順番を記録して、同じリズムを再生できた。'],
  galapagos: ['ゾウガメの写真家', 'カメを見分けて、1匹につき1枚だけ撮影できた。'],
  uyuni: ['水鏡の絵かき', '星が動くたびに、水面の星を対称な位置に描けた。'],
  palau: ['潮読みの船長', '潮の高さで動きを切り替えて、島に荷物を届けられた。'],
  aoraki: ['雲間の星ハンター', '雲が晴れるまで待って、星の写真を集められた。'],
  mcmurdo: ['南極ローバー隊長', '電池に合わせて走り方を変え、土の記録を基地に届けられた。']
};
const expeditionTitles = places.map(({ area, title: place }) => {
  const [name, skill] = titlesByArea[area];
  return { area, place, name, skill };
});

function levelProgress(total) {
  let within = total, level = 1, needed = 20;
  while (within >= needed * 5) {
    within -= needed * 5;
    level += 5;
    needed += 10;
  }
  level += Math.floor(within / needed);
  within %= needed;
  return { total, level, within, needed, remaining: needed - within };
}

function missionExperience(id, replays) {
  let reward = firstXP.get(id), total = reward;
  while (replays > 0 && reward > 1) {
    reward = Math.max(1, Math.floor(reward / 2));
    total += reward;
    replays--;
  }
  return total + replays;
}

export function createCampaign(storage) {
  let count = 0;
  let saved = true;
  const earned = new Set();
  let receipts = new Map();
  let equippedArea = null;
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { storage = null; }
  }
  function refresh() {
    if (!storage || !saved) return;
    try {
      const value = Number(storage.getItem(progressKey));
      count = Number.isInteger(value) && value >= 0 && value <= trail.length ? value : 0;
    } catch { saved = false; }
  }
  function write() {
    persist(progressKey, String(count));
  }
  function persist(key, value) {
    if (!saved) return;
    try { storage.setItem(key, value); } catch { saved = false; }
  }

  // Each attempt has its own key. Simultaneous replays in two tabs cannot
  // overwrite one another. Sum rewards from distinct receipts, never a running balance.
  function refreshReceipts() {
    if (!storage || !saved) return;
    try {
      equippedArea = storage.getItem(titleKey);
      if (typeof storage.key !== 'function') return;
      const current = new Map();
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(attemptKey)) current.set(key.slice(attemptKey.length), storage.getItem(key));
      }
      receipts = current;
    } catch { saved = false; }
  }
  function receiptFor(attemptId) {
    if (storage && saved) {
      try { return storage.getItem(attemptKey + attemptId); } catch { saved = false; }
    }
    return receipts.get(attemptId);
  }
  function replayCounts() {
    const counts = new Map();
    for (const receipt of receipts.values()) {
      if (!receipt?.startsWith('replay/')) continue;
      const id = receipt.slice('replay/'.length);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }
  function equip(area) {
    equippedArea = area;
    persist(titleKey, area);
  }
  function hasRepeat(id) {
    if (storage && saved) {
      try {
        if (storage.getItem(repeatKey + id) === 'earned') earned.add(id);
        else earned.delete(id);
      } catch { saved = false; }
    }
    return earned.has(id);
  }
  return {
    info(id) {
      const repeat = repeats.includes(id);
      const base = repeat ? id.slice(0, -6) : id;
      const index = trail.indexOf(base);
      if (index < 0) return null;
      refresh();
      const place = places.find(place => place.missions.includes(base));
      const rank = place.missions.indexOf(base) + 1;
      const completed = Math.max(0, Math.min(place.missions.length, count - index + rank - 1));
      return { area: place.area, rank, repeat, unlocked: repeat ? index < count : index <= count, cleared: index < count && (!repeat || hasRepeat(id)),
        completed, total: place.missions.length, nextId: trail[index + 1] || null, allDone: count === trail.length };
    },
    firstOpen() { refresh(); return trail[count] ?? null; },
    lastCleared() { refresh(); return trail[count - 1] ?? null; },
    remainingRepeat() { refresh(); return repeats.find(id => this.info(id).unlocked && !hasRepeat(id)) ?? null; },
    isUnlocked(id) { return this.info(id)?.unlocked ?? true; },
    complete(id) {
      refresh();
      if (repeats.includes(id)) {
        if (!this.isUnlocked(id) || hasRepeat(id)) return false;
        earned.add(id);
        persist(repeatKey + id, 'earned');
        return true;
      }
      if (count >= trail.length || trail[count] !== id) return false;
      count++;
      write();
      return true;
    },
    growth() {
      refresh();
      refreshReceipts();
      const replays = replayCounts();
      // A pre-existing crown is always worth one first clear. Optional blank
      // crowns have their own records, independent of the 27 main trail steps.
      let total = 0;
      for (const [i, id] of trail.slice(0, count).entries()) {
        total += missionExperience(id, replays.get(id) || 0);
        if (i % 3 === 0 && hasRepeat(id + '_blank')) {
          const repeat = id + '_blank';
          total += missionExperience(repeat, replays.get(repeat) || 0);
        }
      }
      const titles = expeditionTitles.slice(0, Math.floor(count / 3));
      const equipped = titles.find(title => title.area === equippedArea) || titles.at(-1) || null;
      return { ...levelProgress(total), titles, equipped };
    },
    chooseTitle(area) {
      refresh();
      if (!expeditionTitles.slice(0, Math.floor(count / 3)).some(title => title.area === area)) return false;
      equip(area);
      return true;
    },
    hasAwarded(id, attemptId) {
      const receipt = receiptFor(attemptId);
      return receipt === 'first/' + id || receipt === 'replay/' + id;
    },
    nextAwardXP(id) {
      const info = this.info(id);
      if (!info) return null;
      if (!info.cleared) return firstXP.get(id);
      refreshReceipts();
      const nextReplay = (replayCounts().get(id) || 0) + 1;
      return Math.max(1, Math.floor(firstXP.get(id) / (2 ** nextReplay)));
    },
    award(id, attemptId, replayAllowed = false) {
      const info = this.info(id);
      if (!info?.unlocked || typeof attemptId !== 'string' || !attemptId || (info.cleared && !replayAllowed)) return null;
      const firstClear = !info.cleared;
      const receipt = (firstClear ? 'first/' : 'replay/') + id;
      const previous = receiptFor(attemptId);
      // A first receipt is written before its crown. If interrupted between
      // writes, finishing this same attempt can restore the missing crown.
      if (previous && !(firstClear && previous === receipt)) return null;
      const before = this.growth();
      const xp = this.nextAwardXP(id);
      receipts.set(attemptId, receipt);
      persist(attemptKey + attemptId, receipt);
      if (firstClear && !this.complete(id)) return null;
      const title = firstClear && info.rank === 3 ? expeditionTitles.find(item => item.area === info.area) : null;
      if (title) equip(title.area);
      return { xp, firstClear, levelUp: levelProgress(before.total + xp).level > before.level, title };
    },
    reset() {
      refreshReceipts();
      const receiptIds = [...receipts.keys()];
      receipts.clear(); equippedArea = null;
      count = 0; write(); earned.clear();
      try {
        for (const id of repeats) storage?.removeItem?.(repeatKey + id);
        for (const attemptId of receiptIds) storage?.removeItem?.(attemptKey + attemptId);
        storage?.removeItem?.(titleKey);
      } catch { saved = false; }
    },
    get persisted() { return saved && Boolean(storage); }
  };
}

export const campaign = createCampaign();

export function isMissionRestricted(mission, limit) {
  return Boolean(limit && Math.max(mission.level, mission.difficulty || 1) > limit);
}

export function renderLandscape(missionId) {
  const place = places.find(item => item.missions.includes(missionId) || item.missions[0] + '_blank' === missionId) || places[0];
  const landscape = document.getElementById('landscape');
  landscape.dataset.area = place.area;
  landscape.style.backgroundImage = fieldCover(place.area);
  for (const key of ['region', 'title', 'latin']) {
    document.getElementById('place-' + key).textContent = place[key];
  }
  return place.area;
}

const crownIcon = '<svg class="mission-crown" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6.5l5.5 4.1L12 3.5l3.5 7.1L21 6.5l-2.2 10.8H5.2z"/><path d="M6 20.5h12" fill="none"/></svg>';

export function renderStampLabel(node, text, cleared = false) {
  if (node.textContent === text && node.classList.contains('has-crown') === cleared) return;
  node.classList.toggle('has-crown', cleared);
  node.textContent = text;
  if (cleared) node.insertAdjacentHTML('afterbegin', crownIcon);
}

export function destinationMenu(getMission, start, lockedLevel, currentId) {
  const list = document.createElement('div');
  list.className = 'dialog-content site-list';
  for (const [index, place] of places.entries()) {
    const stop = document.createElement('section');
    const head = document.createElement('div');
    head.className = 'trail-head';
    const photo = document.createElement('span');
    photo.className = 'site-thumb site-thumb--' + place.area;
    photo.style.backgroundImage = fieldCover(place.area);
    const title = document.createElement('h3');
    title.textContent = place.title;
    const status = document.createElement('span');
    const first = campaign.info(place.missions[0]);
    const repeatId = place.missions[0] + '_blank';
    const choices = [place.missions[0], repeatId, ...place.missions.slice(1)];
    const totalCleared = first.completed + Number(campaign.info(repeatId).cleared);
    renderStampLabel(status, totalCleared + ' / 4 クリア', totalCleared === 4);
    head.append(photo, title, status);
    stop.appendChild(head);
    if (!first.unlocked) {
      const hint = document.createElement('p');
      hint.textContent = '🔒 ' + places[index - 1].title + 'の3段階をクリアすると開くよ。';
      stop.appendChild(hint);
      const preview = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = '4つのお題をのぞく';
      const titles = document.createElement('ol');
      for (const id of choices) {
        const li = document.createElement('li');
        li.textContent = '★' + getMission(id).difficulty + ' ' + getMission(id).title + (id === repeatId ? '（白紙版）' : '');
        titles.appendChild(li);
      }
      preview.append(summary, titles); stop.appendChild(preview);
    } else {
      for (const id of choices) {
        const mission = getMission(id), state = campaign.info(id);
        const choice = document.createElement('button');
        choice.type = 'button';
        choice.dataset.mission = id;
        const restricted = isMissionRestricted(mission, lockedLevel);
        choice.disabled = !state.unlocked || Boolean(restricted);
        const status = state.cleared ? 'クリア済み' : restricted ? '先生のレベル設定中' :
          !state.unlocked ? (state.repeat ? 'お手本で開く' : '前のお題で開く') : currentId === id ? '挑戦中' : '挑戦する';
        const label = document.createElement('span');
        label.textContent = '★' + mission.difficulty + ' ' + (state.repeat ? '同じお題を白紙から' : mission.title);
        if (state.repeat) choice.setAttribute('aria-label', mission.title + '・★2 白紙から・' + status);
        const badge = document.createElement('small');
        renderStampLabel(badge, status, state.cleared);
        if (restricted && state.cleared) {
          const limit = document.createElement('small');
          limit.className = 'mission-limit';
          limit.textContent = '先生のレベル設定中';
          label.appendChild(limit);
        }
        choice.append(label, badge);
        choice.addEventListener('click', () => start(mission));
        stop.appendChild(choice);
      }
    }
    list.appendChild(stop);
  }
  return list;
}

export function showMobileView(view) {
  const workspace = document.getElementById('workspace');
  workspace.dataset.view = view;
  workspace.classList.toggle('mobile-stage', view === 'stage');
  for (const button of document.querySelectorAll('[data-mobile-view]')) {
    const active = button.dataset.mobileView === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
