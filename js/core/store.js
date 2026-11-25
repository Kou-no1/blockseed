import { clone, normalizeProject } from './project.js';

const INDEX_KEY = 'bs.index';
const AUTHOR_KEY = 'bs.author';
const LEVEL_KEY = 'bs.level';

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

export class ProjectStore {
  save(project) {
    const copy = clone(project);
    copy.updatedAt = Date.now();
    try {
      localStorage.setItem('bs.p.' + copy.id, JSON.stringify(copy));
      const index = this.list().filter(function (entry) { return entry.id !== copy.id; });
      index.unshift({ id: copy.id, name: copy.name, author: copy.author, level: copy.level, stage: copy.stage, missionId: copy.missionId, updatedAt: copy.updatedAt });
      localStorage.setItem(INDEX_KEY, JSON.stringify(index.slice(0, 40)));
      return copy;
    } catch (error) {
      error.code = 'E_LOAD';
      throw error;
    }
  }

  load(id) {
    const raw = readJSON('bs.p.' + id, null);
    if (!raw) return null;
    try { return normalizeProject(raw); } catch { return null; }
  }

  latest() {
    for (const entry of this.list()) {
      const project = this.load(entry.id);
      if (project) return project;
    }
    return null;
  }

  findMission(mission) {
    // Older index entries have no missionId. Read their projects as well.
    for (const entry of this.list()) {
      if (entry.missionId !== undefined && entry.missionId !== mission.id) continue;
      const draft = this.load(entry.id);
      if (draft?.missionId === mission.id && draft.stage === mission.stage &&
          (draft.stage !== 'field' || draft.fieldScene === (mission.baseId || mission.id))) return draft;
    }
    return null;
  }

  list() {
    const value = readJSON(INDEX_KEY, []);
    return Array.isArray(value) ? value.filter(entry => typeof entry?.id === 'string') : [];
  }

  remove(id) {
    localStorage.removeItem('bs.p.' + id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(this.list().filter(function (entry) { return entry.id !== id; })));
  }

  clearAll() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.indexOf('bs.') === 0) keys.push(key);
    }
    keys.forEach(function (key) { localStorage.removeItem(key); });
  }

  get author() { return localStorage.getItem(AUTHOR_KEY) || ''; }
  set author(value) { localStorage.setItem(AUTHOR_KEY, String(value || '').slice(0, 80)); }
  get level() { return Number(localStorage.getItem(LEVEL_KEY)) || 1; }
  set level(value) { localStorage.setItem(LEVEL_KEY, String(value)); }
}

export function autosave(store, getProject, onSaved, onError) {
  function save() {
    try {
      const saved = store.save(getProject());
      if (onSaved) onSaved(saved);
    } catch (error) {
      if (onError) onError(error);
    }
  }
  const timer = setInterval(save, 5000);
  const visibility = function () { if (document.visibilityState === 'hidden') save(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('beforeunload', save);
  return function () {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('beforeunload', save);
  };
}
