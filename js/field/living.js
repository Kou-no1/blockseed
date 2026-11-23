// The stage clock is discrete. Input, memory and reply are separate so that
// neither a dropped rest nor a shutter that fires twice can pass the mission.
function line(label, options, initial) { return { label, options, initial }; }
function trace(ctx, points, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath(); ctx.fill();
}
function oval(ctx, x, y, rx, ry, color, rotation = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
}
function type(ctx, text, x, y, size, color) {
  ctx.font = 'bold ' + size + 'px sans-serif'; ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function rhythmText(bits) { return Array.from(bits, bit => Number(bit) ? '●' : '─').join(' '); }

const listen = line('耳をすます拍', [['first','はじめの1拍だけ'],['every','すべての拍']], 'first');
const mulu = {
  id: 'mulu',
  triggerLabel: rank => rank === 1 ? '手をたたく' : '',
  lessons: [
    { title: 'ひとつの こだま', goal: '手をたたく音を、1拍あとに洞窟から返そう。', hint: '「手をたたいたら」を「こだまを返す」にして、うごかそう。',
      lines: [line('手をたたいたら', [['silent','しずかに待つ'],['echo','こだまを返す']], 'silent')],
      criteria: ['手をたたく音を受け取った','1拍あとにこだまが返った'] },
    { title: 'トン・トトンの 手紙', goal: '「トン・休み・トン・トン」の音を、どれも1拍おくれで返そう。', hint: '耳をすますのは「すべての拍」。返すタイミングは、音を聞いた1拍あとだよ。',
      lines: [listen, line('聞こえた音を返すとき', [['now','すぐ'],['one','1拍あと'],['two','2拍あと']], 'now')],
      criteria: ['3つの音をすべて拾った','休みもふくめて1拍ずつおくれた'] },
    { title: 'ひみつの リズム便', goal: '最後まで聞いてから、同じリズムを返そう。友だちの音と休みでも試せるよ。', hint: '休みも1拍ぶん記録して、記録した順に読みだそう。',
      lines: [line('記録帳に入れるもの', [['notes','音だけ'],['beats','音と休み']], 'notes'),
        line('聞きおえたら', [['reverse','うしろから音を返す'],['forward','記録した順に返す']], 'reverse')],
      criteria: ['最後の拍まで記録してから返した','すべての音と休みを同じ順で返した'] }
  ],
  inputs(rank) {
    return rank === 3 ? [{label:'トンを足す',value:'hit',note:62},{label:'休みを足す',value:'rest'},{label:'おまかせに戻す',value:'clear'}] : [];
  },
  configure(value, previous) {
    if (value === 'clear') return '';
    const bits = typeof previous === 'string' ? previous : '';
    return bits.length >= 8 ? bits : bits + (value === 'hit' ? '1' : '0');
  },
  inputLabel(input, rank) {
    return rank === 3 ? (input ? '友だちのリズム（8拍まで） ' + rhythmText(input) : '好きな音と休みを8拍までつなげるよ') : '';
  },
  create(rank, variant = 0, input) {
    let pattern = rank === 1 ? '1' : rank === 2 ? '1011' : variant ? '11001' : '10110';
    if (rank === 3 && typeof input === 'string' && /^[01]{1,8}$/.test(input)) {
      // The partner's reply in the second cave has its own distinct pickup.
      pattern = variant ? '01' + input : input;
    }
    return { tick: 0, pattern: [...pattern].map(Number), heard: [], memory: [], pending: [], replies: [],
      inputBeat: 0, outputBeat: 0, limit: rank === 3 ? pattern.length * 2 : pattern.length + (rank === 1 ? 1 : 2) };
  },
  step(s, program, rank) {
    if (s.tick >= s.limit) return;
    const t = s.tick, len = s.pattern.length;
    s.inputBeat = t < len ? s.pattern[t] : 0;
    s.outputBeat = 0;
    if (rank === 3) {
      if (t < len && (program[0] === 'beats' || s.inputBeat)) s.memory.push(s.inputBeat);
      if (t >= len) {
        const i = t - len;
        s.outputBeat = s.memory[program[1] === 'forward' ? i : s.memory.length - 1 - i] || 0;
      }
    } else {
      if (s.inputBeat && (rank === 1 || program[0] === 'every' || t === 0)) {
        s.heard.push(t);
        if (rank !== 1 || program[0] === 'echo') {
          const delay = rank === 1 || program[1] === 'one' ? 1 : program[1] === 'two' ? 2 : 0;
          s.pending.push(t + delay);
        }
      }
      s.outputBeat = Number(s.pending.includes(t));
    }
    s.replies.push(s.outputBeat);
    s.tick++;
  },
  finished(s) { return s.tick >= s.limit; },
  checks(s, rank) {
    if (rank === 3) {
      const n = s.pattern.length;
      return [s.tick >= n && s.memory.length === n && !s.replies.slice(0,n).some(Boolean),
        s.tick === s.limit && s.pattern.some(Boolean) && s.pattern.every((v,i) => v === s.replies[i+n])];
    }
    const wanted = [0, ...s.pattern];
    return [s.heard.length === s.pattern.filter(Boolean).length,
      s.tick === s.limit && s.replies.every((v,i) => v === (wanted[i] || 0))];
  },
  sound(s) { return s.outputBeat ? 72 : s.inputBeat ? 62 : undefined; },
  status(s, rank) {
    if (!s.tick) return rank === 3 ? '耳をすませて、聞いたぶんだけ記録しよう。' : '洞窟の入り口で、手をたたくよ。';
    if (s.tick < s.limit) return s.inputBeat && s.outputBeat ? '手拍子とこだまが重なった！' : s.outputBeat ? 'こだまが返った！' : s.inputBeat ? 'トン！ 手をたたいたよ。' : 'ひと休み。今は音のない拍。';
    if (rank === 3 && !s.pattern.some(Boolean)) return '音がひとつもないよ。「トンを足す」で試そう。';
    return mulu.checks(s,rank).every(Boolean) ? 'リズムの手紙が届いた！' : '下の「こだま」の列で、返った拍を見てみよう。';
  },
  draw(ctx, s, rank, phase) {
    const sky = ctx.createLinearGradient(0,0,480,200);
    sky.addColorStop(0,'#203c53'); sky.addColorStop(.55,'#3e7978'); sky.addColorStop(1,'#c2deaf');
    ctx.fillStyle = sky; ctx.fillRect(0,0,480,270);
    trace(ctx, [[0,92],[92,58],[132,96],[185,56],[211,82],[252,45],[273,86],[331,62],[369,109],[461,65],[480,80],[480,192],[0,192]], '#548880');
    trace(ctx, [[0,179],[120,130],[155,149],[221,103],[261,145],[321,127],[358,146],[402,118],[480,140],[480,200],[0,200]], '#386869');
    trace(ctx, [[0,0],[480,0],[480,56],[456,46],[444,82],[429,52],[404,60],[385,46],[357,54],[348,37],[321,34],[302,54],[293,39],[269,51],[250,39],[238,68],[226,43],[192,62],[174,51],[162,91],[148,57],[124,68],[115,53],[93,76],[78,63],[54,110],[44,80],[21,131],[0,155]], '#29474b');
    trace(ctx, [[0,0],[368,0],[314,12],[276,18],[249,14],[213,37],[196,27],[169,39],[137,34],[117,48],[96,39],[74,55],[51,54],[37,78],[23,77],[0,121]], '#172f37');
    trace(ctx, [[0,137],[21,141],[32,120],[45,158],[68,165],[84,151],[90,165],[124,169],[153,181],[205,183],[269,176],[338,178],[377,166],[389,153],[395,162],[414,151],[431,114],[440,140],[454,117],[480,112],[480,225],[0,225]], '#284b4b');
    trace(ctx, [[0,197],[46,179],[101,176],[166,190],[263,185],[344,182],[422,161],[480,164],[480,208],[0,208]], '#3e7671');
    const p = Math.min(1, Math.max(0,phase || 0));
    function pulse(x, color, direction) {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x,131,10+30*p, direction-.9, direction+.9); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x,131,20+32*p,direction-.8,direction+.8); ctx.stroke();
    }
    if (s.inputBeat) pulse(90 + p*72,'#ffe6a0',0);
    if (s.outputBeat) pulse(389 - p*88,'#b6ffed',Math.PI);
    // Amber hand drum at the entrance and the empty opening that returns its sound.
    trace(ctx, [[51,145],[78,142],[76,166],[60,169]], '#b65d3a');
    oval(ctx,65,144,15,5,'#f8cf86',-.13);
    ctx.strokeStyle = '#f3d29f'; ctx.lineWidth = 3; ctx.beginPath();
    ctx.moveTo(49,122); ctx.lineTo(64,s.inputBeat ? 143 : 133); ctx.stroke();
    ctx.fillStyle='#152d35'; ctx.fillRect(0,205,480,65);
    const expected = rank === 3 ? s.pattern.length : 1;
    const cols = s.limit, width = Math.min(30, 366 / cols);
    type(ctx,'手拍子',12,230,15,'#ffdf9c'); type(ctx,'こだま',12,255,15,'#a8eddf');
    for(let i=0;i<cols;i++) {
      const x=88+i*width;
      ctx.fillStyle=i === s.tick-1 ? '#34565a' : '#213e45';ctx.fillRect(x-4,210,width-2,52);
      if (i < s.pattern.length) {
        if (i < s.tick && s.pattern[i]) oval(ctx,x+4,225,5,5,'#ffdb8e');
        else { ctx.fillStyle=i<s.tick?'#95ada0':'#607976'; ctx.fillRect(x+1,224,6,2); }
      }
      if (i<s.tick && s.replies[i]) oval(ctx,x+4,249,5,5,'#a5f8de');
      else if(i>=expected){ctx.fillStyle='#62847e';ctx.fillRect(x+1,248,6,2);}
    }
  }
};

const cameraRule = line('シャッターを切る合図', [['anything','何かが写った'],['turtle','カメが写った'],['rock','岩が写った']], 'anything');
const names = { hana: 'ハナ', sora: 'ソラ', rock: '岩' };
const galapagos = {
  id:'galapagos',
  lessons:[
    {title:'ゾウガメを 1枚',goal:'観察カメラにゾウガメが来たら、写真を1枚のこそう。',hint:'「カメが来たら」で「写真をとる」をえらぼう。',
      lines:[line('カメが来たら',[['watch','そのまま見る'],['photo','写真をとる']],'watch')],criteria:['カメが通るまで観察した','ゾウガメを1枚撮った']},
    {title:'岩かな、カメかな？',goal:'岩とカメが交代で写るよ。カメの写真だけを2枚集めよう。',hint:'形をよく見て、「カメが写った」をシャッターの合図にしよう。',
      lines:[cameraRule],criteria:['2匹とも写真に写った','岩や空っぽの写真がない']},
    {title:'1匹に 1枚だけ',goal:'立ち止まったり戻ってきたりするゾウガメを、1匹につき1枚ずつ撮ろう。',hint:'カメが写ったら、アルバムに「まだ写真がないカメ」かを調べよう。',
      lines:[{...cameraRule,initial:'turtle'},line('合図が来たら',[['every','毎回とる'],['new','まだ写真がないカメだけとる'],['first','最初の1枚だけとる']],'every')],
      criteria:['ハナとソラをどちらも撮った','同じカメの写真は1枚ずつ','岩や空っぽの写真がない']}
  ],
  create(rank, variant=0) {
    const routes = rank===1 ? [[null,'hana',null],[null,'sora',null]] : rank===2 ?
      [[null,'rock','hana',null,'sora','rock'],['rock','sora',null,'rock','hana',null]] :
      [[null,'rock','hana','hana',null,'sora','sora','hana'],['sora','sora','rock','hana','hana',null,'sora']];
    return {tick:0,route:routes[variant ? 1 : 0],subject:null,previous:null,shots:[],fired:false};
  },
  step(s, program, rank) {
    if (s.tick>=s.route.length) return;
    s.previous=s.subject; s.subject=s.route[s.tick++];
    const turtle = s.subject === 'hana' || s.subject === 'sora';
    const trigger = rank===1 ? turtle && program[0]==='photo' :
      program[0]==='anything' ? Boolean(s.subject) : program[0]==='rock' ? s.subject==='rock' : program[0]==='turtle' && turtle;
    const allowed = rank<3 || program[1]==='every' || (program[1]==='new' && !s.shots.includes(s.subject)) ||
      (program[1]==='first' && !s.shots.length);
    s.fired=trigger && allowed;
    if(s.fired) s.shots.push(s.subject);
  },
  finished(s) { return s.tick===s.route.length; },
  checks(s,rank) {
    if(rank===1) return [s.tick===s.route.length,s.shots.length===1 && s.shots[0]===s.route[1]];
    const seenBoth=s.shots.includes('hana') && s.shots.includes('sora');
    const clean=s.tick===s.route.length && s.shots.length>0 && s.shots.every(pic=>pic==='hana'||pic==='sora');
    return rank===2 ? [seenBoth,clean] : [seenBoth,seenBoth && new Set(s.shots).size===s.shots.length,clean];
  },
  sound(s){return s.fired ? 85 : undefined;},
  status(s,rank) {
    if (!s.tick) return 'カメラをかまえて、ゾウガメを待とう。';
    if (galapagos.finished(s)) return 'アルバム ' + s.shots.length + '枚。' +
      (galapagos.checks(s,rank).every(Boolean) ? '観察できたよ！' : s.shots.includes('rock') ? '岩の写真も入っているよ。' :
        s.shots.length>new Set(s.shots).size ? '同じカメが何枚も写ったよ。' : 'カメの写真はそろったかな？');
    return (s.subject ? (names[s.subject] + (s.subject==='rock'?'が見えるよ。':'が来たよ。')) : '今はだれもいないよ。') + (s.fired ? ' カシャ！' : '');
  },
  draw(ctx,s,rank,phase) {
    const sky=ctx.createLinearGradient(0,0,0,220);sky.addColorStop(0,'#83c2c3');sky.addColorStop(1,'#faeabb');
    ctx.fillStyle=sky;ctx.fillRect(0,0,480,270);
    oval(ctx,370,51,22,22,'#ffdc90');
    trace(ctx,[[0,108],[39,95],[77,99],[140,64],[177,70],[209,89],[241,97],[294,76],[329,70],[379,93],[402,90],[480,113],[480,174],[0,174]],'#75a29a');
    trace(ctx,[[0,133],[38,124],[82,135],[141,114],[208,128],[263,115],[314,106],[343,112],[370,108],[436,129],[480,123],[480,179],[0,179]],'#668c70');
    trace(ctx,[[0,130],[79,144],[161,142],[197,151],[278,146],[337,137],[400,149],[480,142],[480,270],[0,270]],'#b9af70');
    trace(ctx,[[0,203],[91,172],[166,170],[266,182],[346,175],[436,154],[480,154],[480,188],[422,188],[314,203],[208,196],[141,198],[49,220],[0,217]],'#daca98');
    // Wild prickly pear silhouette and a distant volcanic outcrop frame the view.
    ctx.fillStyle='#635e3a';ctx.fillRect(35,97,7,45);
    for(const [x,y,a] of [[37,99,0],[29,88,-.7],[47,81,.45],[24,74,-.4],[51,62,.2]]) oval(ctx,x,y,7,13,'#507b55',a);
    trace(ctx,[[359,148],[373,134],[393,130],[407,144],[424,151]],'#70785a');
    const p=Math.min(1,Math.max(0,phase||0));
    const subject=s.tick ? s.subject : 'hana';
    if(subject){
      const x=subject==='rock'?241:238+((s.tick && s.previous!==s.subject)?(p-1)*25:0);
      drawSubject(ctx,subject,x,173,1);
    }
    ctx.strokeStyle=s.fired?'#fff1c9':'#f4f5dd';ctx.lineWidth=3;
    for(const [x,y,dx,dy] of [[124,74,1,1],[350,74,-1,1],[124,190,1,-1],[350,190,-1,-1]]){
      ctx.beginPath();ctx.moveTo(x+18*dx,y);ctx.lineTo(x,y);ctx.lineTo(x,y+15*dy);ctx.stroke();
    }
    if(s.fired && p<.35){ctx.fillStyle='rgba(255,248,206,'+(.23*(1-p/.35))+')';ctx.fillRect(125,75,224,115);}
    ctx.fillStyle='#243e35';ctx.fillRect(0,212,480,58);
    type(ctx,'アルバム',12,235,15,'#eaf0db');type(ctx,s.shots.length+' 枚',12,254,14,'#ffd997');
    s.shots.slice(-7).forEach((pic,i)=>{
      const x=100+i*51;ctx.fillStyle='#fbf2d7';ctx.fillRect(x,217,45,48);
      ctx.fillStyle='#b4ccb0';ctx.fillRect(x+3,220,39,24);
      drawSubject(ctx,pic,x+21,240,.29);type(ctx,names[pic]||'—',x+5,259,12,'#304c3f');
    });
  }
};

function drawSubject(ctx,pic,x,y,scale) {
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  oval(ctx,0,1,52,6,'#827e58');
  if(pic==='rock'){
    trace(ctx,[[-40,-3],[-31,-23],[-7,-32],[25,-24],[42,-3]],'#636756');
    trace(ctx,[[-31,-23],[-7,-32],[19,-24],[-1,-19],[-19,-8]],'#8b8c78');
  }else{
    const dark=pic==='sora'?'#465c49':'#64593f', shell=pic==='sora'?'#677f60':'#9c8154';
    trace(ctx,[[-48,-15],[-60,-15],[-48,-9],[-37,-8]],dark);
    for (const px of [-36,19]){oval(ctx,px,-7,7,10,'#475944',.2);oval(ctx,px+9,-6,7,11,'#788460',-.12);}
    trace(ctx,[[24,-18],[40,-18],[49,-31],[58,-30],[54,-17],[44,-7],[24,-8]],'#87966a');
    oval(ctx,54,-29,12,7,'#87966a',-.1);oval(ctx,58,-31,1.5,1.5,'#26352c');
    ctx.beginPath();ctx.moveTo(-48,-13);ctx.bezierCurveTo(-44,-57,19,-66,37,-20);
    ctx.quadraticCurveTo(15,-5,-48,-13);ctx.fillStyle=shell;ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=3;ctx.stroke();
    for(const [cx,cy] of [[-24,-28],[-7,-42],[9,-29]]){
      trace(ctx,[[cx-9,cy],[cx-5,cy-7],[cx+3,cy-8],[cx+9,cy-2],[cx+5,cy+5],[cx-5,cy+5]],dark);
    }
  }
  ctx.restore();
}

export const living = [mulu,galapagos];
