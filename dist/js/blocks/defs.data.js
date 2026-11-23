import { block, numberArg, stringArg, variableArg } from './defs.helpers.js';

export const dataDefs = [
block('data_var', 2, 'data', 'value', { 1: '%1', 3: '変数|へんすう %1' }, [variableArg('VAR')]),
block('data_set', 2, 'data', 'stack', { 1: '%1 を %2 に する', 3: '変数|へんすう %1 を %2 にする' }, [variableArg('VAR'), numberArg('VALUE', 0)]),
block('data_change', 2, 'data', 'stack', { 1: '%1 を %2 ずつ かえる', 3: '変数|へんすう %1 を %2 ずつ 変|か える' }, [variableArg('VAR'), numberArg('VALUE', 1)]),
block('data_show_var', 3, 'data', 'stack', { 1: '%1 を みせる', 3: '変数|へんすう %1 を 見|み せる' }, [variableArg('VAR')]),
block('data_hide_var', 3, 'data', 'stack', { 1: '%1 を かくす', 3: '変数|へんすう %1 を 隠|かく す' }, [variableArg('VAR')]),
block('data_list_add', 4, 'data', 'stack', { 1: '%1 に %2 を いれる', 4: 'リスト %1 に %2 を入れる' }, [{ name: 'LIST', type: 'select', default: 'l1', ui: 'dropdown', slot: false }, stringArg('VALUE', '')]),
block('data_list_item', 4, 'data', 'value', { 1: '%1 の %2 ばんめ', 4: 'リスト %1 の %2 番目' }, [{ name: 'LIST', type: 'select', default: 'l1', ui: 'dropdown', slot: false }, numberArg('INDEX', 1)]),
block('data_list_len', 4, 'data', 'value', { 1: '%1 の ながさ', 4: 'リスト %1 の長さ' }, [{ name: 'LIST', type: 'select', default: 'l1', ui: 'dropdown', slot: false }]),
block('data_list_del', 4, 'data', 'stack', { 1: '%1 の %2 ばんめを けす', 4: 'リスト %1 の %2 番目を消す' }, [{ name: 'LIST', type: 'select', default: 'l1', ui: 'dropdown', slot: false }, numberArg('INDEX', 1)]),
block('data_list_clear', 4, 'data', 'stack', { 1: '%1 を からにする', 4: 'リスト %1 を空にする' }, [{ name: 'LIST', type: 'select', default: 'l1', ui: 'dropdown', slot: false }])
];
