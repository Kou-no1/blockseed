import { clone } from './project.js';

export class History{
constructor(limit){
this.limit=limit||100;
this.past=[];
this.future=[];
}

reset(project){
this.past=[clone(project)];
this.future=[];
}

record(project){
const snapshot=clone(project);
const last=this.past[this.past.length - 1];
if(last&&JSON.stringify(last)===JSON.stringify(snapshot))return;
this.past.push(snapshot);
if(this.past.length > this.limit + 1)this.past.shift();
this.future=[];
}

undo(){
if(this.past.length <= 1)return null;
this.future.push(this.past.pop());
return clone(this.past[this.past.length - 1]);
}

redo(){
if(!this.future.length)return null;
const snapshot=this.future.pop();
this.past.push(snapshot);
return clone(snapshot);
}

get canUndo(){return this.past.length > 1;}
get canRedo(){return this.future.length > 0;}
}
