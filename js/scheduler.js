export const DAY_MS = 86400000;
export const EF_INIT = 2.5;
export const EF_MIN = 1.3;
export const EF_MAX = 2.8;

export function newCharacter(char, now) {
  return {
    char, photo: null, learnedAt: now,
    interval: 0, repetitions: 0, easeFactor: EF_INIT,
    nextReviewAt: now, totalWrong: 0,
  };
}

// stat = { wrong: 当天答错次数, streak: 当前连续答对次数 }
export function isGraduated(stat) {
  if (!stat) return false;
  return stat.wrong === 0 ? stat.streak >= 1 : stat.streak >= 2;
}

export function updateStat(stat, remembered) {
  const s = stat || { wrong: 0, streak: 0 };
  return remembered
    ? { wrong: s.wrong, streak: s.streak + 1 }
    : { wrong: s.wrong + 1, streak: 0 };
}

export function deriveDailyStats(todayLogs) {
  const map = new Map();
  for (const log of todayLogs) {
    map.set(log.charId, updateStat(map.get(log.charId), log.remembered));
  }
  return map;
}

export function reinsertGap(wrong) {
  return wrong >= 3 ? 2 : wrong === 2 ? 4 : 6;
}

export function reinsert(queue, id, gap) {
  const q = queue.filter(x => x !== id);
  q.splice(Math.min(gap, q.length), 0, id);
  return q;
}

export function orderDue(chars) {
  return [...chars].sort(
    (a, b) => a.nextReviewAt - b.nextReviewAt || b.totalWrong - a.totalWrong
  );
}

// 返回 { char, graduated, changed }；changed=false 表示无需写库
export function applyAnswer(char, remembered, statBefore, now) {
  const s = statBefore || { wrong: 0, streak: 0 };
  if (!remembered) {
    if (s.wrong > 0) return { char: { ...char }, graduated: false, changed: false };
    return {
      char: {
        ...char, repetitions: 0, interval: 0, nextReviewAt: now,
        easeFactor: Math.max(char.easeFactor - 0.2, EF_MIN),
        totalWrong: char.totalWrong + 1,
      },
      graduated: false, changed: true,
    };
  }
  const after = updateStat(s, true);
  if (!isGraduated(after)) return { char: { ...char }, graduated: false, changed: false };
  const repetitions = char.repetitions + 1;
  const interval = repetitions === 1 ? 1
    : repetitions === 2 ? 3
    : Math.round(char.interval * char.easeFactor);
  return {
    char: {
      ...char, repetitions, interval,
      easeFactor: Math.min(char.easeFactor + 0.05, EF_MAX),
      nextReviewAt: now + interval * DAY_MS,
    },
    graduated: true, changed: true,
  };
}
