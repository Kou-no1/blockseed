export class Stage {
init() {}
reset() {}
render() {}
tick() {}
getAPI() { return {}; }
serialize() { return {}; }
restore() {}
captureThumbnail() { return ''; }
}

export function clamp(value, min, max) {
return Math.max(min, Math.min(max, Number(value) || 0));
}
