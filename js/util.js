const DAY_MS = 86400000;

export function extractHanChars(text) {
  const seen = new Set();
  for (const ch of text) {
    if (/[一-鿿]/.test(ch)) seen.add(ch);
  }
  return [...seen];
}

export function localDateStr(ts) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function todayStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// 连续学习天数：从今天（今天无记录则从昨天）往回数连续有复习记录的天数
export function streakDays(timestamps, now = Date.now()) {
  const dates = new Set(timestamps.map(localDateStr));
  const cur = new Date(todayStart(now));
  if (!dates.has(localDateStr(cur.getTime()))) cur.setDate(cur.getDate() - 1);
  let n = 0;
  while (dates.has(localDateStr(cur.getTime()))) {
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

export { DAY_MS };
