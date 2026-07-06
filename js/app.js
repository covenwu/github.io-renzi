import { renderHome } from './views/home.js';
import { renderInput } from './views/input.js';
import { renderReview } from './views/review.js';
import { renderLibrary } from './views/library.js';

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
render();
