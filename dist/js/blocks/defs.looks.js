import { block, colorArg, numberArg, stringArg } from './defs.helpers.js';

export const looksDefs=[
block('pen_down',1,'looks','stack',{1:'ペンを おろす',3:'ペンを 下|お ろす'},[],['turtle']),
block('pen_up',1,'looks','stack',{1:'ペンを あげる',3:'ペンを 上|あ げる'},[],['turtle']),
block('pen_color',1,'looks','stack',{1:'ペンの いろを %1 に する',3:'ペンの 色|いろ を %1 に する'},[colorArg('COLOR','#1672b8')],['turtle']),
block('pen_width',2,'looks','stack',{1:'ペンの ふとさを %1 に する',3:'ペンの 太|ふと さを %1 に する'},[numberArg('WIDTH',3,[1,3,6])],['turtle']),
block('pen_clear',1,'looks','stack',{1:'ぜんぶ けす',3:'全部|ぜんぶ 消|け す'},[],['turtle']),
block('looks_say',1,'looks','stack',{1:'%1 と いう',3:'%1 と 言|い う'},[stringArg('TEXT','こんにちは！')],['sprite']),
block('looks_say_secs',2,'looks','stack',{1:'%1 と %2 びょう いう',3:'%1 と %2 秒|びょう 言|い う'},[stringArg('TEXT','こんにちは！'),numberArg('SECS',2)],['sprite']),
block('looks_show',2,'looks','stack',{1:'あらわれる',3:'現|あらわ れる'},[],['sprite']),
block('looks_hide',2,'looks','stack',{1:'かくれる',3:'隠|かく れる'},[],['sprite']),
block('looks_size',2,'looks','stack',{1:'おおきさを %1 % に する',3:'大|おお きさを %1 % に する'},[numberArg('SIZE',100,[50,100,150])],['sprite']),
block('looks_next_costume',2,'looks','stack',{1:'つぎの すがたに する',3:'次|つぎ の 姿|すがた に する'},[],['sprite']),
block('looks_color',2,'looks','stack',{1:'いろを %1 に する',3:'色|いろ を %1 に する'},[colorArg('COLOR','#f5a623')],['sprite'])
];
