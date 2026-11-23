import { living } from './living.js';
import { sky } from './sky.js';
import { voyages } from './voyages.js';

export const worlds = new Map([...living, ...sky, ...voyages].map(world => [world.id, world]));
export const fieldPlaces = [
  ['mulu','マレーシア ／ ボルネオ島','グヌン・ムル洞窟','Gunung Mulu National Park'],
  ['galapagos','エクアドル ／ 太平洋','ガラパゴス諸島','Galápagos Islands'],
  ['uyuni','ボリビア ／ アルティプラノ','ウユニ塩原','Salar de Uyuni'],
  ['palau','パラオ ／ 南ラグーン','ロックアイランド','Rock Islands Southern Lagoon'],
  ['aoraki','ニュージーランド ／ 南島','アオラキの星空','Aoraki / Mount Cook'],
  ['mcmurdo','南極 ／ ビクトリアランド','マクマード・ドライバレー','McMurdo Dry Valleys']
].map(([area, region, title, latin]) => ({
  area, region, title, latin, missions: worlds.get(area).lessons.map((_, i) => area + '_' + (i + 1))
}));

export const fieldMissions = fieldPlaces.flatMap(place => worlds.get(place.area).lessons.map((lesson, i) => ({
  id: place.missions[i], area: place.area, rank: i + 1, title: lesson.title, goal: lesson.goal, hints: [lesson.hint],
  stage: 'field', level: 3, grade: '小学生〜', subject: '探検', unit: place.title,
  fieldProgram: lesson.lines.map(line => line.initial), starter: [], check: { kind: 'field' }
})));

const covers = new Map();
export function fieldCover(area) {
  const world = worlds.get(area);
  if (!world) return '';
  if (!covers.has(area)) {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 270;
    world.draw(canvas.getContext('2d'), world.create(1, 0), 1, 1);
    covers.set(area, 'url("' + canvas.toDataURL() + '")');
  }
  return covers.get(area);
}
