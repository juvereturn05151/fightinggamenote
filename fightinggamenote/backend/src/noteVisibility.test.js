import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_NOTE_VISIBILITY,
  isNoteVisibility,
} from './noteVisibility.js';

test('new notes default to private', () => {
  assert.equal(DEFAULT_NOTE_VISIBILITY, 'private');
});

test('accepts only supported note visibility values', () => {
  assert.equal(isNoteVisibility('private'), true);
  assert.equal(isNoteVisibility('public'), true);
  assert.equal(isNoteVisibility('friends'), false);
  assert.equal(isNoteVisibility('PUBLIC'), false);
  assert.equal(isNoteVisibility(null), false);
});
