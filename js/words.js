// 组词辅助：离线二字词表（vendor/words2.txt，按词频降序）

let wordsPromise;

// 浏览器端加载词表（SW 已预缓存，离线可用）；失败返回空数组静默降级
export function loadWords() {
  wordsPromise ??= fetch('vendor/words2.txt')
    .then(r => r.text())
    .then(t => t.split(/\r?\n/).map(w => w.trim()).filter(w => w.length === 2))
    .catch(() => []);
  return wordsPromise;
}

// 纯逻辑：char 与 libCharSet 中的字能组成的词，保持词表（词频）顺序，最多 limit 个
export function matchWords(words, char, libCharSet, limit = 4) {
  const out = [];
  for (const w of words) {
    if ((w[0] === char && libCharSet.has(w[1])) ||
        (w[1] === char && libCharSet.has(w[0]))) {
      out.push(w);
      if (out.length >= limit) break;
    }
  }
  return out;
}
