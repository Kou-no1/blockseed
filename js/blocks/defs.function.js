import { block, functionArg, numberArg, stringArg } from './defs.helpers.js';

export const functionDefs = [
  block('func_define', 4, 'function', 'hat', { 1: '%1 を ていぎする（%2）', 4: '%1（%2）を定義する' }, [stringArg('NAME', 'しかく'), stringArg('PARAMS', 'ながさ')]),
  block('func_call', 4, 'function', 'stack', { 1: '%1 を よびだす（%2）', 4: '%1（%2）を呼び出す' }, [functionArg('NAME'), stringArg('ARGS', '50')]),
  block('func_arg', 4, 'function', 'value', { 1: 'ひきすう %1', 4: '引数 %1' }, [numberArg('VALUE', 0)])
];
