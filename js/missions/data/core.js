import { makeId } from '../../core/project.js';

function block(type, fields, body) {
  const values = fields || {};
  const inputs = {};
  Object.keys(values).forEach(function (key) { inputs[key] = null; });
  const result = { id: makeId('b'), type: type, fields: values, inputs: inputs };
  if (body) result.body = body;
  return result;
}

function polygonStarter(sides, repeats = sides, distance = sides > 8 ? 35 : 65, turn = 360 / sides) {
  return [
    block('event_start'), block('pen_down'),
    block('control_repeat', { TIMES: repeats }, [block('turtle_forward', { STEPS: distance }), block('turtle_right', { DEG: turn })])
  ];
}

const intro = [
  { id: 'intro_move', title: 'かめを うごかそう', grade: '小1〜', subject: 'はじめて', unit: '順次', level: 1, stage: 'turtle', goal: 'うごかすを おして、かめに せんを かいてもらおう。', hints: ['すすむ ブロックを タップして たしてみよう'], allowedBlocks: ['event_start', 'turtle_forward', 'turtle_right', 'pen_down', 'pen_clear'], starter: [block('event_start'), block('pen_down'), block('turtle_forward', { STEPS: 100 })], check: { kind: 'turtlePath', minSegments: 1 } },
  {
    id: 'intro_square', area: 'patagonia', rank: 1, title: 'みずうみを ひとまわり', grade: '小2〜', subject: '探検', unit: 'くりかえし', level: 1, stage: 'turtle',
    goal: '「うごかす」を おして、しかくい道を ひとまわりしよう。',
    hints: ['「うごかす」を おして、せんを たどろう。', 'すすむ歩数を かえてみよう。'],
    allowedBlocks: ['event_start', 'turtle_forward', 'turtle_right', 'turtle_left', 'control_repeat', 'pen_down', 'pen_clear'],
    starter: polygonStarter(4),
    check: { kind: 'turtlePath', polygon: { sides: 4, tolerance: 7, closed: true }, required: ['control_repeat'] }
  },
  { id: 'intro_sound', title: 'おとを ならそう', grade: '小1〜', subject: 'はじめて', unit: '音', level: 1, stage: 'turtle', goal: 'すきな おとを ならしてみよう。', hints: ['おとの ブロックを タップしよう'], allowedBlocks: ['event_start', 'sound_note', 'sound_effect', 'control_repeat'], starter: [block('event_start'), block('sound_note', { NOTE: 60, SECS: .3 })], check: { kind: 'blockUsage', required: ['sound_note'] } },
  { id: 'intro_pattern', title: 'もようを つくろう', grade: '小2〜', subject: 'はじめて', unit: 'くりかえし', level: 1, stage: 'turtle', goal: 'すすむ・まがるを くりかえして、もようを つくろう。', hints: ['まがる かくどを かえてみよう'], starter: [block('event_start'), block('control_repeat', { TIMES: 18 }, [block('turtle_forward', { STEPS: 45 }), block('turtle_right', { DEG: 100 })])], check: { kind: 'turtlePath', minSegments: 8 } }
];

const polygons = Array.from({ length: 10 }, function (_, index) {
  const sides = index + 3;
  return {
    id: 'math5_polygon_' + sides,
    title: '正' + (sides === 3 ? '三角形' : sides === 4 ? '方形' : sides + '角形') + 'を かこう',
    grade: '小5', subject: '算数', unit: '正多角形', level: 3, stage: 'turtle',
    goal: sides + 'つの へんが おなじ ながさの かたちを かこう。',
    hints: ['まがる かくどは 360 ÷ ' + sides + ' だよ'],
    allowedBlocks: ['event_start', 'turtle_forward', 'turtle_right', 'turtle_left', 'control_repeat', 'pen_down', 'pen_clear'],
    starter: polygonStarter(sides),
    check: { kind: 'turtlePath', polygon: { sides: sides, tolerance: 7, closed: true }, required: ['control_repeat'] }
  };
});

function deviceStarter(kind, outputName) {
  const output = outputName || 'led';
  let condition = block('device_sensor_on', { SENSOR: kind === 'dark' ? 'light' : 'motion' });
  if (kind === 'both') {
    condition = block('op_and', { A: true, B: true });
    condition.inputs.A = block('device_sensor_on', { SENSOR: 'motion' });
    condition.inputs.B = block('device_sensor_on', { SENSOR: 'light' });
  }
  const setOn = block('device_out_set', { OUTPUT: output, STATE: 1 });
  const setOff = block('device_out_set', { OUTPUT: output, STATE: 0 });
  const choose = block('control_if_else', { COND: true }, [setOn]); choose.inputs.COND = condition; choose.body2 = [setOff];
  return [block('event_start'), block('control_forever', {}, [choose])];
}

function signalStarter() {
  return [block('event_start'), block('control_forever', {}, [
    block('device_led_color', { COLOR: '#ef4f43' }), block('device_out_set', { OUTPUT: 'led', STATE: 1 }), block('control_wait', { SECS: 1 }),
    block('device_out_set', { OUTPUT: 'led', STATE: 0 }), block('control_wait', { SECS: .5 }),
    block('device_led_color', { COLOR: '#48a957' }), block('device_out_set', { OUTPUT: 'led', STATE: 1 }), block('control_wait', { SECS: 1 }),
    block('device_out_set', { OUTPUT: 'led', STATE: 0 }), block('control_wait', { SECS: .5 })
  ])];
}

function fanStarter() {
  const condition = block('op_gt', { A: 0, B: 28 });
  condition.inputs.A = block('device_sensor', { SENSOR: 'temp' });
  const choose = block('control_if_else', { COND: true }, [block('device_out_power', { OUTPUT: 'motor', POWER: 80 })]);
  choose.inputs.COND = condition;
  choose.body2 = [block('device_out_power', { OUTPUT: 'motor', POWER: 0 })];
  return [block('event_start'), block('control_forever', {}, [choose])];
}

function botStarter() {
  const equals = block('op_eq', { A: 0, B: 0 });
  equals.fields.B = 'はい'; equals.inputs.A = block('sensing_answer');
  const choose = block('control_if_else', { COND: true }, [block('looks_say', { TEXT: 'ぼくも すき！' })]);
  choose.inputs.COND = equals; choose.body2 = [block('looks_say', { TEXT: 'そうなんだね' })];
  return [block('event_start'), block('sensing_ask', { QUESTION: 'プログラミングは すき？ はい／いいえ' }), choose];
}

const science = [
  { id: 'science_motion', title: '人が きたら つけよう', grade: '小6', subject: '理科', unit: '電気の利用', level: 3, stage: 'device', goal: '人感センサーが はんのうした ときだけ LEDを つけよう。', hints: ['人感センサーの ブロックを もしの なかに いれよう'], starter: deviceStarter('motion'), check: { kind: 'deviceLog', rule: 'motion', required: ['device_sensor_on', 'device_out_set'] } },
  { id: 'science_dark', title: 'くらい ときだけ つけよう', grade: '小6', subject: '理科', unit: '電気の利用', level: 3, stage: 'device', goal: 'くらい ときだけ LEDを つけよう。', hints: ['明るさセンサーは くらいと はんのうするよ'], starter: deviceStarter('dark'), check: { kind: 'deviceLog', rule: 'dark', required: ['device_sensor_on', 'device_out_set'] } },
  { id: 'science_both', title: '人がいて くらい とき', grade: '小6', subject: '理科', unit: '電気の利用', level: 3, stage: 'device', goal: '人がいて、くらい ときだけ LEDを つけよう。', hints: ['かつ ブロックで 2つの じょうけんを つなごう'], starter: deviceStarter('both'), check: { kind: 'deviceLog', rule: 'both', required: ['op_and', 'device_sensor_on', 'device_out_set'] } },
  { id: 'science_energy', title: 'しょうエネを くらべよう', grade: '小6', subject: '理科', unit: '電気の利用', level: 3, stage: 'device', goal: 'じどうモードで うごかし、つかった じかんを 2回きろくして くらべよう。', hints: ['人と あかるさの 2つを つかうと どうなるかな'], starter: deviceStarter('both'), check: { kind: 'deviceLog', rule: 'both', required: ['op_and'], minRecords: 2 } }
];

const advanced = [
  { id: 'tech_door', title: 'じどうドア', grade: '中学', subject: '技術', unit: '計測・制御', level: 4, stage: 'device', goal: '人感センサーで モーターを うごかそう。', starter: deviceStarter('motion', 'motor'), check: { kind: 'blockUsage', required: ['device_sensor_on', 'device_out_set'] } },
  { id: 'tech_signal', title: 'じかんで かわる しんごうき', grade: '中学', subject: '技術', unit: '計測・制御', level: 4, stage: 'device', goal: 'まつ時間と LEDの色を くみあわせて、しんごうきを つくろう。', starter: signalStarter(), check: { kind: 'blockUsage', required: ['control_wait', 'device_led_color', 'device_out_set'] } },
  { id: 'tech_fan', title: 'おんどで うごく ファン', grade: '中学', subject: '技術', unit: '計測・制御', level: 4, stage: 'device', goal: '温度が 28度より 高いとき、モーターの強さを 上げよう。', starter: fanStarter(), check: { kind: 'blockUsage', required: ['device_sensor', 'op_gt', 'device_out_power'] } },
  { id: 'bidi_chat', title: 'メッセージで かいわ', grade: '中学', subject: '技術', unit: '双方向', level: 4, stage: 'sprite', goal: 'メッセージを おくり、べつの はじまりブロックで へんじを しよう。', scripts: [
    { id: makeId('s'), x: 30, y: 30, blocks: [block('event_start'), block('looks_say', { TEXT: 'こんにちは！' }), block('control_broadcast', { MESSAGE: 'へんじ' })] },
    { id: makeId('s'), x: 260, y: 30, blocks: [block('event_message', { MESSAGE: 'へんじ' }), block('looks_say', { TEXT: 'いっしょに つくろう！' })] }
  ], sprites: [
    { id: 'sp1', name: 'ねこ', shape: 'cat', x: -90, y: 0, dir: 90, size: 80, visible: true, color: '#f5a623' },
    { id: 'sp2', name: 'ロボット', shape: 'robot', x: 100, y: 0, dir: 270, size: 80, visible: true, color: '#4c9bd6' }
  ], check: { kind: 'blockUsage', required: ['control_broadcast', 'event_message'] } },
  { id: 'bidi_bot', title: 'しつもんに こたえる ボット', grade: '中学', subject: '技術', unit: '双方向', level: 4, stage: 'sprite', goal: 'こたえに よって へんじを かえる ボットを つくろう。', starter: botStarter(), check: { kind: 'blockUsage', required: ['sensing_ask', 'sensing_answer', 'control_if_else'] } },
  { id: 'free_draw', title: 'じゆうに おえかき', grade: '自由', subject: '自由', unit: 'おえかき', level: 1, stage: 'turtle', goal: 'ブロックを くみあわせて、すきな えを かこう。', starter: [block('event_start'), block('pen_down')], check: { kind: 'free' } },
  { id: 'free_maze', title: 'めいろを すすもう', grade: '自由', subject: '自由', unit: 'ゲーム', level: 2, stage: 'sprite', goal: 'キーで キャラを うごかして、めいろの ゴールを めざそう。', starter: [block('event_key', { KEY: 'ArrowRight' }), block('motion_move', { STEPS: 20 }), block('motion_bounce')], check: { kind: 'free' } },
  { id: 'free_shoot', title: 'シューティングを つくろう', grade: '自由', subject: '自由', unit: 'ゲーム', level: 3, stage: 'sprite', goal: 'キーや クリックを つかって、うごく ゲームを つくろう。', starter: [block('event_click'), block('sound_effect', { EFFECT: 'click' }), block('motion_move', { STEPS: 40 })], check: { kind: 'free' } },
  { id: 'free_music', title: 'おんがくを つくろう', grade: '自由', subject: '自由', unit: '楽器', level: 1, stage: 'turtle', goal: 'おとの 高さと 長さを かえて、じぶんの おんがくを つくろう。', starter: [block('event_start'), block('sound_note', { NOTE: 60, SECS: .3 }), block('sound_note', { NOTE: 64, SECS: .3 }), block('sound_note', { NOTE: 67, SECS: .5 })], check: { kind: 'free' } }
];

const expeditions = [
  {
    id: 'sossusvlei_survey', area: 'namib', rank: 1, title: 'すな山を 三角にむすぼう', grade: '小3〜', subject: '探検', unit: '回数と角度', level: 2, stage: 'turtle',
    goal: '見本をうごかして、同じ長さの3本の道が三角形になるところを観察しよう。',
    hints: ['1本すすむたびに、どちらに何度曲がるか見てみよう。'],
    allowedBlocks: ['event_start', 'pen_down', 'pen_clear', 'turtle_forward', 'turtle_right', 'turtle_left', 'control_repeat'],
    starter: polygonStarter(3),
    check: { kind: 'turtlePath', polygon: { sides: 3, tolerance: 6, closed: true }, required: ['control_repeat'] }
  },
  {
    id: 'yakushima_canopy', area: 'yakushima', rank: 1, title: '木かげで ライトをともそう', grade: '小3〜', subject: '探検', unit: '明るさ', level: 3, stage: 'device',
    goal: '「うごかす」をおして、暗くしたら点灯、明るくもどしたら消灯するか試そう。',
    hints: ['「うごかす」をおしたら「木かげ」、つぎに「日なた」をえらんで、ライトを見よう。', '明るさが35より小さいと、暗いと判断するよ。'],
    starter: deviceStarter('dark'),
    check: { kind: 'deviceLog', rule: 'dark', requireBothStates: true, required: ['control_if_else', 'device_sensor_on'] }
  }
];

function routeMission(id, area, rank, title, goal, hint, starter, polygon) {
  return {
    id, area, rank, title, goal, hints: [hint], starter, grade: '小3〜', subject: '探検', unit: '長さと角度',
    level: area === 'namib' ? 2 : 1, stage: 'turtle', allowedBlocks: intro[1].allowedBlocks,
    check: { kind: 'turtlePath', polygon: { closed: true, ...polygon }, required: ['control_repeat'] }
  };
}

const rectangle = polygonStarter(4, 2, 40);
rectangle[2].body.push(block('turtle_forward', { STEPS: 80 }), block('turtle_right', { DEG: 90 }));

const laterRoutes = [
  routeMission('paine_long_route', 'patagonia', 2, '大きな しかくを描こう',
    '道がみじかいよ。1本が80歩の しかくい道にしよう。',
    'すすむ歩数を見てみよう。', polygonStarter(4, 4, 80), { sides: 4, lengths: [80] }),
  routeMission('paine_rectangle', 'patagonia', 3, 'ほそ長い 湖をかこもう',
    '40歩と80歩の道を かわりばんこに引いて、長方形をとじよう。',
    'くり返しの中に「40 すすむ」が2つ。片方だけを80にしよう。', rectangle, { sides: 4, lengths: [40, 80] }),
  routeMission('namib_dune_turn', 'namib', 2, '五角形の キャンプ',
    '5回曲がって正五角形を描こう。今の角度では、出発点にもどれないよ。',
    'ひとまわりは360度。360を5でわった角度を「まわる」に入れよう。', polygonStarter(5), { sides: 5 }),
  routeMission('namib_hexagon', 'namib', 3, '六角形の たんけん路',
    '三角形の見本を、同じ長さの辺が6本ある正六角形に作りかえよう。',
    '回数は6回。1回で曲がる角度は360度を6でわってみよう。', polygonStarter(6), { sides: 6 })
];

function sensorMission(id, rank, title, goal, hint, starter, rule) {
  return { id, area: 'yakushima', rank, title, goal, hints: [hint], grade: '小4〜', subject: '探検',
    stage: 'device', level: 3, unit: 'ライトの条件', starter,
    check: { kind: 'deviceLog', rule, scenarios: true, required: ['control_if_else', 'device_sensor_on'] } };
}
const laterExperiments = [
  sensorMission('yakushima_visitor', 2, '人が来たら お出むかえ',
    '人がいるときだけライトをつけよう。「いる」と「いない」を両方試そう。',
    '「LEDがつく条件」で「人がいる」をえらぼう。', deviceStarter('motion'), 'motion'),
  sensorMission('yakushima_night', 3, '夜の 森のあんない灯',
    '暗くて人がいるときだけ点灯。明るさと人を切りかえ、4通りとも試そう。',
    'ライトがつくための2つの条件を確かめよう。', deviceStarter('both'), 'both')
];

export const missions = [intro[1], ...expeditions, ...laterRoutes, ...laterExperiments, intro[0], ...intro.slice(2), ...polygons, ...science, ...advanced];

// These were the unfinished programs automatically placed by the earlier lessons.
// Preserve their shapes so an edited save can always be distinguished from a new arrival.
const oldRectangle = polygonStarter(4, 2, 40);
oldRectangle[2].body.push(block('turtle_forward', { STEPS: 40 }), block('turtle_right', { DEG: 90 }));
const oldNight = deviceStarter('both');
oldNight[1].body[0].inputs.COND.inputs.B.fields.SENSOR = 'motion';
export const legacyStarters = new Map([
  ['paine_long_route', polygonStarter(4, 4, 50)], ['paine_rectangle', oldRectangle],
  ['namib_dune_turn', polygonStarter(5, 5, 65, 90)], ['namib_hexagon', polygonStarter(3, 3, 55)],
  ['yakushima_visitor', deviceStarter('dark')], ['yakushima_night', oldNight]
]);
