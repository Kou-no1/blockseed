export class EventBus {
constructor() {
this.listeners = new Map();
}

on(name, listener) {
if (!this.listeners.has(name)) this.listeners.set(name, new Set());
this.listeners.get(name).add(listener);
return () => this.off(name, listener);
}

off(name, listener) {
const group = this.listeners.get(name);
if (group) group.delete(listener);
}

emit(name, detail) {
const group = this.listeners.get(name);
if (!group) return;
Array.from(group).forEach(function (listener) {
try { listener(detail); } catch (error) { console.error(error); }
});
}
}

export const events = new EventBus();
