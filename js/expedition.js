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

export function createCampaign(storage) {
  let count = 0;
  let saved = true;
  const earned = new Set();
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
    try { storage.setItem(progressKey, String(count)); saved = true; }
    catch { saved = false; }
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
        try { storage.setItem(repeatKey + id, 'earned'); } catch { saved = false; }
        return true;
      }
      if (count >= trail.length || trail[count] !== id) return false;
      count++;
      write();
      return true;
    },
    reset() {
      count = 0; write(); earned.clear();
      try { for (const id of repeats) storage?.removeItem?.(repeatKey + id); } catch { saved = false; }
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
