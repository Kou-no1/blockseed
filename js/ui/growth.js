import { firstClearXP } from '../expedition.js';

const skills = {
  patagonia: ['白紙から四角い道を描けた', '80歩ずつ進んで大きな四角を描けた', '短い辺と長い辺をくり返して長方形を描けた'],
  namib: ['曲がる角度を決めて正三角形を描けた', '5回のくり返しで正五角形を描けた', '角度と回数を組み合わせて正六角形を描けた'],
  yakushima: ['暗いときだけライトをつけられた', '人がいるときだけライトをつけられた', '明るさと人感の2つの条件を組み合わせられた'],
  mulu: ['手をたたいた音を1拍あとに返せた', '音が鳴るたびに1拍あとで返せた', '音と休みを順番に記録して再生できた'],
  galapagos: ['カメが来たときに写真を撮れた', '岩とカメを見分けて写真を撮れた', '写真の記録を調べて1匹ずつ撮れた'],
  uyuni: ['岸から同じきょりに星をうつせた', 'くり返しを使って三つ星をうつせた', '星が動くたびに水面の星も動かせた'],
  palau: ['スクリューを回して小舟を島に着けられた', '潮を待って浅瀬を通れた', '潮のちがう2回の航海で荷物を届けられた'],
  aoraki: ['望遠鏡を動かして星にねらいを合わせられた', '2拍ごとに星の写真を撮れた', '雲が晴れたときだけ星の写真を撮れた'],
  mcmurdo: ['観測車を動かして土を記録できた', '3つの旗の記録を基地に届けられた', '電池に合わせて走り方を切りかえられた']
};

function showGauge(element, growth) {
  element.style.setProperty('--xp-fill', (100 * growth.within / growth.needed) + '%');
}

export function renderGrowth(growth) {
  const button = document.getElementById('growth-btn');
  const title = growth.equipped?.name;
  document.getElementById('growth-level').textContent = 'Lv.' + growth.level;
  document.getElementById('growth-title').textContent = title || '探検レベル';
  document.getElementById('growth-remaining').textContent = 'あと' + growth.remaining + ' XP';
  button.setAttribute('aria-label', '探検レベル' + growth.level + (title ? '、称号「' + title + '」' : '') +
    '。次のレベルまであと' + growth.remaining + ' XP。経験値と称号を見る');
  showGauge(button, growth);
  const profile = document.getElementById('growth-profile');
  if (profile) fillProfile(profile, growth);
}

function titleCard(title, equipped) {
  const card = document.createElement('li');
  card.className = 'growth-title-card';
  const place = document.createElement('small');
  place.textContent = title.place;
  const name = document.createElement('strong');
  name.textContent = title.name;
  const skill = document.createElement('p');
  skill.textContent = title.skill;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.titleArea = title.area;
  button.setAttribute('aria-pressed', String(equipped));
  button.setAttribute('aria-label', '称号「' + title.name + '」をつける');
  button.textContent = equipped ? '表示中' : 'つける';
  card.append(place, name, button, skill);
  return card;
}

function fillProfile(profile, growth) {
  profile.querySelector('.growth-summary-top strong').textContent = 'Lv.' + growth.level;
  profile.querySelector('#growth-total').textContent = '合計 ' + growth.total + ' XP';
  profile.querySelector('.growth-summary-bottom strong').textContent = '次のレベルまであと' + growth.remaining + ' XP';
  profile.querySelector('.growth-summary-bottom span').textContent = growth.within + ' / ' + growth.needed + ' XP';
  showGauge(profile.querySelector('.growth-gauge'), growth);
  profile.querySelector('.growth-collection-head span').textContent = growth.titles.length + ' / 9';
  profile.querySelector('.growth-collection-note').textContent = growth.titles.length
    ? 'つけたい称号をえらんでね。' : '秘境の★3をクリアすると、ここに称号が集まるよ。';
  const list = profile.querySelector('.growth-titles');
  const focused = list.contains(document.activeElement) && document.activeElement.dataset.titleArea;
  list.replaceChildren(...growth.titles.map(title => titleCard(title, growth.equipped?.area === title.area)));
  if (focused) Array.from(list.querySelectorAll('button')).find(button => button.dataset.titleArea === focused)?.focus();
}

export function showGrowth(dialogs, growth, chooseTitle) {
  const profile = document.createElement('div');
  profile.id = 'growth-profile';
  profile.className = 'dialog-content growth-profile';
  profile.innerHTML = `
    <div class="growth-summary">
      <div class="growth-summary-top"><strong></strong><span id="growth-total"></span></div>
      <span class="growth-gauge" aria-hidden="true"><i></i></span>
      <div class="growth-summary-bottom"><strong></strong><span></span></div>
    </div>
    <div class="growth-collection-head"><h3>集めた称号</h3><span></span></div>
    <p class="growth-collection-note"></p>
    <ul class="growth-titles" aria-label="秘境で手に入れた称号"></ul>
    <details class="growth-rules"><summary tabindex="0">経験値（XP）のもらい方</summary>
      <p>初めてクリアしたときにもらえるXP</p>
      <dl class="growth-payouts"></dl>
      <p>「もう一度挑戦」でクリアするたびに、もらえるXPは半分ずつになり、最後は毎回1 XPになるよ。</p>
    </details>`;
  const payouts = profile.querySelector('.growth-payouts');
  for (const [label, amount] of [
    ['★1　お手本を動かす', firstClearXP.guided], ['★2　同じお題を白紙から', firstClearXP.blank],
    ['★2　新しいお題に応用', firstClearXP.applied], ['★3　技を組み合わせる', firstClearXP.final]
  ]) {
    const kind = document.createElement('dt');
    kind.textContent = label;
    const xp = document.createElement('dd');
    xp.textContent = amount + ' XP';
    payouts.append(kind, xp);
  }
  fillProfile(profile, growth);
  profile.addEventListener('click', event => {
    const button = event.target.closest('button[data-title-area]');
    if (button && button.getAttribute('aria-pressed') !== 'true') chooseTitle(button.dataset.titleArea);
  });
  return dialogs.show({ title: '探検レベルと称号', content: profile, buttons: [{ label: 'とじる', value: false }] });
}

export function showGrowthAward(award, mission, growth) {
  const region = document.getElementById('toast-region');
  region.querySelector('.growth-award')?.remove();
  const notice = document.createElement('div');
  notice.className = 'toast growth-award';
  const head = document.createElement('div');
  head.className = 'growth-award-head';
  const xp = document.createElement('strong');
  xp.textContent = '＋' + award.xp + ' XP';
  const status = document.createElement('span');
  status.textContent = award.levelUp ? 'レベルアップ！ Lv.' + growth.level : 'お題クリア！';
  head.append(xp, status);
  const skill = document.createElement('p');
  skill.textContent = mission.buildFromBlank ? skills[mission.area][mission.rank - 1] : '「' + mission.title + '」のお手本を動かせた';
  notice.append(head, skill);
  if (award.title) {
    const title = document.createElement('p');
    title.className = 'growth-award-title';
    title.textContent = '称号「' + award.title.name + '」を手に入れた！';
    notice.appendChild(title);
  }
  region.appendChild(notice);
  window.setTimeout(() => notice.remove(), award.title ? 7500 : 5000);
}
