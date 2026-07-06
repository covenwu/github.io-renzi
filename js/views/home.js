import * as db from '../db.js';
import { streakDays } from '../util.js';

const BACKUP_REMIND_MS = 30 * 86400000;

export async function renderHome(root, navigate) {
  const now = Date.now();
  const [due, all, logs, lastBackupAt] = await Promise.all([
    db.getDue(now), db.getAllCharacters(), db.getAllLogs(),
    db.getSetting('lastBackupAt'),
  ]);
  const streak = streakDays(logs.map(l => l.reviewedAt), now);
  const needBackup = all.length > 0 &&
    (!lastBackupAt || now - lastBackupAt > BACKUP_REMIND_MS);

  root.innerHTML = `
    <h1>认字</h1>
    ${needBackup ? `<div class="banner">📦 已超过 30 天未备份，建议到「字库」页导出备份</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="num">${due.length}</div><div class="lbl">待复习</div></div>
      <div class="stat"><div class="num">${all.length}</div><div class="lbl">字库总数</div></div>
      <div class="stat"><div class="num">${streak}</div><div class="lbl">连续天数</div></div>
    </div>
    <button class="btn-big" id="go-review">📖 开始复习</button>
    <button class="btn-big alt" id="go-input">✏️ 录入新字</button>
    <div class="toolrow">
      <button class="btn-plain" id="go-library">字库 / 设置</button>
    </div>`;
  root.querySelector('#go-review').onclick = () => navigate('review');
  root.querySelector('#go-input').onclick = () => navigate('input');
  root.querySelector('#go-library').onclick = () => navigate('library');
}
