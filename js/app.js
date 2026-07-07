import * as db from './db.js';
import { renderHome } from './views/home.js';
import { renderInput } from './views/input.js';
import { renderReview } from './views/review.js';
import { renderLibrary } from './views/library.js';

// 照片格式迁移：旧版把照片存为 Blob，WebKit 的 IDB Blob 旁挂机制在记录被
// 改写后会使照片永久悬空。新格式一律存 ArrayBuffer（字节内联）。
// 可读的旧照片就地转换；已损坏（不可读）的置空，可在字库页重拍。
async function migratePhotoFormat() {
  try {
    if (await db.getSetting('photoFormat') === 2) return;
    let allOk = true;
    for (const c of await db.getAllCharacters()) {
      if (c.photo instanceof Blob) {
        try {
          const buf = await c.photo.arrayBuffer();
          await db.putCharacter({ ...c, photo: buf });
        } catch {
          try { await db.putCharacter({ ...c, photo: null }); }
          catch { allOk = false; }
        }
      }
    }
    if (allOk) await db.setSetting('photoFormat', 2);
  } catch { /* 失败则下次启动重试 */ }
}

const routes = {
  home: renderHome,
  input: renderInput,
  review: renderReview,
  library: renderLibrary,
};

export function navigate(name) {
  location.hash = '#' + name;
}

async function render() {
  const name = location.hash.slice(1) || 'home';
  const view = routes[name] || renderHome;
  const root = document.getElementById('app');
  root.innerHTML = '';
  await view(root, navigate);
}

window.addEventListener('hashchange', render);

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // 新 SW 接管长驻会话后重载一次，避免新旧版本模块混跑；首次安装接管不重载
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }
    location.reload();
  });
  // 应用回到前台时主动检查 SW 更新（配合 sw.js 的 VERSION 提升尽快生效）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration()
        .then(r => r?.update()).catch(() => {});
    }
  });
}
// 迁移完成后再渲染，避免迁移写库与复习作答写库竞争
migratePhotoFormat().then(render);
