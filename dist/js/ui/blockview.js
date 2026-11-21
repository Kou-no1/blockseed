import { getDefinition, getLabel } from '../blocks/registry.js';
import { createInput } from './inputs.js';
import { UI } from './labels.js';

function appendRubyText(parent, text, rubyEnabled) {
  const expression = /([^\s|]+)\|([^\s]+)/g;
  let cursor = 0;
  let match;
  while ((match = expression.exec(text))) {
    if (match.index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    if (rubyEnabled) {
      const ruby = document.createElement('ruby');
      ruby.appendChild(document.createTextNode(match[1]));
      const rt = document.createElement('rt');
      rt.textContent = match[2];
      ruby.appendChild(rt);
      parent.appendChild(ruby);
    } else {
      parent.appendChild(document.createTextNode(match[1]));
    }
    cursor = expression.lastIndex;
  }
  if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
}

export function plainLabel(definition, block, level) {
  let label = getLabel(definition, level).replace(/([^\s|]+)\|([^\s]+)/g, '$1');
  (definition.args || []).forEach(function (arg, index) {
    const input = block.inputs && block.inputs[arg.name];
    const value = input ? getLabel(getDefinition(input.type), level).replace(/([^\s|]+)\|([^\s]+)/g, '$1').replace(/%\d+/g, '') : block.fields[arg.name];
    label = label.replace('%' + (index + 1), String(value == null ? '' : value));
  });
  return label.replace(/\s+/g, ' ').trim();
}

function makeLabel(block, definition, options) {
  const label = document.createElement('span');
  label.className = 'blk-label';
  const parts = getLabel(definition, options.level).split(/(%\d+)/);
  parts.forEach(function (part) {
    const match = /^%(\d+)$/.exec(part);
    if (!match) {
      appendRubyText(label, part, options.rubyEnabled);
      return;
    }
    const arg = definition.args[Number(match[1]) - 1];
    if (!arg) return;
    const inputBlock = block.inputs && block.inputs[arg.name];
    if (inputBlock) {
      const inputView = renderBlock(inputBlock, Object.assign({}, options, { inline: true }));
      inputView.classList.add('blk--inline');
      label.appendChild(inputView);
    } else {
      label.appendChild(createInput(arg, block, options));
    }
  });
  return label;
}

function appendBody(root, block, key, options) {
  const body = document.createElement('div');
  body.className = 'blk-body';
  body.dataset.parentId = block.id;
  body.dataset.bodyKey = key;
  const list = block[key] || [];
  if (!list.length) {
    const hint = document.createElement('span');
    hint.className = 'blk-body__hint';
    hint.textContent = UI.emptyBody;
    body.appendChild(hint);
  } else {
    list.forEach(function (child) { body.appendChild(renderBlock(child, options)); });
  }
  if (!options.palette && options.onBody) {
    body.addEventListener('click', function (event) {
      if (event.target.closest('.blk') !== root) return;
      event.stopPropagation();
      options.onBody(block.id, key);
    });
  }
  root.appendChild(body);
}

export function renderBlock(block, options) {
  const definition = getDefinition(block.type);
  const root = document.createElement('div');
  root.className = 'blk blk--' + definition.shape + ' blk-category-' + definition.category;
  root.dataset.id = block.id;
  root.dataset.type = block.type;
  root.dataset.source = options.palette ? 'palette' : 'editor';
  root.tabIndex = 0;
  root.setAttribute('role', options.palette ? 'button' : 'group');
  if (!options.palette) root.setAttribute('aria-roledescription', 'プログラム ブロック');
  root.setAttribute('aria-label', plainLabel(definition, block, options.level));
  if (definition.unknown) root.classList.add('blk--unknown');
  if (options.selectedId === block.id) root.classList.add('is-selected');
  if (options.runningId === block.id) root.classList.add('is-running');

  if (definition.shape === 'c' || definition.shape === 'c2') {
    const band = document.createElement('div');
    band.className = 'blk-band';
    band.appendChild(makeLabel(block, definition, options));
    root.appendChild(band);
    appendBody(root, block, 'body', options);
    if (definition.shape === 'c2') {
      const elseBand = document.createElement('div');
      elseBand.className = 'blk-band blk-band--else';
      elseBand.textContent = options.level <= 2 ? 'でなければ' : 'でなければ';
      root.appendChild(elseBand);
      appendBody(root, block, 'body2', options);
    }
    const foot = document.createElement('div');
    foot.className = 'blk-foot';
    root.appendChild(foot);
  } else {
    root.appendChild(makeLabel(block, definition, options));
  }

  root.addEventListener('click', function (event) {
    if (root.dataset.dragged === '1' || event.target.closest('[data-no-drag]')) return;
    event.stopPropagation();
    if (options.palette) options.onPaletteTap(block.type);
    else options.onSelect(block.id);
  });
  root.addEventListener('keydown', function (event) {
    if (event.target !== root || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (options.palette) options.onPaletteTap(block.type);
    else options.onSelect(block.id);
  });
  return root;
}

export function labelToPlain(type, level) {
  return getLabel(getDefinition(type), level).replace(/([^\s|]+)\|([^\s]+)/g, '$1').replace(/%\d+/g, '').replace(/\s+/g, ' ').trim();
}
