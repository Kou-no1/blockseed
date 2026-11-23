import { block, numberArg, stringArg } from './defs.helpers.js';

export const controlDefs=[
block('control_wait',1,'control','stack',{1:'%1 びょう まつ',3:'%1 秒|びょう 待|ま つ'},[numberArg('SECS',1,[0.2,1,2])]),
block('control_repeat',1,'control','c',{1:'%1 かい くりかえす',3:'%1 回|かい くりかえす'},[numberArg('TIMES',4,[2,4,10])]),
block('control_forever',2,'control','c',{1:'ずっと くりかえす',3:'ずっと くりかえす'}),
block('control_if',2,'control','c',{1:'もし %1 なら',3:'もし %1 なら'},[{name:'COND',type:'bool',default:true,ui:'dropdown',slot:true}]),
block('control_if_else',3,'control','c2',{1:'もし %1 なら',3:'もし %1 なら'},[{name:'COND',type:'bool',default:true,ui:'dropdown',slot:true}]),
block('control_wait_until',3,'control','stack',{1:'%1 まで まつ',3:'%1 まで 待|ま つ'},[{name:'COND',type:'bool',default:true,ui:'dropdown',slot:true}]),
block('control_repeat_until',3,'control','c',{1:'%1 まで くりかえす',3:'%1 まで くりかえす'},[{name:'COND',type:'bool',default:true,ui:'dropdown',slot:true}]),
block('control_stop_all',2,'control','cap',{1:'ぜんぶ とめる',3:'全部|ぜんぶ 止|と める'}),
block('control_broadcast',3,'control','stack',{1:'%1 を おくる',3:'%1 を 送|おく る'},[stringArg('MESSAGE','スタート')]),
block('control_broadcast_wait',4,'control','stack',{1:'%1 を おくって まつ',4:'%1 を 送って待つ'},[stringArg('MESSAGE','スタート')])
];
