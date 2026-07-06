let cachedVoice;

export function canSpeak() {
  return typeof speechSynthesis !== 'undefined';
}

function pickVoice() {
  if (cachedVoice === undefined) {
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
