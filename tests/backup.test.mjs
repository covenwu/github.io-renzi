import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { exportZip, importZip, BACKUP_VERSION } from '../js/backup.js';

const require = createRequire(import.meta.url);
const JSZip = require('../vendor/jszip.min.js');

const chars = [
  { id: 1, char: '天', photo: new Uint8Array([1, 2, 3]), learnedAt: 100,
    interval: 3, repetitions: 2, easeFactor: 2.5, nextReviewAt: 200, totalWrong: 1 },
  { id: 2, char: '空', photo: null, learnedAt: 110,
    interval: 0, repetitions: 0, easeFactor: 2.5, nextReviewAt: 110, totalWrong: 0 },
];
const logs = [
  { id: 1, charId: 1, reviewedAt: 150, remembered: true },
  { id: 2, charId: 1, reviewedAt: 90, remembered: false },
];

test('导出导入往返一致', async () => {
  const zipData = await exportZip(JSZip, chars, logs, 'uint8array');
  const r = await importZip(JSZip, zipData, 'uint8array');
  assert.equal(r.characters.length, 2);
  const c1 = r.characters.find(c => c.id === 1);
  assert.equal(c1.char, '天');
  assert.equal(c1.interval, 3);
  assert.deepEqual([...c1.photo], [1, 2, 3]);
  const c2 = r.characters.find(c => c.id === 2);
  assert.equal(c2.photo, null);
  assert.deepEqual(r.reviewLog, logs);
});

test('data.json 内含版本号，照片存为 photos/<id>.jpg', async () => {
  const zipData = await exportZip(JSZip, chars, logs, 'uint8array');
  const zip = await JSZip.loadAsync(zipData);
  const meta = JSON.parse(await zip.file('data.json').async('string'));
  assert.equal(meta.version, BACKUP_VERSION);
  assert.equal(meta.characters.find(c => c.id === 1).photo, 'photos/1.jpg');
  assert.ok(zip.file('photos/1.jpg'));
  assert.equal(zip.file('photos/2.jpg'), null);
});

test('拒绝过新的备份版本', async () => {
  const zip = new JSZip();
  zip.file('data.json', JSON.stringify({ version: 999, characters: [], reviewLog: [] }));
  const data = await zip.generateAsync({ type: 'uint8array' });
  await assert.rejects(() => importZip(JSZip, data), /版本/);
});
