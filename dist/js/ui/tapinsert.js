export function preferredInsertLocation(location, definition, mode) {
  if (!location) return null;
  if ((definition.shape === 'c' || definition.shape === 'c2') && mode === 'inside') {
    return { list: location.block.body, index: location.block.body.length };
  }
  if (location.kind === 'list') return { list: location.list, index: location.index + 1 };
  return null;
}
