import { block, numberArg, selectArg } from './defs.helpers.js';

export const soundDefs=[
block('sound_note',1,'sound','stack',{1:'%1 の おとを %2 びょう ならす',3:'%1 の 音|おと を %2 秒|びょう 鳴|な らす'},[
selectArg('NOTE',60,[{v:60,label:'ド'},{v:62,label:'レ'},{v:64,label:'ミ'},{v:65,label:'ファ'},{v:67,label:'ソ'},{v:69,label:'ラ'},{v:71,label:'シ'}]),
numberArg('SECS',0.3,[0.2,0.5,1])
]),
block('sound_effect',1,'sound','stack',{1:'%1 の おと',3:'%1 の 音|おと'},[selectArg('EFFECT','piko',[{v:'piko',label:'ぴこ'},{v:'boo',label:'ぶー'},{v:'clap',label:'ぱちぱち'},{v:'success',label:'ちゃらーん'}])]),
block('sound_tempo_set',3,'sound','stack',{1:'はやさを %1 に する',3:'速|はや さを %1 に する'},[numberArg('TEMPO',100,[60,100,140])])
];
