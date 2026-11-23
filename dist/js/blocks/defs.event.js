import { block, selectArg, stringArg } from './defs.helpers.js';

export const eventDefs=[
block('event_start',1,'event','hat',{1:'▶ が おされたとき',3:'▶ が 押|お されたとき'}),
block('event_key',2,'event','hat',{1:'%1 キーが おされたとき',3:'%1 キーが 押|お されたとき'},[selectArg('KEY','space',[
{v:'space',label:'スペース'},{v:'ArrowUp',label:'うえ'},{v:'ArrowDown',label:'した'},{v:'ArrowLeft',label:'ひだり'},{v:'ArrowRight',label:'みぎ'},{v:'a',label:'A'}
])]),
block('event_click',2,'event','hat',{1:'これが クリックされたとき',3:'これが クリックされたとき'},[],['sprite']),
block('event_message',3,'event','hat',{1:'%1 を うけとったとき',3:'%1 を 受|う けとったとき'},[stringArg('MESSAGE','スタート')])
];
