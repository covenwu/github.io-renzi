import { openDB } from '../vendor/idb.js';

let dbp;
function db() {
  dbp ??= openDB('renzi', 1, {
    upgrade(d) {
      const c = d.createObjectStore('characters', { keyPath: 'id', autoIncrement: true });
      c.createIndex('char', 'char', { unique: true });
      c.createIndex('nextReviewAt', 'nextReviewAt');
      const l = d.createObjectStore('reviewLog', { keyPath: 'id', autoIncrement: true });
      l.createIndex('reviewedAt', 'reviewedAt');
      l.createIndex('charId', 'charId');
      d.createObjectStore('settings');
    },
  });
  return dbp;
}

// 返回新 id；重复字返回 null
export async function addCharacter(charObj) {
  try {
    return await (await db()).add('characters', charObj);
  } catch (e) {
    if (e.name === 'ConstraintError') return null;
    throw e;
  }
}

export async function putCharacter(c) {
  return (await db()).put('characters', c);
}

export async function deleteCharacter(id) {
  const d = await db();
  const tx = d.transaction(['characters', 'reviewLog'], 'readwrite');
  tx.objectStore('characters').delete(id);
  let cur = await tx.objectStore('reviewLog').index('charId')
    .openCursor(IDBKeyRange.only(id));
  while (cur) { cur.delete(); cur = await cur.continue(); }
  await tx.done;
}

export async function getAllCharacters() {
  return (await db()).getAll('characters');
}

export async function getDue(now) {
  return (await db()).getAllFromIndex(
    'characters', 'nextReviewAt', IDBKeyRange.upperBound(now));
}

export async function addLog(log) {
  return (await db()).add('reviewLog', log);
}

export async function getLogsSince(ts) {
  return (await db()).getAllFromIndex(
    'reviewLog', 'reviewedAt', IDBKeyRange.lowerBound(ts));
}

export async function getAllLogs() {
  return (await db()).getAll('reviewLog');
}

export async function getSetting(key) {
  return (await db()).get('settings', key);
}

export async function setSetting(key, value) {
  return (await db()).put('settings', value, key);
}

// 导入用：整库替换（保留原 id）
export async function replaceAll(characters, logs) {
  const d = await db();
  const tx = d.transaction(['characters', 'reviewLog'], 'readwrite');
  await tx.objectStore('characters').clear();
  await tx.objectStore('reviewLog').clear();
  for (const c of characters) tx.objectStore('characters').put(c);
  for (const l of logs) tx.objectStore('reviewLog').put(l);
  await tx.done;
}
