const line = (label, options, initial) => ({ label, options, initial });
const lesson = (title, goal, hint, lines, criteria) => ({ title, goal, hint, lines, criteria });

const waterline = 134;
const mirrorRule = initial => line('水面の星を置く場所', [
  ['edge', '岸のすぐ下'], ['mirror', '空の星と同じきょりだけ下'], ['half', '半分のきょりだけ下']
], initial);

function skyStars(rank, variant, input) {
  const group = rank === 1 ? [[236, 76]] : [[107, 92], [231, 45], [358, 81]];
  if (rank === 3) {
    if (input && Number.isFinite(input.x) && Number.isFinite(input.y)) group[0] = [input.x, input.y];
    if (variant) group.forEach(point => { point[0] = 480 - point[0]; point[1] += 8; });
  }
  return group;
}

function mirrorComplete(s) {
  return s.stars.every(([x,y], i) => {
    const spot = s.copies[i];
    return spot && spot[0] === x && spot[1] === 2 * waterline - y;
  });
}

const uyuni = {
  id: 'uyuni',
  lessons: [
    lesson('星ひとつの 水かがみ', '空の金色の星を、水面の線の真下にうつそう。線からのきょりは上下で同じだよ。',
      '空の星は岸から遠くにあるね。水面の星も同じきょりだけ下へ置こう。', [mirrorRule('edge')],
      ['水に星を1個うつした', '岸から上下に同じきょりになった']),
    lesson('水面にうかぶ 三つ星', '星を順番にうつして、水面に同じ形の三つ星を作ろう。',
      '金色の星を数えよう。星を1個うつす命令を、その数だけくり返してみよう。', [
        line('くり返す回数', [['1','1回'],['2','2回'],['3','3回']], '1'), mirrorRule('mirror')
      ], ['3個すべてをうつした', '3個とも上下対称になった']),
    lesson('動く星を おいかける鏡', '星の位置が変わったら、水面の星もついてくる鏡を作ろう。空をタップして最初の星を動かせるよ。',
      '1回写して終わると、星が動いたあとに水面がずれてしまうよ。', [
        line('三つ星をうつすタイミング', [['once','はじめに1回'],['each','星が動くたび']], 'once'), mirrorRule('mirror')
      ], ['最初の星座を対称にうつした', '動いたあとの星座も対称になった'])
  ],
  inputs: rank => rank === 3 ? [{value:'left',label:'左の空に星を置く'}, {value:'right',label:'右の空に星を置く'}] : [],
  configure: value => value === 'right' ? {x:388, y:54} : {x:83, y:53},
  tap(s, x, y, rank, input) {
    if (rank !== 3 || y > waterline - 10 || !Number.isFinite(x) || !Number.isFinite(y)) return input;
    return { x: Math.max(25, Math.min(455, Math.round(x))), y: Math.max(26, Math.min(120, Math.round(y))) };
  },
  inputLabel: (input, rank) => rank === 3 && input ? '星の位置を変えたよ' : '',
  create(rank, variant, input) {
    return { stars: skyStars(rank, variant, input), copies: [], previous: [], written: [], beat: 0, first: false, moved: false };
  },
  step(s, program, rank, variant) {
    if (uyuni.finished(s, rank)) return;
    if (rank === 3 && s.beat === 3) {
      s.first = mirrorComplete(s);
      s.stars = s.stars.map(([x,y], i) => [
        Math.max(22, Math.min(458, x + (variant ? -1 : 1) * (i === 1 ? -35 : 34))),
        y < 70 ? y + 21 : y - 21
      ]);
      s.moved = true;
    }
    const i = s.beat % s.stars.length;
    const rule = program[rank === 1 ? 0 : 1];
    if ((rank !== 2 || i < Number(program[0])) && (rank !== 3 || s.beat < 3 || program[0] === 'each')) {
      const [x,y] = s.stars[i];
      s.previous[i] = s.copies[i] || [x,waterline];
      s.written[i] = s.beat + 1;
      const distance = waterline - y;
      s.copies[i] = [x, waterline + (rule === 'mirror' ? distance : rule === 'half' ? distance / 2 : 5)];
    }
    s.beat++;
  },
  finished: (s, rank) => s.beat >= (rank === 3 ? 6 : s.stars.length),
  checks(s, rank) {
    return rank === 3 ? [s.first, s.moved && mirrorComplete(s)] : [s.copies.filter(Boolean).length === s.stars.length, mirrorComplete(s)];
  },
  status(s, rank) {
    if (rank === 3 && s.moved) return mirrorComplete(s) ? '動いた星と水面の星がそろったよ' : '星が動いたよ。水面を見てみよう';
    return '空の星 ' + s.stars.length + '個 ／ 水面の星 ' + s.copies.filter(Boolean).length + '個';
  },
  draw: drawUyuni
};

const aimLine = line('望遠鏡の向きを変える', [['left','左へ1目もり'],['stay','今の向きのまま'],['right','右へ1目もり']], 'stay');
const cloudTimes = [
  [false,true,true,false,true,false], [true,false,false,true,false,true],
  [true,true,false,false,false,true], [true,false,true,false,true,false],
  [false,false,true,true,false,true]
];

function observedStar(beat) {
  return [290 + (beat % 6) * 20, 77 - (beat % 6) * 6];
}
const aoraki = {
  id: 'aoraki',
  lessons: [
    lesson('望遠鏡を 星にむけよう', '金色の星を望遠鏡の丸いわくの真ん中に入れよう。',
      '丸いわくの右に金色の星があるよ。望遠鏡の向きを1目もり変えよう。', [aimLine], ['望遠鏡を動かした', '金色の星がわくの中央に入った']),
    lesson('星を3まい 撮ろう', '1・3・5拍目にシャッターを切って、動く星を3枚の写真に残そう。',
      '1拍目から撮影を始めるよ。次の撮影は何拍あとかな？', [
        line('シャッターを切る間かく', [['1','1拍ごと'],['2','2拍ごと'],['3','3拍ごと']], '1')
      ], ['写真をちょうど3枚残した', '1・3・5拍目の星の動きを記録した']),
    lesson('雲の切れ間の 写真館', '雲が星をかくしたら待とう。ちがう2つの夜空で、晴れた写真を3枚ずつ集めよう。',
      '雲が出ている間はシャッターを休ませよう。はじめに雲が来る夜でも同じ命令で試してみよう。', [
        line('シャッターを切る条件', [['any','どんな空でも'],['clear','星が見えたら'],['cloud','雲にかくれたら']], 'any')
      ], ['写真を3枚撮った', '3枚とも星が見えている'])
  ],
  inputs: rank => rank === 3 ? [{value:'early',label:'早めに雲が来る夜'}, {value:'late',label:'あとから雲が来る夜'}] : [],
  configure: value => value,
  inputLabel: (input, rank) => rank === 3 && input ? (input === 'early' ? '早めに雲が来る夜' : 'あとから雲が来る夜') : '',
  create(rank, variant, input) {
    const index = input === 'late' && variant ? 4 : Number(Boolean(variant)) + (input === 'early' ? 2 : 0);
    const weather = cloudTimes[index];
    return {beat:0, star:observedStar(0), before:observedStar(0), aim:[240,77], shots:[], weather,
      cloudy:rank === 3 && weather[0], moved:false, flash:false};
  },
  step(s, program, rank) {
    if (aoraki.finished(s, rank)) return;
    s.before = s.star;
    s.star = observedStar(s.beat);
    s.cloudy = rank === 3 && s.weather[s.beat];
    s.flash = false;
    if (rank === 1) {
      const distance = program[0] === 'right' ? 50 : program[0] === 'left' ? -50 : 0;
      s.aim = [240 + distance, 77];
      s.moved = distance !== 0;
    } else {
      s.aim = s.star;
      const shoot = rank === 2 ? s.beat % Number(program[0]) === 0 :
        (program[0] === 'any' || (program[0] === 'cloud' ? s.cloudy : !s.cloudy)) && s.shots.length < 3;
      if (shoot) { s.shots.push({beat:s.beat+1, cloudy:s.cloudy, point:s.star.slice()}); s.flash = true; }
    }
    s.beat++;
  },
  finished: (s, rank) => s.beat >= [1,5,6][rank-1],
  checks(s, rank) {
    if (rank === 1) return [s.moved, s.moved && s.aim[0] === s.star[0]];
    const three = s.shots.length === 3;
    return [three, three && (rank === 2 ? s.shots.every((shot,i) => shot.beat === 1+2*i) : s.shots.every(shot => !shot.cloudy))];
  },
  status(s, rank) {
    if (rank === 1) return s.aim[0] === s.star[0] ? '星がわくの真ん中に入ったよ' : '望遠鏡のわくと金色の星を合わせよう';
    return '撮影 ' + s.shots.length + '枚 ／ ' + (s.beat || 1) + '拍目' + (rank === 3 ? (s.cloudy ? '・雲が通過中' : '・晴れ') : '');
  },
  draw: drawAoraki
};

export const sky = [uyuni, aoraki];

function fillSky(c, colors, height) {
  const grad = c.createLinearGradient(0,0,0,height);
  colors.forEach(([stop,color]) => grad.addColorStop(stop,color));
  c.fillStyle = grad;
  c.fillRect(0,0,480,270);
}
function path(c, points, color) {
  c.beginPath();
  points.forEach(([x,y],i) => i === 0 ? c.moveTo(x,y) : c.lineTo(x,y));
  c.closePath(); c.fillStyle = color; c.fill();
}
function linePath(c, points, color, width = 1) {
  c.beginPath();
  points.forEach(([x,y],i) => i === 0 ? c.moveTo(x,y) : c.lineTo(x,y));
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}
function star(c, x,y,size,color) {
  c.save(); c.translate(x,y);
  path(c, [[0,-size],[size*.24,-size*.24],[size*.77,0],[size*.24,size*.23],[0,size],[-size*.24,size*.23],[-size*.77,0],[-size*.24,-size*.24]],color);
  c.restore();
}
function specks(c) {
  for (let i=0;i<66;i++) {
    c.fillStyle = i%5 ? '#d9e5f49c' : '#dedcb3';
    const x = (i*149 + i*i*3 + 27) % 479, y = (i*19 + i*i + 8) % 108;
    c.fillRect(x,y,i%6 ? 1 : 1.8,1.35);
  }
}
function peakRow(c, points, base, color) {
  path(c, [[0,base], ...points, [480,base]], color);
}
function drawUyuni(c,s,rank,phase) {
  fillSky(c, [[0,'#162f58'],[.32,'#536d98'],[.495,'#f5c7a3'],[.5,'#cdb3ae'],[1,'#457797']],270);
  specks(c);
  const ridge=[[0,128],[32,126],[72,130],[103,126],[135,128],[181,119],[192,120],[212,107],[217,109],[230,121],[252,125],[275,124],[322,129],[377,125],[396,121],[436,127],[480,124]];
  peakRow(c, ridge, waterline, '#756c80');
  c.save();
  c.translate(0,2*waterline); c.scale(1,-1); peakRow(c,ridge,waterline,'#8c8a9a'); c.restore();
  linePath(c,[[0,waterline],[480,waterline]],'#ffe1b7',1.6);
  for (let i=0;i<19;i++) {
    const x=(i*133+71)%479, y=147+(i*i*9)%116;
    linePath(c,[[x-5,y],[x+4+i%6,y]],'#bdd8dd66');
  }
  // In the foreground the pale salt shows through the shallow water.
  linePath(c,[[0,223],[47,215],[80,224],[110,219],[142,234],[122,252],[66,257],[44,270]],'#bad6d67d');
  linePath(c,[[80,224],[66,246],[66,257]],'#bad6d659');
  linePath(c,[[297,270],[324,251],[378,257],[398,239],[440,235],[480,246]],'#bad6d659');
  if (s.stars.length > 1) linePath(c,s.stars,'#f4dca85e');
  s.stars.forEach(([x,y],i) => {
    const spot = s.copies[i];
    c.save(); c.setLineDash([3,5]); linePath(c,[[x,y+8],[x,waterline]],'#fff0c54a'); c.restore();
    star(c,x,y,8,'#ffe398');
    if (!spot) return;
    const last = s.previous[i] || spot;
    const t = Math.min(1, Math.max(0,phase));
    const q = s.written[i] === s.beat ? t : 1;
    const cx = last[0] + (spot[0]-last[0])*q, cy = last[1] + (spot[1]-last[1])*q;
    star(c,cx,cy,6.8,'#d7ffff');
    linePath(c, [[cx-13,cy+7],[cx+14,cy+7]],'#dbffffae');
  });
  if (s.copies.length > 1) linePath(c,s.copies.filter(Boolean),'#c2f2ff6b');
}
function cloud(c,x,y,scale=1) {
  c.save(); c.translate(x,y); c.scale(scale,scale);
  c.fillStyle='#a5b2c5';
  c.beginPath(); c.moveTo(-35,7);
  c.bezierCurveTo(-45,-2,-30,-15,-19,-12); c.bezierCurveTo(-17,-32,9,-32,15,-16);
  c.bezierCurveTo(31,-22,43,-7,37,5); c.bezierCurveTo(39,14,-28,18,-35,7); c.fill(); c.restore();
}
function drawAoraki(c,s,rank,phase) {
  fillSky(c, [[0,'#101b3c'],[.47,'#36577a'],[.74,'#ac989b'],[1,'#63899a']],270);
  specks(c);
  peakRow(c,[[0,161],[28,141],[47,149],[75,122],[99,138],[124,117],[144,124],[184,82],[190,86],[202,71],[219,94],[231,90],[258,122],[276,109],[298,131],[322,125],[363,151],[405,135],[422,142],[444,130],[480,150]],191,'#57758a');
  path(c,[[128,139],[166,103],[184,82],[190,86],[202,71],[219,94],[231,90],[249,113],[230,101],[222,105],[212,98],[204,90],[194,102],[189,96],[176,105],[162,123]],'#e2e8e2');
  path(c,[[202,71],[208,89],[222,105],[212,98],[204,90],[193,104]],'#bac7d2');
  peakRow(c,[[0,160],[38,148],[75,157],[103,154],[167,176],[235,166],[276,176],[320,160],[368,172],[400,154],[429,165],[480,143]],198,'#29485c');
  c.fillStyle='#547685'; c.fillRect(0,194,480,76);
  for(let i=0;i<19;i++) {const x=(i*97)%480, y=200+(i*i*7)%68; c.fillStyle='#8ea7ae'; c.fillRect(x,y,5+i%16,.8);}
  path(c,[[0,199],[56,184],[110,179],[156,192],[185,197],[218,207],[268,219],[297,245],[329,270],[0,270]],'#263f47');
  const t=Math.max(0,Math.min(1,phase)), x=s.before[0]+(s.star[0]-s.before[0])*t, y=s.before[1]+(s.star[1]-s.before[1])*t;
  star(c,x,y,10,'#ffe28e');
  if (s.cloudy) cloud(c,x+2,y+3,.98);
  const [ax,ay]=s.aim;
  c.strokeStyle='#aee6dd'; c.lineWidth=1.4; c.beginPath(); c.arc(ax,ay,19,0,Math.PI*2); c.stroke();
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) linePath(c,[[ax+dx*16,ay+dy*16],[ax+dx*24,ay+dy*24]],'#b3e5d9');
  const px=83, py=183;
  linePath(c,[[px,py],[62,223]],'#b39d7c',4); linePath(c,[[px,py],[105,224]],'#c6b797',4); linePath(c,[[px,py],[85,215]],'#758b88',3);
  c.save(); c.translate(px,py); c.rotate(Math.atan2(ay-py,ax-px));
  c.fillStyle='#9aaead'; c.fillRect(-22,-4,14,8); c.fillStyle='#e7d7a8'; c.fillRect(-12,-8,52,16);
  c.fillStyle='#70898b'; c.fillRect(22,-8,5,16); c.fillStyle='#8ed2d7'; c.fillRect(38,-9,5,18);
  c.restore();
  s.shots.forEach((shot,i) => {
    const left=469-(s.shots.length-i)*38, top=228;
    c.fillStyle='#f3e7cd'; c.fillRect(left,top,34,32);
    c.fillStyle='#233c5d'; c.fillRect(left+2,top+2,30,24);
    if(shot.cloudy) cloud(c,left+17,top+15,.28);
    else star(c,left+8+(shot.point[0]-290)*.15,top+17-(shot.point[0]-290)*.05,4,'#ffe48d');
  });
  if (s.flash && t < .5) { c.fillStyle = 'rgba(255,239,205,' + ((.5-t)*.34) + ')'; c.fillRect(0,0,480,270); }
}
