import { block, selectArg, stringArg } from './defs.helpers.js';

const keys=[{v:'space',label:'スペース'},{v:'ArrowUp',label:'うえ'},{v:'ArrowDown',label:'した'},{v:'ArrowLeft',label:'ひだり'},{v:'ArrowRight',label:'みぎ'}];

export const sensingDefs=[
block('sensing_key',2,'sensing','bool',{1:'%1 キーが おされた',3:'%1 キーが 押|お された'},[selectArg('KEY','space',keys)]),
block('sensing_touching',2,'sensing','bool',{1:'%1 に ふれた',3:'%1 に 触|ふ れた'},[selectArg('TARGET','edge',[{v:'edge',label:'はし'},{v:'mouse',label:'マウス'}])],['sprite']),
block('sensing_edge',2,'sensing','bool',{1:'はしに ついた',3:'端|はし に ついた'},[],['sprite']),
block('sensing_mouse_x',3,'sensing','value',{1:'マウスの x',3:'マウスの x'}),
block('sensing_mouse_y',3,'sensing','value',{1:'マウスの y',3:'マウスの y'}),
block('sensing_timer',3,'sensing','value',{1:'タイマー',3:'タイマー'}),
block('sensing_reset_timer',3,'sensing','stack',{1:'タイマーを 0に する',3:'タイマーを 0 にする'}),
block('sensing_ask',3,'sensing','stack',{1:'%1 と きいて まつ',3:'%1 と 聞|き いて 待|ま つ'},[stringArg('QUESTION','なまえは？')]),
block('sensing_answer',3,'sensing','value',{1:'こたえ',3:'答|こた え'})
];
