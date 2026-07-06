let cachedVoice;

export function canSpeak() {
  return typeof speechSynthesis !== 'undefined';
}

function pickVoice() {
  // Safari 的 getVoices() 首次常返回空且 onvoiceschanged 未必触发，
  // 未找到时不缓存 null，下次调用继续重试
  if (!cachedVoice) {
    cachedVoice = speechSynthesis.getVoices()
      .find(v => v.lang.replace('_', '-').startsWith('zh')) || null;
  }
  return cachedVoice;
}

// 发音失败静默降级（设计文档 §8）
export function speak(text) {
  if (!canSpeak()) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.8;
    const v = pickVoice();
    if (v) u.voice = v;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch { /* 静默 */ }
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = () => { cachedVoice = undefined; };
}
