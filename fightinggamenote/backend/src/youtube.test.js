import test from 'node:test';
import assert from 'node:assert/strict';
import { extractYouTubeVideoId } from './youtube.js';

const VIDEO_ID = 'dQw4w9WgXcQ';

test('extracts IDs from supported YouTube URLs', () => {
  const urls = [
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?v=${VIDEO_ID}&t=10`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?si=example`,
    `https://www.youtube.com/shorts/${VIDEO_ID}`,
    `https://www.youtube.com/embed/${VIDEO_ID}`,
  ];

  for (const url of urls) {
    assert.equal(extractYouTubeVideoId(url), VIDEO_ID);
  }
});

test('rejects unrelated and misleading hosts', () => {
  const urls = [
    `https://example.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com.evil.example/watch?v=${VIDEO_ID}`,
    `https://www.youtube.com@evil.example/watch?v=${VIDEO_ID}`,
    `https://evil.example/youtu.be/${VIDEO_ID}`,
  ];

  for (const url of urls) {
    assert.throws(() => extractYouTubeVideoId(url));
  }
});

test('rejects malformed URLs, IDs, credentials, ports, and arbitrary paths', () => {
  const urls = [
    '',
    'not a URL',
    'javascript:alert(1)',
    'https://youtu.be/too-short',
    `https://user:password@youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com:444/watch?v=${VIDEO_ID}`,
    `https://youtube.com/channel/${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}/extra`,
  ];

  for (const url of urls) {
    assert.throws(() => extractYouTubeVideoId(url));
  }
});
