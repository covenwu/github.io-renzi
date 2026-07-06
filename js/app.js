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
}
render();
