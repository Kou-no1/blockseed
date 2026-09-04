export function numberArg(name, value, chips) {
  return { name: name, type: 'number', default: value, ui: 'stepper', chips: chips || [], slot: true };
}

export function stringArg(name, value) {
  return { name: name, type: 'string', default: value || '', ui: 'text', slot: true };
}

export function selectArg(name, value, options, slot) {
  return { name: name, type: 'select', default: value, ui: 'dropdown', options: options, slot: slot === true };
}

export function colorArg(name, value) {
  return { name: name, type: 'color', default: value || '#1672b8', ui: 'colorwheel', slot: false };
}

export function variableArg(name) {
  return { name: name, type: 'var', default: 'v1', ui: 'dropdown', slot: false };
}

export function functionArg(name) {
  return { name: name, type: 'func', default: 'しかく', ui: 'dropdown', slot: false };
}

export function block(type, level, category, shape, labels, args, stages) {
  return { type: type, level: level, category: category, shape: shape, labels: labels, args: args || [], stages: stages || null };
}
