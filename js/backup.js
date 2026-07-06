export const BACKUP_VERSION = 1;

// characters 里的 photo 为 Blob（浏览器）或 Uint8Array（测试）
export async function exportZip(JSZip, characters, reviewLog, type = 'blob') {
  const zip = new JSZip();
  const meta = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    characters: characters.map(c => ({
      ...c, photo: c.photo ? `photos/${c.id}.jpg` : null,
    })),
    reviewLog,
  };
  zip.file('data.json', JSON.stringify(meta));
  for (const c of characters) {
    if (c.photo) zip.file(`photos/${c.id}.jpg`, c.photo);
  }
  return zip.generateAsync({ type });
}

// photoType：浏览器用默认 'blob'，Node 测试传 'uint8array'
export async function importZip(JSZip, data, photoType = 'blob') {
  const zip = await JSZip.loadAsync(data);
  const entry = zip.file('data.json');
  if (!entry) throw new Error('无效备份：缺少 data.json');
  const meta = JSON.parse(await entry.async('string'));
  if (meta.version > BACKUP_VERSION) {
    throw new Error(`备份版本(${meta.version})比应用支持的(${BACKUP_VERSION})新，请先更新应用`);
  }
  const characters = [];
  for (const c of meta.characters) {
    let photo = null;
    if (c.photo && zip.file(c.photo)) {
      photo = await zip.file(c.photo).async(photoType);
    }
    characters.push({ ...c, photo });
  }
  return { characters, reviewLog: meta.reviewLog };
}
