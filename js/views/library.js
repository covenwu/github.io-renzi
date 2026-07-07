import * as db from '../db.js';
import { exportZip, importZip } from '../backup.js';
import { localDateStr } from '../util.js';

export async function renderLibrary(root, navigate) {
  const chars = (await db.getAllCharacters())
    .sort((a, b) => b.learnedAt - a.learnedAt);
  let usage = '';
  try {
    const est = await navigator.storage.estimate();
    usage = `存储占用约 ${(est.usage / 1024 / 1024).toFixed(1)} MB`;
  } catch { /* 不支持则不显示 */ }
  let version = '';
  try {
    // 用 SW 缓存名当版本标识，便于确认设备实际运行的版本
    version = (await caches.keys()).find(k => k.startsWith('renzi-')) || '';
  } catch { /* 不支持则不显示 */ }

  const items = chars.map(c => `
    <div class="libitem" data-id="${c.id}">
      <div class="hz">${c.char}</div>
      <div class="meta">下次复习 ${localDateStr(c.nextReviewAt)} · 答错 ${c.totalWrong} 次</div>
      <button class="btn-plain btn-danger del">删除</button>
    </div>`).join('');

  root.innerHTML = `
    <div class="topbar">
      <button class="btn-plain" id="back">← 返回</button>
      <h1>字库 / 设置</h1>
    </div>
    <p>共 ${chars.length} 个汉字${usage ? ' · ' + usage : ''}${version ? ' · ' + version : ''}</p>
    <div class="toolrow">
      <button class="btn-plain" id="export">📦 导出备份</button>
      <label class="btn-plain">📥 导入
        <input type="file" accept=".zip" id="import" class="hidden">
      </label>
    </div>
    <div id="list">${items || '<p>还没有汉字，去录入吧</p>'}</div>`;

  root.querySelector('#back').onclick = () => navigate('home');

  root.querySelector('#export').onclick = async () => {
    try {
      const logs = await db.getAllLogs();
      const blob = await exportZip(window.JSZip, chars, logs, 'blob');
      const name = `renzi-backup-${localDateStr(Date.now())}.zip`;
      const file = new File([blob], name, { type: 'application/zip' });
      if (navigator.canShare?.({ files: [file] })) {
        // iOS 主屏幕应用不支持 a[download] 下载（静默无反应），走系统分享面板（可选"存储到文件"）
        await navigator.share({ files: [file], title: '认字备份' });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000); // 立即撤销会与下载启动竞争
      }
      await db.setSetting('lastBackupAt', Date.now());
    } catch (err) {
      if (err.name !== 'AbortError') alert('导出失败：' + err.message); // 用户取消分享面板不算错误
    }
  };

  root.querySelector('#import').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirm('导入将覆盖现有全部数据，确定继续？')) return;
    try {
      const { characters, reviewLog, missingPhotos } = await importZip(window.JSZip, file);
      await db.replaceAll(characters, reviewLog);
      let msg = `导入成功：${characters.length} 个字，${reviewLog.length} 条复习记录`;
      if (missingPhotos.length) {
        msg += `\n注意：${missingPhotos.length} 张提示照片缺失（${missingPhotos.join('、')}）`;
      }
      alert(msg);
      renderLibrary(root, navigate);
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  };

  for (const item of root.querySelectorAll('.libitem')) {
    item.querySelector('.del').onclick = async () => {
      const hz = item.querySelector('.hz').textContent;
      if (!confirm(`删除「${hz}」及其全部复习记录？`)) return;
      await db.deleteCharacter(Number(item.dataset.id));
      renderLibrary(root, navigate);
    };
  }
}
