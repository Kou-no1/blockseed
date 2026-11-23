const places=[
{area:'patagonia',missions:['intro_square','paine_long_route','paine_rectangle'],region:'チリ共和国 ／ パタゴニア',title:'トーレス・デル・パイネ',latin:'Torres del Paine National Park'},
{area:'namib',missions:['sossusvlei_survey','namib_dune_turn','namib_hexagon'],region:'ナミビア ／ ナミブ砂漠',title:'ソススフレイ',latin:'Sossusvlei, Namib Desert'},
{area:'yakushima',missions:['yakushima_canopy','yakushima_visitor','yakushima_night'],region:'日本 ／ 鹿児島県',title:'屋久島',latin:'Yakushima Island'}
];

const trail=places.flatMap(place=>place.missions);
const progressKey='bs.expedition.v1';

export function createCampaign(storage){
let count=0;
let saved=true;
if(storage===undefined){
try{storage=globalThis.localStorage;}catch{storage=null;}
}
function refresh(){
if(!storage||!saved)return;
try{
const value=Number(storage.getItem(progressKey));
count=Number.isInteger(value)&&value >= 0&&value <= trail.length ? value:0;
}catch{saved=false;}
}
function write(){
try{storage.setItem(progressKey,String(count));saved=true;}
catch{saved=false;}
}
return{
info(id){
const index=trail.indexOf(id);
if(index < 0)return null;
refresh();
const place=places.find(place=>place.missions.includes(id));
const rank=place.missions.indexOf(id)+ 1;
const completed=Math.max(0,Math.min(place.missions.length,count - index + rank - 1));
return{area:place.area,rank,unlocked:index <= count,cleared:index < count,
completed,total:place.missions.length,nextId:trail[index + 1]||null,allDone:count===trail.length};
},
firstOpen(){refresh();return trail[Math.min(count,trail.length - 1)];},
isUnlocked(id){refresh();return trail.indexOf(id)<= count;},
complete(id){
refresh();
if(count >= trail.length||trail[count]!==id)return false;
count++;
write();
return true;
},
reset(){count=0;write();},
get persisted(){return saved&&Boolean(storage);}
};
}

export const campaign=createCampaign();

export function renderLandscape(missionId){
const place=places.find(item=>item.missions.includes(missionId))||places[0];
document.getElementById('landscape').dataset.area=place.area;
for(const key of['region','title','latin']){
document.getElementById('place-' + key).textContent=place[key];
}
return place.area;
}

export function destinationMenu(getMission,start,lockedLevel,currentId){
const list=document.createElement('div');
list.className='dialog-content site-list';
for(const[index,place]of places.entries()){
const stop=document.createElement('section');
const head=document.createElement('div');
head.className='trail-head';
const photo=document.createElement('span');
photo.className='site-thumb site-thumb--' + place.area;
const title=document.createElement('h3');
title.textContent=place.title;
const status=document.createElement('span');
const first=campaign.info(place.missions[0]);
status.textContent = first.completed + ' / 3 クリア';
head.append(photo,title,status);
stop.appendChild(head);
if(!first.unlocked){
const hint=document.createElement('p');
hint.textContent='🔒 ' + places[index - 1].title + 'の お題を3つクリアすると開くよ。';
stop.appendChild(hint);
}else{
for(const id of place.missions){
const mission=getMission(id),state=campaign.info(id);
const choice=document.createElement('button');
choice.type='button';
choice.dataset.mission=id;
const restricted=lockedLevel&&mission.level > lockedLevel;
choice.disabled=!state.unlocked||Boolean(restricted);
const status=restricted ? '先生のレベル設定中':state.cleared ? '✓ クリア':
!state.unlocked ? '前のお題で開く':currentId===id ? '挑戦中':'挑戦する';
const label=document.createElement('span');
label.textContent=state.rank + '. ' +['はじめの一歩','ちょうせん','うでだめし'][state.rank - 1]+ '　' + mission.title;
const badge=document.createElement('small');
badge.textContent=status;
choice.append(label,badge);
choice.addEventListener('click',()=>start(mission));
stop.appendChild(choice);
}
}
list.appendChild(stop);
}
return list;
}

export function showMobileView(view){
const workspace=document.getElementById('workspace');
workspace.dataset.view=view;
workspace.classList.toggle('mobile-stage',view==='stage');
for(const button of document.querySelectorAll('[data-mobile-view]')){
const active=button.dataset.mobileView===view;
button.classList.toggle('is-active',active);
button.setAttribute('aria-pressed',String(active));
}
}
