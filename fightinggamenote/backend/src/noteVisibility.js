export const DEFAULT_NOTE_VISIBILITY = 'private';

const NOTE_VISIBILITIES = new Set(['private', 'public']);

export function isNoteVisibility(value) {
  return NOTE_VISIBILITIES.has(value);
}
