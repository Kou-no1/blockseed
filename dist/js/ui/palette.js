import { categories, getDefinition, listDefinitions } from '../blocks/registry.js';
import { createBlock } from '../core/project.js';
import { renderBlock, labelToPlain } from './blockview.js';

export class Palette {
  constructor(tabsElement, paletteElement, searchElement, options) {
    this.tabsElement = tabsElement;
    this.paletteElement = paletteElement;
    this.searchElement = searchElement;
    this.options = options;
    this.category = 'motion';
    this.query = '';
    const palette = this;
    if (searchElement) searchElement.addEventListener('input', function () { palette.query = searchElement.value.trim().toLowerCase(); palette.renderBlocks(); });
  }

  render() {
    const state = this.options.getState();
    const visibleCategories = categories.filter(function (category) {
      return listDefinitions(state.level, state.stage, category.id, state.allowedBlocks).length > 0;
    });
    if (!visibleCategories.some((item) => item.id === this.category)) this.category = visibleCategories[0] ? visibleCategories[0].id : 'event';
    this.tabsElement.textContent = '';
    const palette = this;
    visibleCategories.forEach(function (category) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-tab category-' + category.id;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(!palette.query && palette.category === category.id));
      const icon = document.createElement('span');
      icon.className = 'cat-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = category.icon;
      const label = document.createElement('span');
      label.textContent = category.label;
      button.append(icon, label);
      button.addEventListener('click', function () {
        palette.category = category.id;
        palette.query = '';
        if (palette.searchElement) palette.searchElement.value = '';
        palette.render();
        palette.tabsElement.querySelector('.category-' + category.id)?.focus({ preventScroll: true });
      });
      palette.tabsElement.appendChild(button);
    });
    this.renderBlocks();
  }

  renderBlocks() {
    const state = this.options.getState();
    let definitions = listDefinitions(state.level, state.stage, this.query ? null : this.category, state.allowedBlocks);
    if (this.query) definitions = definitions.filter(definition => [labelToPlain(definition.type, state.level), labelToPlain(definition.type, 1), definition.type].join(' ').toLowerCase().includes(this.query));
    this.tabsElement.querySelectorAll('.category-tab').forEach(button => button.setAttribute('aria-selected', String(!this.query && button.classList.contains('category-' + this.category))));
    this.paletteElement.textContent = '';
    const list = document.createElement('div');
    list.className = 'palette-list';
    const options = this.options;
    if (!this.query && ((this.category === 'data' && state.level >= 2) || (this.category === 'function' && state.level >= 4))) {
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'palette-create';
      create.textContent = this.category === 'data' ? '＋ はこを つくる' : '＋ ブロックを つくる';
      create.addEventListener('click', function () { if (options.onCreate) options.onCreate(this.category); }.bind(this));
      list.appendChild(create);
    }
    definitions.forEach(function (definition) {
      const view = renderBlock(createBlock(definition.type, getDefinition(definition.type)), {
        level: state.level,
        project: state.project,
        rubyEnabled: state.rubyEnabled,
        palette: true,
        onPaletteTap: options.onAdd,
        onField: function () {},
        onSelect: function () {}
      });
      list.appendChild(view);
    });
    if (!definitions.length) {
      const empty = document.createElement('p');
      empty.className = 'palette-empty';
      empty.textContent = this.query ? 'みつかりません。べつの ことばを 入れてみよう。' : 'ここには まだ ブロックが ないよ';
      list.appendChild(empty);
    }
    this.paletteElement.appendChild(list);
  }
}
