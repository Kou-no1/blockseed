export function preferredInsertLocation(location,definition,mode){
if(!location)return null;
if((definition.shape==='c'||definition.shape==='c2')&&(mode==='inside'||mode==='else')){
const key=mode==='else'&&definition.shape==='c2' ? 'body2':'body';
if(!Array.isArray(location.block[key]))location.block[key]=[];
return{list:location.block[key],index:location.block[key].length};
}
if(location.kind==='list'){
const before=mode==='before'&&definition.shape!=='hat';
return{list:location.list,index:location.index +(before ? 0:1)};
}
return null;
}
