import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCharacter, isGraduated, updateStat, deriveDailyStats,
  reinsertGap, reinsert, orderDue, applyAnswer, DAY_MS, EF_INIT
} from '../js/scheduler.js';

const NOW = new Date(2026, 6, 5, 10, 0).getTime();

function mkChar(over = {}) {
  return { id: 1, ...newCharacter('天', NOW - DAY_MS), ...over };
}

test('newCharacter 立即到期、初始参数正确', () => {
  const c = newCharacter('天', NOW);
  assert.equal(c.nextReviewAt, NOW);
  assert.equal(c.interval, 0);
  assert.equal(c.repetitions, 0);
  assert.equal(c.easeFactor, EF_INIT);
  assert.equal(c.totalWrong, 0);
  assert.equal(c.photo, null);
});

test('过关判定：没错过答对1次即过关；错过需连续2次', () => {
  assert.equal(isGraduated({ wrong: 0, streak: 1 }), true);
  assert.equal(isGraduated({ wrong: 0, streak: 0 }), false);
  assert.equal(isGraduated({ wrong: 1, streak: 1 }), false);
  assert.equal(isGraduated({ wrong: 1, streak: 2 }), true);
  assert.equal(isGraduated(undefined), false);
});

test('updateStat：答错清零连击并加错误数', () => {
  assert.deepEqual(updateStat({ wrong: 1, streak: 1 }, false), { wrong: 2, streak: 0 });
  assert.deepEqual(updateStat(undefined, true), { wrong: 0, streak: 1 });
});

test('deriveDailyStats 从当天日志推导（可恢复中断会话）', () => {
  const logs = [
    { charId: 1, remembered: false },
    { charId: 1, remembered: true },
    { charId: 2, remembered: true },
  ];
  const m = deriveDailyStats(logs);
  assert.deepEqual(m.get(1), { wrong: 1, streak: 1 });
  assert.deepEqual(m.get(2), { wrong: 0, streak: 1 });
});

test('reinsertGap：错1次6张、2次4张、≥3次2张', () => {
  assert.equal(reinsertGap(1), 6);
  assert.equal(reinsertGap(2), 4);
  assert.equal(reinsertGap(3), 2);
  assert.equal(reinsertGap(5), 2);
});

test('reinsert 插到 gap 位置，队列不足则排尾', () => {
  assert.deepEqual(reinsert([2, 3, 4], 9, 2), [2, 3, 9, 4]);
  assert.deepEqual(reinsert([2], 9, 6), [2, 9]);
  assert.deepEqual(reinsert([], 9, 2), [9]);
});

test('orderDue：逾期最久优先，同期按 totalWrong 降序', () => {
  const a = mkChar({ id: 1, nextReviewAt: 100, totalWrong: 0 });
  const b = mkChar({ id: 2, nextReviewAt: 50, totalWrong: 0 });
  const c = mkChar({ id: 3, nextReviewAt: 100, totalWrong: 5 });
  assert.deepEqual(orderDue([a, b, c]).map(x => x.id), [2, 3, 1]);
});

test('新字答对即过关：interval=1天', () => {
  const { char, graduated, changed } = applyAnswer(mkChar(), true, undefined, NOW);
  assert.equal(graduated, true);
  assert.equal(changed, true);
  assert.equal(char.repetitions, 1);
  assert.equal(char.interval, 1);
  assert.equal(char.nextReviewAt, NOW + DAY_MS);
  assert.equal(char.easeFactor, EF_INIT + 0.05);
});

test('第二次过关 interval=3天，第三次按难度系数', () => {
  const c2 = mkChar({ repetitions: 1, interval: 1 });
  assert.equal(applyAnswer(c2, true, undefined, NOW).char.interval, 3);
  const c3 = mkChar({ repetitions: 2, interval: 3, easeFactor: 2.5 });
  const r = applyAnswer(c3, true, undefined, NOW);
  assert.equal(r.char.interval, 8); // round(3 * 2.5)
  assert.equal(r.char.nextReviewAt, NOW + 8 * DAY_MS);
});

test('当天首错：重置进度、扣难度、totalWrong+1、立即到期', () => {
  const c = mkChar({ repetitions: 3, interval: 8, easeFactor: 2.0, totalWrong: 1 });
  const { char, graduated, changed } = applyAnswer(c, false, undefined, NOW);
  assert.equal(graduated, false);
  assert.equal(changed, true);
  assert.equal(char.repetitions, 0);
  assert.equal(char.interval, 0);
  assert.equal(char.nextReviewAt, NOW);
  assert.equal(char.easeFactor, 1.8);
  assert.equal(char.totalWrong, 2);
});

test('当天再错：不重复惩罚（char 无变化）', () => {
  const c = mkChar({ easeFactor: 1.8, totalWrong: 2 });
  const { char, changed } = applyAnswer(c, false, { wrong: 1, streak: 0 }, NOW);
  assert.equal(changed, false);
  assert.equal(char.easeFactor, 1.8);
  assert.equal(char.totalWrong, 2);
});

test('错过的字第1次答对不过关不写库，第2次连续答对才过关', () => {
  const c = mkChar();
  const first = applyAnswer(c, true, { wrong: 1, streak: 0 }, NOW);
  assert.equal(first.graduated, false);
  assert.equal(first.changed, false);
  const second = applyAnswer(c, true, { wrong: 1, streak: 1 }, NOW);
  assert.equal(second.graduated, true);
  assert.equal(second.char.repetitions, 1);
  assert.equal(second.char.interval, 1);
});

test('难度系数边界：上限2.8下限1.3', () => {
  const hi = applyAnswer(mkChar({ easeFactor: 2.79 }), true, undefined, NOW);
  assert.equal(hi.char.easeFactor, 2.8);
  const lo = applyAnswer(mkChar({ easeFactor: 1.35 }), false, undefined, NOW);
  assert.equal(lo.char.easeFactor, 1.3);
});

test('reinsert 对已在队列中的 id 是移动而非重复', () => {
  assert.deepEqual(reinsert([2, 9, 4], 9, 6), [2, 4, 9]);
});

test('生命周期集成：错→对(不写库)→对(过关)，与调用方 updateStat 保持一致', () => {
  const c0 = mkChar({ repetitions: 2, interval: 3, easeFactor: 2.0, totalWrong: 0 });
  // 第一次答错：一次性惩罚
  let stat;
  const r1 = applyAnswer(c0, false, stat, NOW);
  stat = updateStat(stat, false);
  assert.equal(r1.changed, true);
  assert.deepEqual(stat, { wrong: 1, streak: 0 });
  assert.equal(r1.char.easeFactor, 1.8);
  assert.equal(r1.char.repetitions, 0);
  const c1 = r1.char;
  // 第一次答对：streak 1，不过关，不写库
  const r2 = applyAnswer(c1, true, stat, NOW);
  stat = updateStat(stat, true);
  assert.equal(r2.changed, false);
  assert.equal(r2.graduated, false);
  assert.deepEqual(stat, { wrong: 1, streak: 1 });
  // 第二次连续答对：过关，interval 回到 1 天，脏浮点 EF 不影响取整
  const r3 = applyAnswer(c1, true, stat, NOW);
  stat = updateStat(stat, true);
  assert.equal(r3.graduated, true);
  assert.equal(r3.char.repetitions, 1);
  assert.equal(r3.char.interval, 1);
  assert.equal(r3.char.nextReviewAt, NOW + DAY_MS);
  assert.equal(isGraduated(stat), true);
});
