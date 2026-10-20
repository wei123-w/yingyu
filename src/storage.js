import { INITIAL_DECKS, INITIAL_WORDS, createId } from './data.js';

const DB_NAME = 'english-vs-classroom';
const DB_VERSION = 2;
const META_STORE = 'meta';
const STORE_NAMES = ['words', 'decks', 'records'];
let database;
let backend = 'indexeddb';
const fallback = { words: [], decks: [], records: [] };

function readFallback(store) {
  try { return JSON.parse(localStorage.getItem(`evs-${store}`) || 'null') || fallback[store]; }
  catch { return fallback[store]; }
}

function writeFallback(store, value) {
  fallback[store] = value;
  try { localStorage.setItem(`evs-${store}`, JSON.stringify(value)); }
  catch (error) { console.warn('本地浏览器存储空间不可用', error); }
}

function openDatabase() {
  if (database) return Promise.resolve(database);
  if (!('indexedDB' in window)) return Promise.reject(new Error('当前浏览器不支持 IndexedDB'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = request.result;
      if (!db.objectStoreNames.contains('words')) {
        const words = db.createObjectStore('words', { keyPath: 'id' });
        words.createIndex('deckId', 'deckId', { unique: false });
        words.createIndex('word', 'word', { unique: false });
      }
      if (!db.objectStoreNames.contains('decks')) db.createObjectStore('decks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('playedAt', 'playedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        const meta = db.createObjectStore(META_STORE, { keyPath: 'key' });
        // 已有数据库视为完成过首次初始化，升级时不能把用户删空的词库重新填回去。
        if (event.oldVersion > 0) meta.put({ key: 'initialized', value: true });
      }
    };
    request.onsuccess = () => { database = request.result; database.onversionchange = () => database.close(); resolve(database); };
    request.onerror = () => reject(request.error || new Error('无法打开本地数据库'));
    request.onblocked = () => reject(new Error('本地数据库正在被另一个页面占用，请关闭重复打开的页面后重试。'));
  });
}

function requestStore(storeName, mode, operation) {
  return openDatabase().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try { request = operation(store); }
    catch (error) { reject(error); return; }
    if (request) {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('本地数据操作失败'));
    } else {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('本地数据保存失败'));
    }
    transaction.onabort = () => reject(transaction.error || new Error('本地数据操作已取消'));
  }));
}

export async function initializeStorage() {
  try {
    await openDatabase();
    const [words, decks, initialization] = await Promise.all([
      listWords(), listDecks(), requestStore(META_STORE, 'readonly', store => store.get('initialized')),
    ]);
    if (!initialization?.value) {
      if (!decks.length) await replaceDecks(INITIAL_DECKS);
      if (!words.length) await replaceWords(INITIAL_WORDS);
      await requestStore(META_STORE, 'readwrite', store => store.put({ key: 'initialized', value: true }));
    }
  } catch (error) {
    backend = 'localstorage';
    console.warn('IndexedDB 不可用，正在尝试浏览器轻量存储', error);
    for (const store of STORE_NAMES) fallback[store] = readFallback(store);
    let initialized = false;
    try { initialized = localStorage.getItem('evs-seed-initialized') === 'true'; }
    catch { /* 浏览器可能禁用本地存储。 */ }
    if (!initialized) {
      if (!fallback.decks.length) writeFallback('decks', INITIAL_DECKS);
      if (!fallback.words.length) writeFallback('words', INITIAL_WORDS);
      try { localStorage.setItem('evs-seed-initialized', 'true'); }
      catch { /* 浏览器可能禁用本地存储。 */ }
    }
  }
  return { backend, persistent: backend === 'indexeddb' || Boolean(window.localStorage) };
}

export function storageBackend() { return backend; }

export async function listWords() {
  if (backend === 'localstorage') return [...readFallback('words')];
  return (await requestStore('words', 'readonly', store => store.getAll())) || [];
}
export async function saveWord(word) {
  const value = { ...word, id: word.id || createId('word'), updatedAt: new Date().toISOString() };
  if (backend === 'localstorage') {
    const items = readFallback('words'); const index = items.findIndex(item => item.id === value.id);
    if (index >= 0) items[index] = value; else items.unshift(value);
    writeFallback('words', items); return value;
  }
  await requestStore('words', 'readwrite', store => store.put(value)); return value;
}
export async function saveWords(words) {
  const saved = [];
  for (const word of words) saved.push(await saveWord(word));
  return saved;
}
export async function deleteWord(id) {
  if (backend === 'localstorage') { writeFallback('words', readFallback('words').filter(item => item.id !== id)); return; }
  await requestStore('words', 'readwrite', store => store.delete(id));
}
export async function deleteWords(ids) {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return;
  if (backend === 'localstorage') {
    const deletedIds = new Set(uniqueIds);
    writeFallback('words', readFallback('words').filter(item => !deletedIds.has(item.id)));
    return;
  }
  await requestStore('words', 'readwrite', store => {
    for (const id of uniqueIds) store.delete(id);
  });
}
export async function replaceWords(words) {
  if (backend === 'localstorage') { writeFallback('words', words); return; }
  await requestStore('words', 'readwrite', store => { store.clear(); for (const item of words) store.put(item); });
}
export async function listDecks() {
  if (backend === 'localstorage') return [...readFallback('decks')];
  return (await requestStore('decks', 'readonly', store => store.getAll())) || [];
}
export async function saveDeck(deck) {
  const value = { ...deck, id: deck.id || createId('deck'), updatedAt: new Date().toISOString() };
  if (backend === 'localstorage') {
    const items = readFallback('decks'); const index = items.findIndex(item => item.id === value.id);
    if (index >= 0) items[index] = value; else items.push(value);
    writeFallback('decks', items); return value;
  }
  await requestStore('decks', 'readwrite', store => store.put(value)); return value;
}
export async function replaceDecks(decks) {
  if (backend === 'localstorage') { writeFallback('decks', decks); return; }
  await requestStore('decks', 'readwrite', store => { store.clear(); for (const item of decks) store.put(item); });
}
export async function deleteDeck(id) {
  const [decks, words] = await Promise.all([listDecks(), listWords()]);
  if (decks.length <= 1) throw new Error('至少保留一个词库。');
  const destination = decks.find(deck => deck.id !== id);
  await replaceDecks(decks.filter(deck => deck.id !== id));
  await replaceWords(words.map(word => word.deckId === id ? { ...word, deckId: destination.id } : word));
}
export async function listRecords() {
  if (backend === 'localstorage') return [...readFallback('records')].sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  return ((await requestStore('records', 'readonly', store => store.getAll())) || []).sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}
export async function saveRecord(record) {
  const value = { ...record, id: record.id || createId('game'), playedAt: record.playedAt || new Date().toISOString() };
  if (backend === 'localstorage') { writeFallback('records', [value, ...readFallback('records')]); return value; }
  await requestStore('records', 'readwrite', store => store.put(value)); return value;
}
export async function clearRecords() {
  if (backend === 'localstorage') { writeFallback('records', []); return; }
  await requestStore('records', 'readwrite', store => store.clear());
}

export async function getSettings() {
  try { return { theme: 'light', voiceEnabled: true, soundEnabled: true, language: 'zh-CN', ...JSON.parse(localStorage.getItem('evs-settings') || '{}') }; }
  catch { return { theme: 'light', voiceEnabled: true, soundEnabled: true, language: 'zh-CN' }; }
}
export async function saveSettings(settings) {
  try { localStorage.setItem('evs-settings', JSON.stringify(settings)); }
  catch (error) { throw new Error(`设置保存失败：${error.message}`); }
  return settings;
}
export async function exportBackup() {
  const [words, decks, records, settings] = await Promise.all([listWords(), listDecks(), listRecords(), getSettings()]);
  const { aiApiKey, ...safeSettings } = settings;
  return { format: 'english-vs-backup', version: 1, exportedAt: new Date().toISOString(), words, decks, records, settings: safeSettings };
}
export async function importBackup(data) {
  if (!data || data.format !== 'english-vs-backup' || !Array.isArray(data.words) || !Array.isArray(data.decks)) throw new Error('文件不是有效的 English VS 备份。');
  await replaceDecks(data.decks);
  await replaceWords(data.words);
  if (Array.isArray(data.records)) {
    if (backend === 'localstorage') writeFallback('records', data.records);
    else await requestStore('records', 'readwrite', store => { store.clear(); for (const record of data.records) store.put(record); });
  }
  if (data.settings) {
    const current = await getSettings();
    await saveSettings({ ...current, ...data.settings, aiApiKey: data.settings.aiApiKey || current.aiApiKey || '' });
  }
  return { words: data.words.length, decks: data.decks.length };
}
export async function clearAllData() {
  await Promise.all([replaceWords([]), replaceDecks([]), clearRecords()]);
  try { localStorage.removeItem('evs-settings'); } catch { /* 浏览器可能禁用本地存储 */ }
  if (backend === 'localstorage') { writeFallback('words', []); writeFallback('decks', []); }
  await initializeStorage();
}
