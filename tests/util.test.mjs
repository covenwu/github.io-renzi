import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHanChars, localDateStr, todayStart, streakDays } from '../js/util.js';

test('extractHanChars 提取去重汉字，忽略其他字符', () => {
  assert.deepEqual(extractHanChars('天空, 天Abc123！空'), ['天', '空']);
  assert.deepEqual(extractHanChars('hello'), []);
});

test('extractHanChars 支持扩展区汉字（如 𠀀、㐀）', () => {
  assert.deepEqual(extractHanChars('天\u{20000}㐀x'), ['天', '\u{20000}', '㐀']);
});

test('localDateStr 输出本地 YYYY-MM-DD', () => {
  const ts = new Date(2026, 6, 5, 23, 30).getTime(); // 2026-07-05 本地
  assert.equal(localDateStr(ts), '2026-07-05');
});

test('todayStart 是本地零点', () => {
  const now = new Date(2026, 6, 5, 15, 0).getTime();
  assert.equal(todayStart(now), new Date(2026, 6, 5, 0, 0, 0, 0).getTime());
});

test('streakDays: 今天+昨天+前天有记录 = 3', () => {
  const now = new Date(2026, 6, 5, 10, 0).getTime();
  const day = 86400000;
  assert.equal(streakDays([now - 2 * day, now - day, now], now), 3);
});

test('streakDays: 今天没复习但昨天有，从昨天起算', () => {
  const now = new Date(2026, 6, 5, 10, 0).getTime();
  const day = 86400000;
  assert.equal(streakDays([now - day, now - 2 * day], now), 2);
});

test('streakDays: 断档只算最近连续段', () => {
  const now = new Date(2026, 6, 5, 10, 0).getTime();
  const day = 86400000;
  assert.equal(streakDays([now, now - 3 * day], now), 1);
});

test('streakDays: 无记录 = 0', () => {
  assert.equal(streakDays([], Date.now()), 0);
});
