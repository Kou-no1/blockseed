import { block, colorArg, numberArg, selectArg } from './defs.helpers.js';

const sensors = [{ v: 'motion', label: '人感' }, { v: 'light', label: '明るさ' }, { v: 'temp', label: '温度' }, { v: 'sound', label: '音' }, { v: 'switch', label: 'スイッチ' }];
const outputs = [{ v: 'led', label: 'LED' }, { v: 'motor', label: 'モーター' }, { v: 'buzzer', label: 'ブザー' }, { v: 'heater', label: 'ヒーター' }];
const onOff = [{ v: 1, label: 'オン' }, { v: 0, label: 'オフ' }];

export const deviceDefs = [
  block('device_sensor', 3, 'device', 'value', { 1: '%1 センサーの あたい', 3: '%1 センサーの 値|あたい' }, [selectArg('SENSOR', 'light', sensors)], ['device']),
  block('device_sensor_on', 3, 'device', 'bool', { 1: '%1 センサーが はんのうした', 3: '%1 センサーが 反応|はんのう した' }, [selectArg('SENSOR', 'motion', sensors)], ['device']),
  block('device_out_set', 3, 'device', 'stack', { 1: '%1 を %2 に する', 3: '%1 を %2 にする' }, [selectArg('OUTPUT', 'led', outputs), selectArg('STATE', 1, onOff)], ['device']),
  block('device_out_power', 4, 'device', 'stack', { 1: '%1 の つよさを %2 に する', 4: '%1 の強さを %2 にする' }, [selectArg('OUTPUT', 'motor', outputs), numberArg('POWER', 50, [0, 50, 100])], ['device']),
  block('device_led_color', 3, 'device', 'stack', { 1: 'LEDの いろを %1 に する', 3: 'LED の 色|いろ を %1 にする' }, [colorArg('COLOR', '#ffd23f')], ['device']),
  block('device_use_time', 3, 'device', 'value', { 1: 'でんきを つかった じかん', 3: '電気|でんき を 使|つか った 時間|じかん' }, [], ['device']),
  block('device_reset_use_time', 3, 'device', 'stack', { 1: 'つかった じかんを 0に する', 3: '使|つか った 時間|じかん を 0 にする' }, [], ['device'])
];
