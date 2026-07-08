import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchWords } from '../js/words.js';

// 词表按词频降序，matchWords 应保持该顺序
const WORDS = ['天空', '明天', '大地', '天天', '空气', '地方'];

test('匹配该字在前/在后的词，且另一字必须在字库中', () => {
  const lib = new Set(['天', '空', '明']);
  assert.deepEqual(matchWords(WORDS, '天', lib), ['天空', '明天', '天天']);
});

test('另一字不在字库则不匹配', () => {
  const lib = new Set(['天']);
  assert.deepEqual(matchWords(WORDS, '天', lib), ['天天']); // 只有叠词两字都在库
});

test('limit 生效且保持词频顺序', () => {
  const lib = new Set(['天', '空', '明']);
  assert.deepEqual(matchWords(WORDS, '天', lib, 2), ['天空', '明天']);
});

test('无匹配返回空数组', () => {
  assert.deepEqual(matchWords(WORDS, '水', new Set(['水', '天'])), []);
});

test('真实词表：天空/明天 可被匹配到', () => {
  const words = readFileSync(new URL('../vendor/words2.txt', import.meta.url), 'utf-8')
    .split('\n').filter(w => w.length === 2);
  assert.ok(words.length >= 19000, '词表规模');
  const lib = new Set(['天', '空', '明']);
  const m = matchWords(words, '天', lib, 10);
  assert.ok(m.includes('天空'), '天空 应在匹配结果中: ' + m.join(','));
  assert.ok(m.includes('明天'), '明天 应在匹配结果中: ' + m.join(','));
});
