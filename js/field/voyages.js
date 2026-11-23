const sail = ['sail', 'スクリューを回して進む'];
const wait = ['wait', 'その場で潮を待つ'];
const sample = ['sample', '土を採って記録する'];
const pass = ['skip', 'そのまま通りすぎる'];

const palauLessons = [
  {
    title: '小舟を 島のさんばしへ', goal: 'スクリューを回して、小舟を向こうの島に着けよう。',
    hint: '「さんばしに着くまで」を「スクリューを回して進む」に変えてみよう。',
    lines: [{ label: 'さんばしに着くまで', options: [wait, sail], initial: 'wait' }],
    criteria: ['スクリューで進んだ', '島のさんばしに着いた']
  },
  {
    title: '浅瀬で 潮を待とう', goal: '水が引くと浅瀬の岩が出るよ。岩に当たらず島に着こう。',
    hint: '「浅瀬の水が少ない」ときだけ、その場で潮を待とう。水が増えたら進めるよ。',
    lines: [
      { label: 'もし', options: [['reefLow', '次が浅瀬で水が少ない'], ['reefHigh', '次が浅瀬で水が多い']], initial: 'reefLow' },
      { label: 'そのときは', options: [sail, wait], initial: 'sail' },
      { label: 'それ以外は', options: [sail, wait], initial: 'sail' }
    ],
    criteria: ['水が多いときに浅瀬をこえた', '岩に当たらず島に着いた']
  },
  {
    title: '二つの浅瀬の 配達船', goal: '潮のちがう2回の航海で、二つの浅瀬をこえ、島に荷物を届けよう。',
    hint: '浅瀬の水が少ないときは待とう。さんばしに着いたら、荷物を下ろすのも忘れずに。',
    lines: [
      { label: 'もし', options: [['reefHigh', '次が浅瀬で水が多い'], ['reefLow', '次が浅瀬で水が少ない']], initial: 'reefHigh' },
      { label: 'そのときは', options: [wait, sail], initial: 'wait' },
      { label: 'それ以外は', options: [sail, wait], initial: 'sail' },
      { label: 'さんばしに着いたら', options: [['keep', '船に荷物を残す'], ['unload', '島に荷物を下ろす']], initial: 'keep' }
    ],
    criteria: ['二つの浅瀬を安全にこえた', 'さんばしで荷物を下ろした']
  }
];

function boatStart(rank, variant, input) {
  return {
    position: 0, previous: 0, time: 0, tideOffset: (variant ? 2 : 0) + (input === 'later' ? 1 : 0),
    end: [0, 2, 3, 5][rank], reefs: [[], [], [2], [2, 4]][rank], crossed: 0,
    grounded: false, delivered: false, ended: false, action: 'ready'
  };
}

const waterLevel = time => [-1, -.65, .85, 1][time % 4];
function boatStep(s, program, rank) {
  if (s.ended) return;
  s.previous = s.position;
  const reef = s.reefs.includes(s.position + 1);
  const high = waterLevel(s.time + s.tideOffset) > 0;
  if (s.position === s.end) {
    s.delivered = program[3] === 'unload';
    s.action = s.delivered ? 'delivered' : 'missed';
    s.ended = true;
  } else {
    const condition = reef && (program[0] === 'reefLow' ? !high : high);
    s.action = rank === 1 ? program[0] : program[condition ? 1 : 2];
    if (s.action === 'sail') {
      if (reef && !high) {
        s.grounded = true;
        s.ended = true;
      } else {
        s.position++;
        if (reef) s.crossed++;
        if (s.position === s.end && rank < 3) s.ended = true;
      }
    }
  }
  s.time++;
  if (s.time >= s.end * 3 + 3) s.ended = true;
}

function boatStatus(s) {
  if (s.grounded) return '浅瀬で岩に当たったよ。水が増えるまで待とう。';
  if (s.delivered) return '島に荷物が届いたよ！';
  if (s.action === 'missed') return 'さんばしに着いたよ。荷物はまだ船の中だ。';
  if (s.position === s.end) return '島のさんばしに着いたよ。';
  if (s.ended) return '航海の時間がおわったよ。進む指令を見直そう。';
  const tide = waterLevel(s.time + s.tideOffset) > 0 ? '水が多い' : '水が少ない';
  const next = s.reefs.includes(s.position + 1) ? '次は浅瀬' : '次は深い海';
  return next + '・' + tide + '　島まであと' + (s.end - s.position) + '区間';
}

const roverLessons = [
  {
    title: '観測車の 最初のサンプル', goal: '車輪を回して観測の旗まで行き、土を一つ採って記録しよう。',
    hint: '「基地を出るとき」を「車輪を回す」にしよう。旗に着いたら土を採るよ。',
    lines: [
      { label: '基地を出るとき', options: [['park', '基地で止まる'], ['drive', '車輪を回す']], initial: 'park' },
      { label: '旗に着いたら', options: [sample, pass], initial: 'sample' }
    ], criteria: ['観測の旗まで走った', '土を採って記録した']
  },
  {
    title: '三つの旗の 観測ノート', goal: '観測車を一周させ、三つの旗の記録を基地に持ち帰ろう。',
    hint: '旗に着くたびに土を採ろう。三つ目の旗からは、帰り道が基地につながるよ。',
    lines: [
      { label: '旗に着くたびに', options: [pass, sample], initial: 'skip' },
      { label: '三つ目の旗をすぎたら', options: [['stay', '旗で待つ'], ['home', '帰り道で基地へ']], initial: 'home' }
    ], criteria: ['別々の旗で三つ記録した', '記録を持って基地に帰った']
  },
  {
    title: '電池を守る 帰り道', goal: '出発時の電池がちがう2回の探検で、三つの旗の記録を基地に届けよう。',
    hint: 'ふつう走行は電池を2こ、省エネ走行と土の採取は1こ使うよ。残りが5こ以下で省エネに切りかえてみよう。',
    lines: [
      { label: 'もし 電池の残りが', options: [['2', '2こ以下'], ['5', '5こ以下'], ['1', '1こ以下']], initial: '2' },
      { label: 'そのときの車輪は', options: [['eco', '省エネ走行（電池1こ）'], ['fast', 'ふつう走行（電池2こ）']], initial: 'eco' },
      { label: 'それ以外の車輪は', options: [['fast', 'ふつう走行（電池2こ）'], ['eco', '省エネ走行（電池1こ）']], initial: 'fast' },
      { label: '旗に着いたら', options: [sample, pass], initial: 'sample' }
    ], criteria: ['三つの観測地点で土を採った', '電池が切れる前に基地に帰った']
  }
];

function roverStart(rank, variant) {
  return { position: 0, previous: 0, time: 0, energy: rank === 3 ? (variant ? 9 : 10) : 12,
    alternateRoute: Boolean(variant), samples: [], ended: false, stranded: false, wheel: 0, lastWheel: 0, action: 'ready' };
}

function roverStep(s, program, rank) {
  if (s.ended) return;
  s.previous = s.position;
  s.lastWheel = s.wheel;
  s.time++;
  const flag = s.position >= 1 && s.position <= 3;
  if (flag && s.action === 'drive') {
    const collect = (rank === 1 ? program[1] : rank === 2 ? program[0] : program[3]) === 'sample';
    if (collect && s.energy < 1) { s.stranded = true; s.ended = true; return; }
    if (collect) { s.energy--; s.samples.push(s.position); }
    s.action = collect ? 'sample' : 'skip';
    if (rank === 1) s.ended = true;
    return;
  }
  if ((rank === 1 && program[0] !== 'drive') || (rank === 2 && s.position === 3 && program[1] !== 'home')) {
    s.action = 'park'; s.ended = true; return;
  }
  const mode = rank === 3 ? program[s.energy <= Number(program[0]) ? 1 : 2] : 'fast';
  const cost = mode === 'eco' ? 1 : 2;
  if (s.energy < cost) { s.stranded = true; s.ended = true; return; }
  s.energy -= cost;
  s.wheel += 1;
  s.position++;
  s.action = 'drive';
  if (s.position === 4) s.ended = true;
}

function roverStatus(s) {
  const power = '電池 ' + s.energy + 'こ';
  if (s.stranded) return power + '　次の動作に足りないよ。省エネに切りかえよう。';
  if (s.position === 4) return '基地に帰ったよ。観測ノートに記録が' + s.samples.length + 'つ。';
  const place = s.position === 0 ? '基地' : s.position + '番の旗';
  const event = s.action === 'sample' ? '土を記録' : s.action === 'skip' ? '採取せず通過' : s.action === 'park' ? '停車中' : '観測車';
  return place + '・' + event + '　' + power + ' ／ 記録 ' + s.samples.length + 'つ';
}

// The same artwork is used for the live field, its cover and map thumbnail.
const paths = new Map();
function paint(c, data, fill, stroke, width = 1) {
  if (!paths.has(data)) paths.set(data, new Path2D(data));
  const path = paths.get(data);
  if (fill) { c.fillStyle = fill; c.fill(path); }
  if (stroke) { c.lineWidth = width; c.strokeStyle = stroke; c.stroke(path); }
}
function tint(c, y, h, top, bottom) {
  const color = c.createLinearGradient(0, y, 0, y + h);
  color.addColorStop(0, top); color.addColorStop(1, bottom);
  c.fillStyle = color; c.fillRect(0, y, 480, h);
}
function dot(c, x, y, r, fill) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
}
function island(c, x, y, size) {
  c.save(); c.translate(x, y); c.scale(size, size);
  paint(c, 'M-63 3Q-51-4-49-22Q-43-54-29-46Q-18-82-4-57Q3-65 14-44Q29-47 37-26Q45-25 52-7L62 2Z', '#32665a');
  paint(c, 'M-48-22Q-39-52-28-40Q-19-72-8-57Q-27-52-29-30Q-38-34-48-17ZM0-49Q11-63 20-34Q12-47 2-39Z', '#649371');
  paint(c, 'M-54-5Q-27-10-7-3T52-5L47 2 20 6-24 4-47 8Z', '#aeaa84');
  paint(c, 'M-66 7q26-3 45-1t80-1', null, '#a1e3ce', 2);
  c.restore();
}
function flag(c, x, y, marked) {
  c.save(); c.translate(x, y);
  paint(c, 'M0 0V-24', null, '#465058', 2);
  paint(c, 'M1-24l17 5-17 6z', marked ? '#1a715a' : '#de7138');
  if (marked) paint(c, 'M4-19l2 2 4-4', null, '#fff9dd', 1.6);
  c.restore();
}
const interpolate = (previous, current, phase) => previous + (current - previous) * phase;

function drawBoat(c, s, rank, phase = 1) {
  const clock = Math.max(0, s.time - 1) + s.tideOffset;
  const level = s.time ? interpolate(waterLevel(clock), waterLevel(clock + 1), phase) : waterLevel(clock);
  const surface = 158 - level * 5;
  const xAt = i => 45 + 370 * i / s.end;
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  tint(c, 0, 142, '#8dcfc9', '#e3e9c6');
  dot(c, 353, 41, 16, '#fff2c0');
  paint(c, 'M0 116q43-18 73-9t64-5q46-28 89 1t87-4q63-26 111 3t56 2v29H0Z', '#7aa89a');
  tint(c, 116, 154, '#379d9b', '#428c93');
  island(c, 28, 126, 1.28); island(c, 284, 119, .56); island(c, 440, 134, 1.45);
  paint(c, 'M0 163Q94 139 183 157t165-2 132-7v46q-80 22-173 0t-174 18T0 213Z', '#69bfb0');
  paint(c, 'M0 239q88 3 154-20t145-9 181-16', null, '#80c6b6', 2);
  for (let i = 0; i < 21; i++) {
    const x = i * 73 % 473, y = 130 + (i * 29 % 128);
    c.fillStyle = i % 2 ? '#92d4c2' : '#64b3af'; c.fillRect(x, y, 7 + i % 8, 1.4);
  }
  for (const index of s.reefs) {
    c.save(); c.translate(xAt(index), 166); c.scale(.94, 1);
    paint(c, 'M-35 9q26-19 65-3l9 7q-35 9-74-4Z', '#90c5a4');
    c.globalAlpha = level > 0 ? .42 : 1;
    paint(c, 'M-18 1l8-12 13 2 10 13ZM6 4l13-8 7 7Z', level > 0 ? '#539f96' : '#a58b69');
    c.globalAlpha = 1;
    paint(c, 'M-27 7q10-3 16 0m19 2 18-2', null, '#cff1d7', 1.6); c.restore();
  }
  c.fillStyle = '#7c674d'; c.fillRect(416, 149, 46, 4); c.fillRect(422, 153, 4, 16); c.fillRect(448, 153, 4, 16);
  flag(c, 451, 149, s.delivered);
  if (s.delivered) { c.fillStyle = '#efa849'; c.fillRect(432, 139, 12, 10); }
  const travel = interpolate(s.previous, s.position, phase);
  const moving = s.position !== s.previous && phase < 1;
  c.save(); c.translate(xAt(travel), surface + 4 - (moving ? Math.sin(phase * Math.PI) * 2 : 0));
  if (moving) paint(c, 'M-17 3q-9-2-20 2m18 2-13 2', null, '#e6f6db', 1.8);
  paint(c, 'M-22-3h44L12 6h-27z', '#174e59'); paint(c, 'M-21-4h43l-3 3h-37z', '#f5e3ab');
  paint(c, 'M-12-4l2-12H6l7 12', '#f9e5b1', '#255d60', 1.4);
  paint(c, 'M-7-13h5v6h-6zm8 0h4l4 6H1Z', '#4f9190');
  paint(c, 'M-16-2l-4 7-4 1', null, '#244850', 2);
  c.save(); c.translate(-23, 6); c.rotate(travel * Math.PI * 5);
  paint(c, 'M-1 0q-5-6-3-7 5 2 5 7 4 5 2 7-4-2-4-7Z', '#f5c069'); c.restore();
  if (rank === 3 && !s.delivered) { c.fillStyle = '#eaa448'; c.fillRect(11, -10, 8, 6); }
  c.restore(); c.restore();
}

const roverRoutes = [
  [[42,195], [157,164], [267,182], [384,155], [42,195]],
  [[42,195], [135,187], [237,158], [397,178], [42,195]]
];
function drawRover(c, s, rank, phase = 1) {
  const roverRoute = roverRoutes[Number(s.alternateRoute)];
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  tint(c, 0, 146, '#839ead', '#f1dfbc'); dot(c, 90, 40, 13, '#f8e6b8');
  paint(c, 'M0 113 71 65 99 74 155 42 217 94 271 51 305 73 357 34 423 86 480 62V162H0Z', '#99a4a4');
  paint(c, 'M40 89l31-24 17 8-12-3-10 9-3-4zm68-8 47-39 25 23-23-12-11 13-2-5zm208-7 41-40 32 25-31-14-17 17 3-9z', '#e4e5d7');
  paint(c, 'M0 136 79 103 116 112 199 70 223 84 293 106 374 66 433 113 480 107V167H0Z', '#8c8078');
  paint(c, 'M98 120l101-50-39 36zm202-11 74-43-18 23z', '#b0a18d');
  tint(c, 139, 131, '#c2ae8c', '#9c816c');
  paint(c, 'M0 165q119-25 215-5t265-17m-480 84q70-21 145-14t150-6 185 1', null, '#d4be9b', 3);
  paint(c, 'M0 243 42 224 93 227 104 220 163 218 112 230 57 232Z', '#b7a68e');
  for (let i = 0; i < 26; i++) {
    const x = (i * 67 + 13) % 478, y = 149 + (i * 17 % 115);
    c.fillStyle = i % 3 ? '#988673' : '#d5c5a7'; c.fillRect(x, y, 2 + i % 6, 2);
  }
  c.setLineDash([4,6]); c.strokeStyle = '#776955'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(...roverRoute[0]); c.lineTo(...roverRoute[1]);
  if (rank > 1) { c.lineTo(...roverRoute[2]); c.lineTo(...roverRoute[3]); c.quadraticCurveTo(239, 251, ...roverRoute[4]); }
  c.stroke(); c.setLineDash([]);
  paint(c, 'M16 183v-19l14-10 20 11v19z', '#e4d8b6', '#665c54', 1.4);
  paint(c, 'M13 165l17-13 23 12-3 4-20-11-14 11z', '#9d523b');
  c.fillStyle = '#536368'; c.fillRect(27, 173, 9, 11);
  for (let i = 1; i <= (rank === 1 ? 1 : 3); i++) {
    const [x,y] = roverRoute[i]; flag(c,x+7,y-3,s.samples.includes(i));
    c.fillStyle = '#fff4db'; c.fillRect(x+10, y-11, 12, 12);
    c.fillStyle='#544c43'; c.font='bold 10px sans-serif'; c.textAlign='center'; c.fillText(String(i),x+16,y-2);
  }
  const [x0,y0] = roverRoute[s.previous], [x1,y1] = roverRoute[s.position];
  const returning = s.position === 4 && s.previous !== 4;
  const x = returning ? (1-phase)**2*x0+2*(1-phase)*phase*239+phase**2*x1 : interpolate(x0,x1,phase);
  const y = returning ? (1-phase)**2*y0+2*(1-phase)*phase*251+phase**2*y1 : interpolate(y0,y1,phase);
  c.save(); c.translate(x,y-4); if (s.position === 4) c.scale(-1,1);
  paint(c, 'M-18-12l5-9h16l9 8 7 2v9h-39z', '#dc853b', '#5a514a', 1.6);
  paint(c, 'M-9-18H2l6 6H-12Z', '#49666d');
  paint(c, 'M-9-21v-9l-5-3m21 16 5-10 6-2', null, '#4c5653', 1.7);
  const wheel = interpolate(s.lastWheel,s.wheel,phase);
  for (const axle of [-12, 11]) {
    dot(c,axle,0,6,'#383d3c'); dot(c,axle,0,3.4,'#a49c86');
    c.save(); c.translate(axle,0); c.rotate(wheel*7); paint(c,'M0-3v6',null,'#5c5b53',1.6); c.restore();
  }
  if (s.action === 'sample') paint(c,'M16-9l6 5 3 7',null,'#363e3c',2);
  c.restore();
  if (rank === 3) {
    c.fillStyle = '#f6ebd7'; c.fillRect(335,17,122,23); c.fillStyle = '#334e4b'; c.fillRect(341,22,106,13); c.fillRect(447,26,3,5);
    for (let i = 0; i < s.energy; i++) { c.fillStyle = s.energy < 4 ? '#e8a260' : '#a4c095'; c.fillRect(344+i*10,25,7,7); }
  }
  c.restore();
}

export const voyages = [
  {
    id: 'palau', lessons: palauLessons, create: boatStart, step: boatStep,
    finished: s => s.ended, checks(s, rank) {
      const arrived = s.position === s.end && !s.grounded;
      if (rank === 1) return [s.position > 0, arrived];
      return [s.crossed === s.reefs.length, rank === 3 ? arrived && s.delivered : arrived];
    }, draw: drawBoat, status: boatStatus,
    inputs: rank => rank === 3 ? [{value:'now',label:'いま出発'}, {value:'later',label:'1拍あとに出発'}] : [],
    inputLabel: input => input === 'later' ? '1拍あとに出発' : 'いま出発'
  },
  {
    id: 'mcmurdo', lessons: roverLessons, create: roverStart, step: roverStep,
    finished: s => s.ended, checks(s, rank) {
      if (rank === 1) return [s.position === 1, s.samples.length === 1];
      return [s.samples.length === 3, s.position === 4 && s.samples.length === 3 && !s.stranded];
    }, draw: drawRover, status: roverStatus
  }
];
