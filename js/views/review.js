import * as db from '../db.js';
import {
  deriveDailyStats, isGraduated, updateStat,
  applyAnswer, reinsertGap, reinsert, orderDue,
} from '../scheduler.js';
import { todayStart } from '../util.js';
import { speak, canSpeak } from '../speech.js';

export async function renderReview(root, navigate) {
  const now = Date.now();
  const due = await db.getDue(now);
  const todayLogs = await db.getLogsSince(todayStart(now));
  const stats = deriveDailyStats(
    todayLogs.filter(l => due.some(c => c.id === l.charId)));
  const byId = new Map(due.map(c => [c.id, c]));
  let queue = orderDue(due.filter(c => !isGraduated(stats.get(c.id))))
    .map(c => c.id);
  const total = queue.length;
  let doneCount = 0;
  const history = [];   // { id, remembered }
  let cursor = -1;      // -1 = 当前待答卡；>=0 = 回看 history[cursor]
  let hintShown = false;
  let photoUrl = null;
  let answering = false;

  if (!queue.length) {
    renderDone(due.length ? '今日全部识记成功 🎉' : '今天没有需要复习的字');
    return;
  }
  renderCard();

  function renderDone(msg) {
    root.innerHTML = `
      <div class="done">
        <div class="big">${msg}</div>
        <button class="btn-big" id="home">返回首页</button>
      </div>`;
    root.querySelector('#home').onclick = () => navigate('home');
  }

  function renderCard() {
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = null; }
    hintShown = false;
    const viewingPast = cursor >= 0;
    const entry = viewingPast ? history[cursor] : null;
    const id = viewingPast ? entry.id : queue[0];
    const c = byId.get(id);

    root.innerHTML = `
      <div class="topbar">
        <button class="btn-plain" id="exit">← 退出</button>
        <div class="progress">已过关 ${doneCount} / 今日 ${total}</div>
      </div>
      <div class="card">
        ${viewingPast ? `<div class="result">${entry.remembered ? '✅' : '❌'}（回看）</div>` : ''}
        <div class="hanzi">${c.char}</div>
        <img class="hint hidden">
      </div>
      <div class="toolrow">
        ${c.photo ? `<button class="btn-plain" id="hint">💡 提示</button>` : ''}
        ${canSpeak() ? `<button class="btn-plain" id="speak">🔊 发音</button>` : ''}
      </div>
      ${viewingPast ? '' : `
      <div class="answers">
        <button class="ok" id="yes">😄 记住了</button>
        <button class="no" id="no">🤔 忘了</button>
      </div>`}
      <div class="navrow">
        <button class="btn-plain" id="prev" ${history.length === 0 || cursor === 0 ? 'disabled' : ''}>◀ 上一个</button>
        <button class="btn-plain" id="next" ${viewingPast ? '' : 'disabled'}>下一个 ▶</button>
      </div>`;

    root.querySelector('#exit').onclick = () => navigate('home');
    const hintBtn = root.querySelector('#hint');
    if (hintBtn) hintBtn.onclick = () => {
      const img = root.querySelector('img.hint');
      hintShown = !hintShown;
      if (hintShown && !img.src) {
        photoUrl = URL.createObjectURL(c.photo);
        img.src = photoUrl;
      }
      img.classList.toggle('hidden', !hintShown);
    };
    const speakBtn = root.querySelector('#speak');
    if (speakBtn) speakBtn.onclick = () => speak(c.char);
    root.querySelector('#prev').onclick = () => {
      cursor = cursor === -1 ? history.length - 1 : cursor - 1;
      renderCard();
    };
    root.querySelector('#next').onclick = () => {
      if (cursor === -1) return;
      cursor = cursor >= history.length - 1 ? -1 : cursor + 1;
      renderCard();
    };
    if (!viewingPast) {
      root.querySelector('#yes').onclick = () => answer(true);
      root.querySelector('#no').onclick = () => answer(false);
    }
  }

  async function answer(remembered) {
    if (answering) return; // 防止慢速写库时双击重复作答
    answering = true;
    try {
      const id = queue[0];
      const c = byId.get(id);
      const before = stats.get(id);
      const t = Date.now();
      const { char: updated, graduated, changed } = applyAnswer(c, remembered, before, t);
      if (changed) {
        await db.putCharacter(updated);
      }
      await db.addLog({ charId: id, reviewedAt: t, remembered });
      if (changed) byId.set(id, updated);
      const after = updateStat(before, remembered);
      stats.set(id, after);
      history.push({ id, remembered });
      queue.shift();
      if (graduated) doneCount++;
      else queue = reinsert(queue, id, reinsertGap(after.wrong));
      if (!queue.length) { renderDone('今日全部识记成功 🎉'); return; }
      cursor = -1;
      renderCard();
    } catch (e) {
      alert('保存失败，请再试一次');
      renderCard(); // 写库失败时会话状态未推进，重新显示当前卡
    } finally {
      answering = false;
    }
  }
}
