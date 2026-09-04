import { block, numberArg, selectArg } from './defs.helpers.js';

export const motionDefs = [
  block('turtle_forward', 1, 'motion', 'stack', { 1: '%1 すすむ', 3: '%1 歩|ほ すすむ', 4: '%1 歩すすむ' }, [numberArg('STEPS', 50, [10, 50, 100])], ['turtle']),
  block('turtle_back', 1, 'motion', 'stack', { 1: '%1 もどる', 3: '%1 歩|ほ もどる', 4: '%1 歩もどる' }, [numberArg('STEPS', 50, [10, 50, 100])], ['turtle']),
  block('turtle_right', 1, 'motion', 'stack', { 1: 'みぎに %1 ど まわる', 3: '右|みぎ に %1 度|ど 回|まわ る', 4: '右に %1 度回る' }, [numberArg('DEG', 90, [90, 45, 180])], ['turtle']),
  block('turtle_left', 1, 'motion', 'stack', { 1: 'ひだりに %1 ど まわる', 3: '左|ひだり に %1 度|ど 回|まわ る', 4: '左に %1 度回る' }, [numberArg('DEG', 90, [90, 45, 180])], ['turtle']),
  block('turtle_home', 2, 'motion', 'stack', { 1: 'はじめの ところへ もどる', 3: '最初|さいしょ の 場所|ばしょ へ もどる' }, [], ['turtle']),
  block('turtle_goto', 3, 'motion', 'stack', { 1: 'x %1 y %2 へ いく', 3: 'x %1 y %2 へ 行|い く' }, [numberArg('X', 0), numberArg('Y', 0)], ['turtle']),
  block('turtle_setdir', 3, 'motion', 'stack', { 1: 'むきを %1 どに する', 3: '向|む きを %1 度|ど に する' }, [numberArg('DEG', 0)], ['turtle']),
  block('turtle_x', 3, 'motion', 'value', { 1: 'x', 3: 'x 座標|ざひょう' }, [], ['turtle']),
  block('turtle_y', 3, 'motion', 'value', { 1: 'y', 3: 'y 座標|ざひょう' }, [], ['turtle']),
  block('turtle_dir', 3, 'motion', 'value', { 1: 'むき', 3: '向|む き' }, [], ['turtle']),
  block('motion_move', 1, 'motion', 'stack', { 1: '%1 うごく', 3: '%1 歩|ほ 動|うご く' }, [numberArg('STEPS', 20, [10, 20, 50])], ['sprite']),
  block('motion_turn_r', 2, 'motion', 'stack', { 1: 'みぎに %1 どまわる', 3: '右|みぎ に %1 度|ど 回|まわ る' }, [numberArg('DEG', 15, [15, 45, 90])], ['sprite']),
  block('motion_turn_l', 2, 'motion', 'stack', { 1: 'ひだりに %1 どまわる', 3: '左|ひだり に %1 度|ど 回|まわ る' }, [numberArg('DEG', 15, [15, 45, 90])], ['sprite']),
  block('motion_goto_xy', 3, 'motion', 'stack', { 1: 'x %1 y %2 へ いく', 3: 'x %1 y %2 へ 行|い く' }, [numberArg('X', 0), numberArg('Y', 0)], ['sprite']),
  block('motion_glide', 3, 'motion', 'stack', { 1: '%1 びょうで x %2 y %3 へ うごく', 3: '%1 秒|びょう で x %2 y %3 へ 動|うご く' }, [numberArg('SECS', 1), numberArg('X', 0), numberArg('Y', 0)], ['sprite']),
  block('motion_bounce', 2, 'motion', 'stack', { 1: 'はしに ついたら はねかえる', 3: '端|はし に ついたら はねかえる' }, [], ['sprite']),
  block('motion_point_to', 3, 'motion', 'stack', { 1: '%1 のほうを むく', 3: '%1 の 方|ほう を 向|む く' }, [selectArg('TARGET', 'mouse', [{ v: 'mouse', label: 'マウス' }, { v: 'center', label: 'まんなか' }])], ['sprite']),
  block('motion_x', 3, 'motion', 'value', { 1: 'x ざひょう', 3: 'x 座標|ざひょう' }, [], ['sprite']),
  block('motion_y', 3, 'motion', 'value', { 1: 'y ざひょう', 3: 'y 座標|ざひょう' }, [], ['sprite'])
];
