const places = [
  { area: 'patagonia', mission: 'intro_square', region: 'チリ共和国 ／ パタゴニア', title: 'トーレス・デル・パイネ', latin: 'Torres del Paine National Park' },
  { area: 'namib', mission: 'sossusvlei_survey', region: 'ナミビア ／ ナミブ砂漠', title: 'ソススフレイ', latin: 'Sossusvlei, Namib Desert' },
  { area: 'yakushima', mission: 'yakushima_canopy', region: '日本 ／ 鹿児島県', title: '屋久島', latin: 'Yakushima Island' }
];

export function renderLandscape(missionId) {
  const place = places.find(item => item.mission === missionId) || places[0];
  document.getElementById('landscape').dataset.area = place.area;
  for (const key of ['region', 'title', 'latin']) {
    document.getElementById('place-' + key).textContent = place[key];
  }
  return place.area;
}

export function destinationMenu(getMission, start, lockedLevel) {
  const list = document.createElement('div');
  list.className = 'dialog-content site-list';
  for (const place of places) {
    const mission = getMission(place.mission);
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.className = 'site-choice';
    choice.disabled = Boolean(lockedLevel && mission.level > lockedLevel);
    const image = document.createElement('span');
    image.className = 'site-thumb site-thumb--' + place.area;
    image.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    const detail = document.createElement('small');
    title.textContent = place.title;
    detail.textContent = place.region + '　★' + mission.level + '　' + mission.title;
    copy.append(title, detail);
    choice.append(image, copy);
    choice.addEventListener('click', () => start(mission));
    list.appendChild(choice);
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
