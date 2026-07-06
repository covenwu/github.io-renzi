import * as db from '../db.js';
import { newCharacter } from '../scheduler.js';
import { extractHanChars } from '../util.js';
import { compressImage } from '../photo.js';

export async function renderInput(root, navigate) {
  root.innerHTML = `
    <div class="topbar">
      <button class="btn-plain" id="back">← 返回</button>
      <h1>录入新字</h1>
    </div>
    <textarea id="text" placeholder="输入或粘贴汉字，可一次多个，如：天空大地"></textarea>
    <button class="btn-big" id="save">入库</button>
    <div id="result"></div>`;
  root.querySelector('#back').onclick = () => navigate('home');

  root.querySelector('#save').onclick = async () => {
    const hanChars = extractHanChars(root.querySelector('#text').value);
    if (!hanChars.length) {
      root.querySelector('#result').innerHTML = `<p>没有识别到汉字</p>`;
      return;
    }
    const now = Date.now();
    const added = [];
    let skipped = 0;
    for (const ch of hanChars) {
      const id = await db.addCharacter(newCharacter(ch, now));
      if (id === null) skipped++;
      else added.push({ id, ch });
    }
    const items = added.map(a => `
      <div class="charitem" data-id="${a.id}">
        <span>${a.ch}</span>
        <label class="btn-plain">📷 提示照片
          <input type="file" accept="image/*" capture="environment" class="hidden">
        </label>
        <small class="status"></small>
      </div>`).join('');
    root.querySelector('#result').innerHTML = `
      <p>新增 ${added.length} 个字${skipped ? `，跳过重复 ${skipped} 个` : ''}。
         可为每个字拍一张提示照片（可选）：</p>
      <div class="charlist">${items}</div>`;

    for (const item of root.querySelectorAll('.charitem')) {
      const input = item.querySelector('input[type=file]');
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        const status = item.querySelector('.status');
        try {
          status.textContent = '压缩中…';
          const blob = await compressImage(file);
          const id = Number(item.dataset.id);
          const chars = await db.getAllCharacters();
          const c = chars.find(x => x.id === id);
          c.photo = blob;
          await db.putCharacter(c);
          status.textContent = '✓ 已保存';
        } catch (e) {
          status.textContent = '保存失败：' + e.message;
        }
      };
    }
  };
}
