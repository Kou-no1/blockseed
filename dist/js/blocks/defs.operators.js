import { block, numberArg, stringArg } from './defs.helpers.js';

function binary(type,label,level,bool){
return block(type,level||2,'operators',bool ? 'bool':'value',{1:label,3:label},[numberArg('A',0),numberArg('B',0)]);
}

export const operatorDefs=[
binary('op_add','%1 + %2'),binary('op_sub','%1 − %2'),binary('op_mul','%1 × %2'),binary('op_div','%1 ÷ %2'),
block('op_random',2,'operators','value',{1:'%1 から %2 までの ランダム',3:'%1 から %2 までの 乱数|らんすう'},[numberArg('A',1),numberArg('B',10)]),
binary('op_gt','%1 > %2',2,true),binary('op_lt','%1 < %2',2,true),binary('op_eq','%1 = %2',2,true),
block('op_and',3,'operators','bool',{1:'%1 かつ %2',3:'%1 かつ %2'},[{name:'A',type:'bool',default:true,ui:'dropdown',slot:true},{name:'B',type:'bool',default:true,ui:'dropdown',slot:true}]),
block('op_or',3,'operators','bool',{1:'%1 または %2',3:'%1 または %2'},[{name:'A',type:'bool',default:true,ui:'dropdown',slot:true},{name:'B',type:'bool',default:false,ui:'dropdown',slot:true}]),
block('op_not',3,'operators','bool',{1:'%1 ではない',3:'%1 ではない'},[{name:'A',type:'bool',default:true,ui:'dropdown',slot:true}]),
binary('op_mod','%1 を %2 で わった あまり',4),
block('op_round',4,'operators','value',{1:'%1 を まるめる',4:'%1 を丸める'},[numberArg('A',0)]),
block('op_abs',4,'operators','value',{1:'%1 の ぜったいち',4:'%1 の絶対値'},[numberArg('A',0)]),
block('op_join',4,'operators','value',{1:'%1 と %2',4:'%1 と %2 をつなぐ'},[stringArg('A','こんにちは'),stringArg('B','！')]),
block('op_letter',4,'operators','value',{1:'%2 の %1 もじめ',4:'%2 の %1 文字目'},[numberArg('A',1),stringArg('B','たね')]),
block('op_length',4,'operators','value',{1:'%1 の ながさ',4:'%1 の長さ'},[stringArg('A','たね')])
];
