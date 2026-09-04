function stop(event) { event.stopPropagation(); }

function variableOptions(arg, project) {
  if (arg.type === 'var') return (project.vars || []).map(function (item) { return { v: item.id, label: item.name }; });
  if (arg.type === 'func') return (project.funcs || []).map(function (item) { return { v: item.name, label: item.name }; });
  if (arg.name === 'LIST') return (project.lists || []).map(function (item) { return { v: item.id, label: item.name }; });
  return arg.options || [];
}

function numericStep(value) {
  const number = Math.abs(Number(value) || 0);
  if (number > 20) return 10;
  if (number < 1) return 0.1;
  return 1;
}

function openNumberPad(value, commit) {
  const old = document.querySelector('.number-pad-backdrop'); if (old) old.remove();
  let buffer = String(Number.isFinite(Number(value)) ? value : 0);
  const backdrop = document.createElement('div'); backdrop.className = 'number-pad-backdrop';
  const panel = document.createElement('section'); panel.className = 'number-pad'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'すうじを いれる');
  const readout = document.createElement('output'); readout.className = 'number-pad__readout'; readout.textContent = buffer; panel.appendChild(readout);
  const keys = document.createElement('div'); keys.className = 'number-pad__keys';
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '.', '⌫'].forEach(function (key) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = key;
    button.addEventListener('click', function () {
      if (key === '⌫') buffer = buffer.length > 1 ? buffer.slice(0, -1) : '0';
      else if (key === '−') buffer = buffer.startsWith('-') ? buffer.slice(1) || '0' : '-' + buffer;
      else if (key === '.') { if (!buffer.includes('.')) buffer += '.'; }
      else buffer = buffer === '0' ? key : buffer + key;
      readout.textContent = buffer;
    });
    keys.appendChild(button);
  });
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'やめる';
  const done = document.createElement('button'); done.type = 'button'; done.className = 'is-primary'; done.textContent = 'できた';
  const close = function () { backdrop.remove(); };
  cancel.addEventListener('click', close);
  done.addEventListener('click', function () { const number = Number(buffer); if (Number.isFinite(number)) commit(number); close(); });
  backdrop.addEventListener('click', function (event) { if (event.target === backdrop) close(); });
  keys.append(cancel, done); panel.appendChild(keys); backdrop.appendChild(panel); document.body.appendChild(backdrop);
  requestAnimationFrame(function () { const first = keys.querySelector('button'); if (first) first.focus(); });
}

export function createInput(arg, block, options) {
  const wrap = document.createElement('span');
  wrap.className = 'blk-input';
  wrap.dataset.noDrag = 'true';
  const value = block.fields[arg.name];
  const commit = function (next) { options.onField(block.id, arg.name, next); };
  wrap.addEventListener('pointerdown', stop);
  wrap.addEventListener('click', stop);

  // A palette item is one large button.  Rendering real form controls inside it
  // creates nested interactive elements and lets a stray tap edit a template
  // which is not part of the project.  Show the default as a plain chip instead.
  if (options.palette) {
    const display = document.createElement('span');
    display.className = 'blk-static';
    const choices = variableOptions(arg, options.project);
    const choice = choices.find(function (item) { return String(item.v) === String(value); });
    if (arg.type === 'bool') display.textContent = value ? 'はい' : 'いいえ';
    else display.textContent = choice ? choice.label : String(value == null ? '' : value);
    if (arg.type === 'color') {
      display.classList.add('blk-static--color');
      display.style.setProperty('--chip-color', /^#[0-9a-f]{6}$/i.test(value) ? value : '#1672b8');
      display.textContent = '';
      display.setAttribute('aria-label', String(value || 'いろ'));
    }
    wrap.classList.add('blk-input--static');
    wrap.appendChild(display);
    return wrap;
  }

  if (arg.type === 'number' && options.level <= 2) {
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'blk-step';
    minus.textContent = '−';
    minus.setAttribute('aria-label', 'へらす');
    const display = document.createElement('span');
    display.className = 'blk-number';
    display.textContent = String(value);
    display.tabIndex = 0;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'blk-step';
    plus.textContent = '＋';
    plus.setAttribute('aria-label', 'ふやす');
    minus.addEventListener('click', function () { commit((Number(value) || 0) - numericStep(value)); });
    plus.addEventListener('click', function () { commit((Number(value) || 0) + numericStep(value)); });
    if (options.level === 2) {
      display.title = 'タップで すうじを いれる';
      display.addEventListener('click', function () { openNumberPad(value, commit); });
      display.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); display.click(); } });
    } else if (arg.chips && arg.chips.length) {
      display.title = 'タップで つぎの かず';
      display.addEventListener('click', function () {
        const current = arg.chips.map(Number).indexOf(Number(value));
        commit(arg.chips[(current + 1) % arg.chips.length]);
      });
      display.addEventListener('keydown', function (event) { if (event.key === 'Enter') display.click(); });
    }
    wrap.append(minus, display, plus);
    return wrap;
  }

  if (arg.type === 'number') {
    const input = document.createElement('input');
    input.type = 'number';
    input.value = Number.isFinite(Number(value)) ? value : 0;
    input.step = 'any';
    input.setAttribute('aria-label', arg.name);
    input.addEventListener('change', function () { commit(Number(input.value)); });
    wrap.appendChild(input);
    return wrap;
  }

  if (arg.type === 'color') {
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'blk-color';
    input.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#1672b8';
    input.setAttribute('aria-label', 'いろ');
    input.addEventListener('input', function () { commit(input.value); });
    wrap.appendChild(input);
    return wrap;
  }

  const choices = variableOptions(arg, options.project);
  if (arg.type === 'select' || arg.type === 'var' || arg.type === 'func' || arg.type === 'bool' || arg.name === 'LIST') {
    const select = document.createElement('select');
    select.setAttribute('aria-label', arg.name);
    const items = arg.type === 'bool' ? [{ v: true, label: 'はい' }, { v: false, label: 'いいえ' }] : choices;
    if (!items.length) items.push({ v: value || '', label: value || 'なし' });
    items.forEach(function (item) {
      const option = document.createElement('option');
      option.value = String(item.v);
      option.textContent = item.label;
      option.selected = String(item.v) === String(value);
      select.appendChild(option);
    });
    select.addEventListener('change', function () {
      let next = select.value;
      if (arg.type === 'bool') next = next === 'true';
      else if (items.some(function (item) { return typeof item.v === 'number'; })) next = Number(next);
      commit(next);
    });
    wrap.appendChild(select);
    return wrap;
  }

  const input = document.createElement('input');
  input.type = 'text';
  input.value = value == null ? '' : String(value);
  input.maxLength = 80;
  input.setAttribute('aria-label', arg.name);
  input.addEventListener('change', function () { commit(input.value); });
  wrap.appendChild(input);
  return wrap;
}
