import { MODES, INITIAL_DECKS, DEMO_PLAYERS, createId } from './data.js';
import * as storage from './storage.js';
import { normalizeImportRows, readImportFile } from './import.js';
import { filterWords, renderWordsPage, wordFormHTML, deckFormHTML, renderImportPreview } from './words.js?v=15';
import { requestAI } from './ai.js?v=15';
import { renderGamesPage, renderBattlePage, renderGameConfig, createSession, answerQuestion, advanceSession, tickSession, revealMemoryCard, hideMismatchedCards, completeSession, renderGameSession, renderLeaderboardPage, renderHistoryPage, historyTable } from './games.js';
import { closeModal, confirmAction, downloadJSON, escapeHTML, formatDate, openModal, speak, toast, toggleFullscreen } from './ui.js?v=14';

const state = {
  route: 'home', words: [], decks: [], records: [], settings: {}, backend: 'indexeddb',
  wordSearch: '', wordDeckId: 'all', wordUnit: 'all', wordPage: 1, selectedWordIds: new Set(), importRows: [], importWarning: '', importSelectedDeck: '',
  pendingImportFiles: [], importBusy: false, importCurrentFile: '',
  session: null, timer: null, mismatchTimer: null, savedSessionIds: new Set(),
  historyFilters: { search: '', mode: 'all', period: 'all' }, leaderboardPeriod: 'all', settingsTab: 'preferences',
};

const ROUTES = { home: '首页', words: '单词库', import: '导入单词', games: '游戏中心', battle: '对战模式', leaderboard: '排行榜', history: '学习记录', settings: '系统设置' };

async function boot() {
  const result = await storage.initializeStorage();
  state.backend = result.backend;
  await refreshData();
  state.settings = await storage.getSettings();
  globalThis.aiImportSettings = { endpoint: state.settings.aiEndpoint, apiKey: state.settings.aiApiKey, model: state.settings.aiModel };
  applyTheme();
  bindGlobalEvents();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register(new URL('../service-worker.js', import.meta.url)).catch(error => console.warn('离线缓存注册失败', error));
  }
  renderAll();
  document.querySelector('#storage-status').textContent = state.backend === 'indexeddb' ? 'IndexedDB 本地存储已就绪' : '使用浏览器轻量本地存储';
  if (location.protocol === 'file:') toast('建议使用 start.bat 通过本地服务运行，以获得完整的模块和存储支持。', 'error', 7000);
  if (!window.indexedDB) toast('当前浏览器不支持 IndexedDB，将尝试轻量本地存储。', 'error', 6000);
}

async function refreshData() {
  [state.words, state.decks, state.records] = await Promise.all([storage.listWords(), storage.listDecks(), storage.listRecords()]);
  if (!state.decks.length) {
    state.decks = INITIAL_DECKS;
    for (const deck of INITIAL_DECKS) await storage.saveDeck(deck);
  }
}

function renderAll() {
  renderHome();
  renderRoute(state.route);
  updateNavigation();
}

function renderHome() {
  const words = state.words;
  const decks = state.decks;
  document.querySelector('#nav-word-count').textContent = words.length;
  document.querySelector('#home-total-words').textContent = words.length;
  document.querySelector('#home-deck-count').textContent = decks.length;
  document.querySelector('#home-play-count').textContent = state.records.length;
  document.querySelector('#home-deck-chips').innerHTML = decks.slice(0, 4).map(deck => `<button class="deck-chip" data-action="filter-home-deck" data-deck="${escapeHTML(deck.id)}">${escapeHTML(deck.name)} <strong>${words.filter(word => word.deckId === deck.id).length}</strong></button>`).join('');
  document.querySelector('#home-recent-words').innerHTML = [...words].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 4).map(word => `<button class="recent-word" data-action="speak" data-word-id="${escapeHTML(word.id)}">${escapeHTML(word.word)}</button>`).join('') || '<span class="muted" style="font-size:var(--font-ui)">还没有词汇</span>';
  document.querySelector('#home-game-tiles').innerHTML = MODES.map(mode => `<button class="game-tile tile-${mode.color}" data-action="configure-game" data-mode="${mode.id}"><span class="game-tile-icon">${mode.icon}</span><span><strong>${mode.short}</strong><small>${mode.title}</small></span></button>`).join('');
  document.querySelector('#home-leaderboard').innerHTML = homeLeaderboard();
  document.querySelector('#home-history').innerHTML = state.records.slice(0, 4).map(record => `<div class="history-row"><span class="history-icon">${modeIcon(record.mode)}</span><span><strong>${escapeHTML(modeName(record.mode))}</strong><small>${formatDate(record.playedAt)} · ${record.correct}/${record.total} 正确</small></span><b class="history-score">${record.score}</b></div>`).join('') || '<div class="empty-state" style="padding:20px 5px"><strong>开始你的第一场练习</strong><p>完成挑战后，这里会显示学习记录。</p></div>';
  const daily = words.find(word => word.word === 'beautiful') || words[0];
  if (daily) document.querySelector('#daily-word-card').innerHTML = `<div class="daily-top"><div><div class="daily-word">${escapeHTML(daily.word)}</div><div class="daily-phonetic">${escapeHTML(daily.phonetic || '')}</div></div><button class="icon-button" data-action="speak" data-word-id="${escapeHTML(daily.id)}" aria-label="朗读 ${escapeHTML(daily.word)}">♪</button></div><span class="daily-meaning">${escapeHTML(daily.part || '')} ${escapeHTML(daily.meaning || '')}</span><div class="daily-example">${escapeHTML(daily.example || '添加一个例句，让词汇更容易记住。')}</div><div class="daily-actions"><span class="muted" style="font-size:var(--font-ui)">今天也来练习几个新词吧</span><button class="text-button" data-action="edit-word" data-word-id="${escapeHTML(daily.id)}">编辑词汇 →</button></div>`;
  else document.querySelector('#daily-word-card').innerHTML = '<div class="empty-state">还没有可展示的单词</div>';
}

function homeLeaderboard() {
  const localScore = state.records.reduce((sum, record) => sum + record.score, 0);
  const users = [...DEMO_PLAYERS, { name: '本机课堂', avatar: '📚', score: localScore, accuracy: state.records.length ? Math.round(state.records.reduce((sum, r) => sum + r.accuracy, 0) / state.records.length) : 0, local: true }].sort((a, b) => b.score - a.score).slice(0, 5);
  return users.map((user, index) => `<div class="leader-row"><span class="leader-rank">${index + 1}</span><span class="leader-user"><span class="leader-avatar">${user.avatar}</span>${escapeHTML(user.name)}</span><span class="leader-score">${user.score}</span><span class="leader-rate">${user.accuracy}%</span></div>`).join('');
}

function renderRoute(route) {
  state.route = route in ROUTES ? route : 'home';
  document.querySelectorAll('.route-view').forEach(view => view.classList.toggle('active', view.id === `view-${state.route}`));
  document.querySelector('#page-title').textContent = ROUTES[state.route];
  const view = document.querySelector(`#view-${state.route}`);
  if (state.route === 'home') return updateNavigation();
  if (state.route === 'words') {
    view.innerHTML = renderWordsPage(state.words, state.decks, { search: state.wordSearch, deckId: state.wordDeckId, unit: state.wordUnit, page: state.wordPage, selectedWordIds: state.selectedWordIds });
    const selectAll = view.querySelector('[data-select-all-words]');
    const filteredWords = filterWords(state.words, state.wordSearch, state.wordDeckId, state.wordUnit);
    const selectedCount = filteredWords.filter(word => state.selectedWordIds.has(word.id)).length;
    if (selectAll) selectAll.indeterminate = selectedCount > 0 && selectedCount < filteredWords.length;
  }
  if (state.route === 'import') {
    view.innerHTML = renderImportPreview(state.importRows, state.words, state.decks, state.importSelectedDeck || state.decks[0]?.id, { files: state.pendingImportFiles, busy: state.importBusy, currentFileName: state.importCurrentFile }).replace('<div class="page-grid">', `${state.importWarning ? `<div class="offline-note" style="margin:0 0 12px">${escapeHTML(state.importWarning)}</div>` : ''}<div class="page-grid">`);
    bindImportDropZone(view);
  }
  if (state.route === 'games') view.innerHTML = renderGamesPage(state.words, state.decks);
  if (state.route === 'battle') view.innerHTML = state.session ? renderGameSession(state.session, deckName(state.session.deckId)) : renderBattlePage(state.records);
  if (state.route === 'leaderboard') view.innerHTML = renderLeaderboardPage(filterLeaderboard(state.records), state.leaderboardPeriod);
  if (state.route === 'history') view.innerHTML = renderHistoryPage(state.records, state.decks);
  if (state.route === 'settings') view.innerHTML = renderSettingsPage();
  updateNavigation();
}

function updateNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.route === state.route));
  if (state.route === 'battle' && state.session?.status === 'playing' && !state.timer) startTimer();
}

function renderSettingsPage() {
  const tabs = [ ['preferences', '⚙', '外观设置'], ['audio', '♫', '语音设置'], ['ai', '✦', 'AI 导入'], ['data', '▣', '数据管理'], ['about', 'ⓘ', '关于我们'] ];
  const activeTab = state.settingsTab;
  let content = '';
  if (activeTab === 'preferences') content = `<section class="content-card"><div class="panel-heading" style="padding:0 0 14px"><div><span class="heading-icon blue">☼</span><div><h2>外观设置</h2><p>选择适合课堂投影和个人使用的界面风格</p></div></div></div><div class="form-field"><label>主题风格</label><div class="theme-choices"><button class="theme-choice ${state.settings.theme === 'light' ? 'active' : ''}" data-action="set-theme" data-theme="light"><div class="theme-preview"></div><span>浅色课堂</span></button><button class="theme-choice ${state.settings.theme === 'dark' ? 'active' : ''}" data-action="set-theme" data-theme="dark"><div class="theme-preview dark"></div><span>深色课堂</span></button><button class="theme-choice ${state.settings.theme === 'mint' ? 'active' : ''}" data-action="set-theme" data-theme="mint"><div class="theme-preview mint"></div><span>薄荷绿</span></button></div></div><div class="divider"></div><label class="check-row"><input type="checkbox" data-setting="reducedMotion" ${state.settings.reducedMotion ? 'checked' : ''}> 减少非必要动效</label><div class="form-field" style="margin-top:14px"><label for="ui-language">界面语言</label><select id="ui-language" class="control-select" data-setting="language"><option value="zh-CN">简体中文</option></select><small>当前版本提供简体中文界面。</small></div></section>`;
  if (activeTab === 'audio') content = `<section class="content-card"><div class="panel-heading" style="padding:0 0 14px"><div><span class="heading-icon violet">♫</span><div><h2>语音设置</h2><p>优先使用清晰的英语语音</p></div></div></div><label class="setting-quick"><input type="checkbox" data-setting="voiceEnabled" ${state.settings.voiceEnabled !== false ? 'checked' : ''}><span><strong>启用英语朗读</strong><small>听力挑战和词汇卡可播放发音</small></span></label><label class="setting-quick"><input type="checkbox" data-setting="soundEnabled" ${state.settings.soundEnabled !== false ? 'checked' : ''}><span><strong>启用答题提示音</strong><small>答题以正确或错误动画反馈，暂无额外游戏音效</small></span></label><div class="offline-note" style="margin-top:13px">在线部署使用 Cloudflare 生成的 MP3 语音；本机通过 start.bat 启动时优先使用 Windows 英语女声，服务不可用时尝试浏览器语音。</div><button class="button button-outline" style="margin-top:12px" data-action="test-voice">▶ 试听英语发音</button></section>`;
  if (activeTab === 'ai') content = `<section class="content-card"><div class="panel-heading" style="padding:0 0 14px"><div><span class="heading-icon violet">✦</span><div><h2>AI 图片识别</h2><p>可选配置兼容 Chat Completions 的视觉模型</p></div></div><span class="tag orange">需要网络</span></div><form id="ai-settings-form"><div class="form-field"><label for="ai-endpoint">接口地址</label><input class="control-input" id="ai-endpoint" name="endpoint" type="url" value="${escapeHTML(state.settings.aiEndpoint || '')}" placeholder="https://你的服务地址/v1/chat/completions"><small>本机启动时由 Python 转发；部署到本站后由同源云端接口转发，浏览器无需跨域直连。请使用支持图片输入并兼容 Chat Completions 的服务。</small></div><div class="form-field"><label for="ai-model">模型名称</label><input class="control-input" id="ai-model" name="model" value="${escapeHTML(state.settings.aiModel || '')}" placeholder="填写服务支持的视觉模型名称"></div><div class="form-field"><label for="ai-api-key">API 密钥</label><input class="control-input" id="ai-api-key" name="apiKey" type="password" autocomplete="new-password" value="${escapeHTML(state.settings.aiApiKey || '')}" placeholder="粘贴你的 API 密钥"><small>密钥保存在此浏览器的本地设置中，仅在请求时发送给所填 AI 服务；项目服务器不保存密钥。请勿在共用设备保存。</small></div><div class="page-actions"><button class="button button-primary" type="submit">保存 AI 设置</button><button class="button button-outline" type="button" data-action="test-ai-settings">测试连接</button><button class="button button-outline" type="button" data-action="clear-ai-settings">清除设置</button></div><p class="ai-test-status" id="ai-test-status" role="status" aria-live="polite" hidden></p><p class="ai-test-note">测试会发送一条简短文本请求，不会上传图片；未保存的设置也可直接测试，可能消耗少量接口额度。</p></form><div class="offline-note" style="margin-top:14px">不配置 AI 时，词库和游戏仍可离线使用。云端仅支持 Groq、Google Gemini、DeepSeek、通义千问、OpenRouter、硅基流动、Mistral、月之暗面、OpenAI 和 Together 的兼容接口；图片会发送给你填写的 AI 服务，识别结果需教师审核。</div></section>`;
  if (activeTab === 'data') content = `<section class="content-card"><div class="panel-heading" style="padding:0 0 14px"><div><span class="heading-icon cyan">▣</span><div><h2>数据管理</h2><p>词库、成绩和偏好设置均保存在本机浏览器</p></div></div></div><div class="stat-cards"><div class="stat-card"><span>单词</span><strong>${state.words.length}</strong><small>本地词汇</small></div><div class="stat-card"><span>词库</span><strong>${state.decks.length}</strong><small>本地分类</small></div><div class="stat-card"><span>记录</span><strong>${state.records.length}</strong><small>本地成绩</small></div><div class="stat-card"><span>存储方式</span><strong style="font-size:var(--font-ui)">${state.backend === 'indexeddb' ? 'IndexedDB' : '轻量存储'}</strong><small>仅当前浏览器</small></div></div><div class="page-actions"><button class="button button-primary" data-action="backup">↓ 导出完整备份</button><label class="button button-outline" for="restore-file">↑ 恢复完整备份<input hidden id="restore-file" type="file" accept=".json,application/json"></label><button class="button button-danger" data-action="clear-all">清空本机数据</button></div><div class="offline-note" style="margin-top:14px">建议定期导出 JSON 备份。清空数据会删除本机词库和练习记录，无法撤销。</div></section>`;
  if (activeTab === 'about') content = `<section class="content-card"><span class="eyebrow">ENGLISH VS</span><h2 style="color:#284d75">让英语学习变成一场有趣的比赛</h2><p class="muted" style="font-size:var(--font-ui);line-height:1.8">English VS 是无需登录的本地英语课堂游戏工具。核心词库、单词管理、四种游戏模式、成绩记录和导入导出在浏览器本地运行。语音依赖浏览器和操作系统；DOCX、PDF 和图片识别需要本地解析器；云端 AI 识别需要网络和用户自配 API。本版本没有联网多人服务器。</p><div class="divider"></div><p class="muted" style="font-size:var(--font-ui)">版本 1.0 · 浏览器本地应用 · 数据由用户自行管理</p></section>`;
  return `<div class="page-header"><div><span class="eyebrow">CLASSROOM PREFERENCES</span><h1>系统设置</h1><p>管理主题、语音偏好和本地课堂数据。</p></div></div><div class="settings-layout"><nav class="settings-nav">${tabs.map(([id, icon, label]) => `<button class="${id === activeTab ? 'active' : ''}" data-settings-tab="${id}"><span>${icon}</span>${label}</button>`).join('')}</nav><div>${content}</div></div>`;
}

function bindGlobalEvents() {
  document.addEventListener('click', handleClick);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  document.querySelector('#mobile-menu').addEventListener('click', () => document.body.classList.toggle('mobile-nav-open'));
  document.querySelector('#sidebar-collapse').addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));
  document.querySelector('#theme-toggle').addEventListener('click', async () => setTheme(state.settings.theme === 'dark' ? 'light' : 'dark'));
  document.querySelector('#profile-button').addEventListener('click', () => toast('English VS 无需登录，课堂数据保存在本机。'));
  document.querySelector('#choose-home-file').addEventListener('click', () => document.querySelector('#home-file').click());
  const dropzone = document.querySelector('#home-dropzone');
  dropzone.addEventListener('click', event => { if (!event.target.closest('button')) document.querySelector('#home-file').click(); });
  dropzone.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') document.querySelector('#home-file').click(); });
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('drag-over'); queueImportFiles(event.dataTransfer.files); });
  document.querySelector('#modal-content').addEventListener('click', event => { if (event.target.closest('[data-modal-cancel]')) closeModal(); });
}

function bindImportDropZone(view) {
  const dropzone = view.querySelector('[data-import-drop]');
  if (!dropzone) return;
  dropzone.addEventListener('click', event => {
    if (state.importBusy) return;
    if (event.target.closest('label')) return;
    document.querySelector('#import-file').click();
  });
  dropzone.addEventListener('dragover', event => { event.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragenter', event => { event.preventDefault(); if (!state.importBusy) dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', event => { event.preventDefault(); dropzone.classList.remove('drag-over'); queueImportFiles(event.dataTransfer.files); });
}

function handleClick(event) {
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    if (routeButton.tagName === 'A') event.preventDefault();
    const route = routeButton.dataset.route;
    if (routeButton.dataset.action === 'configure-game') { configureGame(routeButton.dataset.mode); return; }
    if (routeButton.dataset.action === 'replay-game') { configureGame(routeButton.dataset.mode, routeButton.dataset.deck); return; }
    if (routeButton.dataset.action === 'filter-home-deck') { state.wordDeckId = routeButton.dataset.deck; state.wordUnit = 'all'; state.wordPage = 1; state.selectedWordIds.clear(); navigate('words'); return; }
    navigate(route); return;
  }
  const settingsTab = event.target.closest('[data-settings-tab]');
  if (settingsTab) { state.settingsTab = settingsTab.dataset.settingsTab; renderRoute('settings'); return; }
  const pageButton = event.target.closest('[data-word-page]');
  if (pageButton) { state.wordPage = Number(pageButton.dataset.wordPage); renderRoute('words'); return; }
  if (event.target.closest('[data-select-all-words]')) return;
  const answer = event.target.closest('[data-answer]');
  if (answer) { submitAnswer(answer.dataset.answer); return; }
  const memoryCard = event.target.closest('[data-memory-card]');
  if (memoryCard) { handleMemoryCard(memoryCard.dataset.memoryCard); return; }
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;
  runAction(actionButton.dataset.action, actionButton);
}

async function runAction(action, button) {
  if (action === 'new-word') return showWordForm();
  if (action === 'edit-word') return showWordForm(state.words.find(word => word.id === button.dataset.wordId));
  if (action === 'delete-word') return deleteWord(button.dataset.wordId);
  if (action === 'delete-selected-words') return deleteSelectedWords();
  if (action === 'new-deck') return showDeckForm();
  if (action === 'edit-deck') return showDeckForm(state.decks.find(deck => deck.id === button.dataset.deckId));
  if (action === 'delete-deck') return deleteDeck(button.dataset.deckId);
  if (action === 'filter-home-deck') { state.wordDeckId = button.dataset.deck; state.wordUnit = 'all'; state.wordPage = 1; state.selectedWordIds.clear(); navigate('words'); return; }
  if (action === 'speak') {
    const word = state.words.find(item => item.id === button.dataset.wordId);
    if (word) speak(word.word);
    return;
  }
  if (action === 'import-words') { navigate('import'); return; }
  if (action === 'export-words') return exportWords();
  if (action === 'backup') return backupAll();
  if (action === 'clear-records') return clearHistory();
  if (action === 'clear-all') return clearAll();
  if (action === 'fullscreen') return toggleFullscreen();
  if (action === 'configure-game') return configureGame(button.dataset.mode);
  if (action === 'next-question') { advanceSession(state.session); if (state.session.status === 'finished') finishSession(); else refreshGameView(); return; }
  if (action === 'play-question-audio') { const word = state.session?.questions[state.session.index]?.word; if (word) speak(word.word); return; }
  if (action === 'exit-game') { clearInterval(state.timer); state.timer = null; state.session = null; renderRoute('battle'); return; }
  if (action === 'toggle-pause') { state.session.paused = !state.session.paused; refreshGameView(); return; }
  if (action === 'test-voice') { speak('beautiful'); return; }
  if (action === 'test-ai-settings') return testAiSettings(button);
  if (action === 'clear-ai-settings') { state.settings.aiEndpoint = ''; state.settings.aiApiKey = ''; state.settings.aiModel = ''; globalThis.aiImportSettings = {}; await storage.saveSettings(state.settings); renderRoute('settings'); toast('AI 接口设置已清除。'); return; }
  if (action === 'set-theme') { await setTheme(button.dataset.theme); return; }
  if (action === 'commit-import') return commitImport();
  if (action === 'recognize-import-files') return recognizeImportFiles();
  if (action === 'remove-import-file') {
    if (state.importBusy) return;
    state.pendingImportFiles.splice(Number(button.dataset.importFileIndex), 1);
    state.importWarning = ''; renderRoute('import'); return;
  }
  if (action === 'clear-word-search') { state.wordSearch = ''; state.wordDeckId = 'all'; state.wordUnit = 'all'; state.selectedWordIds.clear(); renderRoute('words'); return; }
  if (action === 'export-scores') return exportRecords();
}

function navigate(route) {
  document.body.classList.remove('mobile-nav-open');
  renderRoute(route);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleChange(event) {
  const target = event.target;
  if (target.id === 'home-file' || target.id === 'import-file' || target.id === 'restore-file') {
    const files = Array.from(target.files || []);
    if (files.length) target.id === 'restore-file' ? restoreBackup(files[0]) : queueImportFiles(files);
    target.value = '';
    return;
  }
  if (target.matches('[data-select-all-words]')) {
    const matchingIds = filterWords(state.words, state.wordSearch, state.wordDeckId, state.wordUnit).map(word => word.id);
    if (target.checked) matchingIds.forEach(id => state.selectedWordIds.add(id));
    else matchingIds.forEach(id => state.selectedWordIds.delete(id));
    renderRoute('words'); return;
  }
  if (target.matches('[data-word-select]')) {
    if (target.checked) state.selectedWordIds.add(target.dataset.wordSelect);
    else state.selectedWordIds.delete(target.dataset.wordSelect);
    renderRoute('words'); return;
  }
  if (target.matches('[data-word-deck]')) { state.wordDeckId = target.value; state.wordPage = 1; state.selectedWordIds.clear(); renderRoute('words'); return; }
  if (target.matches('[data-word-unit]')) { state.wordUnit = target.value; state.wordPage = 1; state.selectedWordIds.clear(); renderRoute('words'); return; }
  if (target.matches('[data-setting]')) { state.settings[target.dataset.setting] = target.type === 'checkbox' ? target.checked : target.value; storage.saveSettings(state.settings).then(() => toast('设置已保存。')).catch(error => toast(error.message, 'error')); if (target.dataset.setting === 'language') renderRoute('settings'); return; }
  if (target.matches('[data-history-mode]') || target.matches('[data-history-period]')) { state.historyFilters[target.dataset.historyMode ? 'mode' : 'period'] = target.value; renderHistoryTable(); return; }
  if (target.matches('[data-action="leader-filter"]')) { state.leaderboardPeriod = target.value; renderRoute('leaderboard'); return; }
}

function handleInput(event) {
  const target = event.target;
  if (target.matches('[data-import-unit]')) {
    const row = state.importRows[Number(target.dataset.importUnit)];
    if (row) row.unit = target.value.trim();
    return;
  }
  if (target.matches('[data-word-search]')) {
    state.wordSearch = target.value; state.wordPage = 1; state.selectedWordIds.clear();
    const start = target.selectionStart; const end = target.selectionEnd;
    renderRoute('words'); const replacement = document.querySelector('[data-word-search]'); replacement.focus(); replacement.setSelectionRange(start, end); return;
  }
  if (target.matches('[data-history-search]')) { state.historyFilters.search = target.value; renderHistoryTable(); }
}

function handleSubmit(event) {
  if (event.target.id === 'word-form') { event.preventDefault(); saveWordForm(event.target); return; }
  if (event.target.id === 'deck-form') { event.preventDefault(); saveDeckForm(event.target); return; }
  if (event.target.id === 'game-config-form') { event.preventDefault(); startConfiguredGame(event.target); return; }
  if (event.target.id === 'ai-settings-form') { event.preventDefault(); saveAiSettings(event.target); return; }
  if (event.target.id === 'spelling-form') { event.preventDefault(); const answer = new FormData(event.target).get('answer'); submitAnswer(answer); }
}

async function testAiSettings(button) {
  const form = document.querySelector('#ai-settings-form');
  const status = form.querySelector('#ai-test-status');
  const values = Object.fromEntries(new FormData(form));
  const endpoint = String(values.endpoint || '').trim().replace(/\/$/, '');
  const model = String(values.model || '').trim();
  const apiKey = String(values.apiKey || '').trim();
  const showStatus = (state, message) => {
    status.hidden = false;
    status.dataset.state = state;
    status.textContent = message;
  };

  if (!endpoint || !model || !apiKey) {
    showStatus('error', '请先填写接口地址、模型名称和 API 密钥。');
    return;
  }
  if (!endpoint.endsWith('/chat/completions')) {
    showStatus('error', '接口地址通常需要以 /chat/completions 结尾。');
    return;
  }

  const originalLabel = button.textContent;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  button.disabled = true;
  button.textContent = '正在测试…';
  showStatus('pending', '正在连接 AI 服务…');
  try {
    const response = await requestAI(endpoint, apiKey, {
      model, messages: [{ role: 'user', content: '请只回复：连接正常。' }],
    }, { signal: controller.signal });
    if (!response.ok) {
      const messages = {
        401: '密钥无效或未授权，请检查 API 密钥。',
        403: '当前密钥没有访问此模型的权限。',
        404: '接口地址或模型名称不存在，请检查配置。',
        429: '请求过于频繁或免费额度已用完，请稍后重试并检查额度。',
        503: 'AI 服务暂时不可用（HTTP 503），通常是上游服务繁忙或临时故障，请稍后重试。',
      };
      let detail = '';
      try {
        const errorPayload = await response.json();
        detail = errorPayload?.error?.message || errorPayload?.error || '';
      } catch { /* 使用通用状态提示。 */ }
      throw new Error(messages[response.status] || (typeof detail === 'string' && detail) || `AI 服务返回 HTTP ${response.status}。`);
    }
    let payload;
    try { payload = await response.json(); }
    catch { throw new Error('AI 服务返回的不是有效 JSON。'); }
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' && !Array.isArray(content)) {
      throw new Error('服务已响应，但返回格式不兼容 Chat Completions。');
    }
    showStatus('success', '连接成功，模型响应正常。');
  } catch (error) {
    const message = error.name === 'AbortError'
      ? '等待 AI 服务响应超过 90 秒，请稍后重试。'
      : error instanceof TypeError
        ? '无法连接本机服务，请确认已通过 start.bat 启动服务并使用其打开的网页。'
        : error.message || '连接失败，请检查配置后重试。';
    showStatus('error', message);
  } finally {
    clearTimeout(timeoutId);
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

async function saveAiSettings(form) {
  const fields = Object.fromEntries(new FormData(form));
  state.settings.aiEndpoint = String(fields.endpoint || '').trim().replace(/\/$/, '');
  state.settings.aiModel = String(fields.model || '').trim();
  state.settings.aiApiKey = String(fields.apiKey || '').trim();
  if (state.settings.aiEndpoint && !state.settings.aiEndpoint.endsWith('/chat/completions')) {
    toast('请填写完整的 Chat Completions 接口地址，通常以 /chat/completions 结尾。', 'error', 5000);
    return;
  }
  globalThis.aiImportSettings = { endpoint: state.settings.aiEndpoint, model: state.settings.aiModel, apiKey: state.settings.aiApiKey };
  try { await storage.saveSettings(state.settings); toast('AI 图片识别设置已保存在本机。'); renderRoute('settings'); }
  catch (error) { toast(error.message, 'error'); }
}

function handleKeydown(event) {
  if (!state.session || state.session.status !== 'playing' || state.session.paused || state.route !== 'battle') return;
  if (state.session.mode === 'memory') return;
  if (['1', '2', '3', '4'].includes(event.key) && !state.session.answered && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    const option = document.querySelectorAll('[data-answer]')[Number(event.key) - 1];
    if (option) submitAnswer(option.dataset.answer);
  }
  if (event.key === 'Enter' && state.session.answered) { advanceSession(state.session); if (state.session.status === 'finished') finishSession(); else refreshGameView(); }
}

function renderHistoryTable() {
  const node = document.querySelector('[data-history-table]');
  if (node) node.innerHTML = historyTable(state.records, state.decks, state.historyFilters);
}

async function showWordForm(word) {
  const isEdit = Boolean(word);
  openModal(isEdit ? '编辑单词' : '添加单词', wordFormHTML(word || {}, state.decks), root => {
    const form = root.querySelector('#word-form');
    form.dataset.wordId = word?.id || '';
    form.addEventListener('submit', event => { if (!form.reportValidity()) event.preventDefault(); });
    if (!isEdit) root.querySelector('[name="word"]').focus();
  });
}

async function saveWordForm(form) {
  const data = Object.fromEntries(new FormData(form));
  const old = state.words.find(word => word.id === form.dataset.wordId);
  const duplicate = state.words.find(word => word.word.toLowerCase() === data.word.trim().toLowerCase() && word.id !== old?.id);
  if (duplicate) { toast(`“${data.word}”已存在于词库中。`, 'error'); return; }
  try {
    await storage.saveWord({ ...old, ...data, word: data.word.trim(), meaning: data.meaning.trim(), unit: data.unit.trim(), id: old?.id, createdAt: old?.createdAt || new Date().toISOString() });
    closeModal(); await refreshData(); renderAll(); toast(isNew(old) ? '单词已添加到词库。' : '单词信息已更新。');
  } catch (error) { toast(`保存失败：${error.message}`, 'error'); }
}
function isNew(old) { return !old; }

async function deleteWord(id) {
  const word = state.words.find(item => item.id === id);
  if (!word || !await confirmAction('删除这个单词？', `“${word.word}”将从词库中删除，此操作无法撤销。`, '删除单词')) return;
  await storage.deleteWord(id); state.selectedWordIds.delete(id); await refreshData(); renderAll(); toast('单词已删除。');
}

async function deleteSelectedWords() {
  const selected = filterWords(state.words, state.wordSearch, state.wordDeckId, state.wordUnit).filter(word => state.selectedWordIds.has(word.id));
  if (!selected.length) return;
  if (!await confirmAction('批量删除单词？', `已选中 ${selected.length} 个单词。删除后无法恢复，确定继续吗？`, `删除 ${selected.length} 个单词`)) return;
  try {
    await storage.deleteWords(selected.map(word => word.id));
    state.selectedWordIds.clear(); state.wordPage = 1;
    await refreshData(); renderAll(); toast(`已删除 ${selected.length} 个单词。`);
  } catch (error) { toast(`批量删除失败：${error.message}`, 'error'); }
}

async function deleteDeck(id) {
  const deck = state.decks.find(item => item.id === id);
  if (!deck) return;
  if (!await confirmAction('删除这个词库？', `“${deck.name}”中的单词会移动到其他词库，不会被删除。`, '删除词库')) return;
  try {
    await storage.deleteDeck(id);
    if (state.wordDeckId === id) state.wordDeckId = 'all';
    await refreshData(); renderAll(); toast('词库已删除，其中的单词已移至其他词库。');
  } catch (error) { toast(error.message, 'error'); }
}

function showDeckForm(deck) {
  openModal(deck ? '编辑词库' : '新建词库', deckFormHTML(deck), root => {
    const form = root.querySelector('#deck-form');
    form.dataset.deckId = deck?.id || '';
    if (deck?.color) root.querySelector('#deck-color').value = deck.color;
    form.addEventListener('submit', event => { if (!form.reportValidity()) event.preventDefault(); });
  });
}

async function saveDeckForm(form) {
  const data = Object.fromEntries(new FormData(form));
  data.id = form.dataset.deckId || undefined;
  data.name = data.name.trim();
  if (state.decks.some(deck => deck.name.toLowerCase() === data.name.toLowerCase() && deck.id !== data.id)) { toast('已存在同名词库，请换一个名称。', 'error'); return; }
  try { await storage.saveDeck(data); closeModal(); await refreshData(); renderAll(); toast('词库已保存。'); }
  catch (error) { toast(`保存失败：${error.message}`, 'error'); }
}

function queueImportFiles(fileList) {
  if (state.importBusy) { toast('文件正在识别，请稍候完成。', 'error'); return; }
  const files = Array.from(fileList || []);
  const accepted = files.filter(file => {
    if (file.size > 15 * 1024 * 1024) { toast(`“${file.name}”超过 15 MB，未加入待识别列表。`, 'error', 6000); return false; }
    return true;
  });
  if (!accepted.length) return;
  const keys = new Set(state.pendingImportFiles.map(file => `${file.name}:${file.size}:${file.lastModified}`));
  for (const file of accepted) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!keys.has(key)) { state.pendingImportFiles.push(file); keys.add(key); }
  }
  state.importRows = []; state.importWarning = '';
  state.importSelectedDeck = state.decks[0]?.id || '';
  if (state.route !== 'import') navigate('import');
  else renderRoute('import');
}

async function recognizeImportFiles() {
  if (state.importBusy) return;
  if (!state.pendingImportFiles.length) { toast('请先拖入或选择要识别的文件。', 'error'); return; }
  state.importBusy = true;
  state.importRows = [];
  state.importWarning = '';
  globalThis.aiImportSettings = { endpoint: state.settings.aiEndpoint, apiKey: state.settings.aiApiKey, model: state.settings.aiModel };
  renderRoute('import');
  try {
    const files = [...state.pendingImportFiles];
    const rows = [];
    const warnings = [];
    for (const file of files) {
      state.importCurrentFile = file.name;
      renderRoute('import');
      const parsed = await readImportFile(file);
      if (parsed.backup) {
        if (files.length > 1) throw new Error('完整备份文件请单独识别，不能与普通单词文件一起处理。');
        if (!await confirmAction('恢复完整备份？', '此操作会替换当前设备中的词库、单词和成绩，请先确认已备份现有数据。', '恢复备份')) {
          state.importWarning = '已取消备份恢复；文件仍保留在待识别列表中。';
          return;
        }
        const result = await storage.importBackup(parsed.backup);
        state.pendingImportFiles = [];
        await refreshData(); state.settings = await storage.getSettings();
        globalThis.aiImportSettings = { endpoint: state.settings.aiEndpoint, apiKey: state.settings.aiApiKey, model: state.settings.aiModel };
        applyTheme(); renderAll(); toast(`已恢复 ${result.words} 个单词和 ${result.decks} 个词库。`);
        return;
      }
      rows.push(...parsed.rows);
      if (parsed.warning) warnings.push(`${file.name}：${parsed.warning}`);
    }
    state.importRows = rows;
    state.importWarning = warnings.join('；');
    state.pendingImportFiles = [];
    state.importSelectedDeck = state.decks[0]?.id || '';
    if (warnings.length) toast(warnings.join('；'), 'error', 8000);
    else if (!rows.length) toast('文件中没有可导入的单词。', 'error', 6000);
    else toast(`已识别 ${rows.length} 个单词，请检查导入预览。`);
  } catch (error) {
    state.importWarning = `识别失败：${error.message}`;
    toast(state.importWarning, 'error', 7000);
  } finally {
    state.importBusy = false;
    state.importCurrentFile = '';
    if (state.route === 'import') renderRoute('import');
  }
}

async function commitImport() {
  const deckId = document.querySelector('#import-target-deck')?.value || state.decks[0]?.id;
  if (!deckId || !state.importRows.length) { toast('没有可导入的单词。', 'error'); return; }
  const overwrite = document.querySelector('#import-overwrite')?.checked;
  const existing = new Map(state.words.map(word => [word.word.toLowerCase(), word]));
  let added = 0; let replaced = 0; let skipped = 0;
  for (const row of state.importRows) {
    const old = existing.get(row.word.toLowerCase());
    if (old && !overwrite) { skipped++; continue; }
    const saved = await storage.saveWord({ ...old, id: old?.id || row.id, word: row.word, phonetic: row.phonetic, part: row.part, meaning: row.meaning, example: row.example, unit: row.unit || old?.unit || '', deckId, createdAt: old?.createdAt || new Date().toISOString() });
    existing.set(row.word.toLowerCase(), saved);
    if (old) replaced++; else added++;
  }
  state.importRows = []; state.importWarning = '';
  await refreshData(); navigate('words');
  toast(`导入完成：新增 ${added} 个，覆盖 ${replaced} 个，跳过重复 ${skipped} 个。`);
}

async function configureGame(mode, preferredDeck) {
  const selected = state.decks.find(deck => deck.id === preferredDeck) || state.decks[0];
  openModal('设置本轮挑战', renderGameConfig(mode, state.decks, selected?.id), root => {
    root.querySelector('#game-config-form').addEventListener('submit', event => { if (!event.currentTarget.reportValidity()) event.preventDefault(); });
  });
}

function startConfiguredGame(form) {
  const data = Object.fromEntries(new FormData(form));
  const mode = form.dataset.mode;
  const deckId = data.deckId;
  const words = state.words.filter(word => word.deckId === deckId);
  try {
    state.session = createSession({ mode, words, deckId, count: Number(data.count), seconds: Number(data.seconds), voice: form.querySelector('[name="voice"]').checked && state.settings.voiceEnabled !== false });
    state.session.playPaused = false;
    closeModal();
    navigate('battle');
    if (mode === 'listening' && state.session.voice) speak(state.session.questions[0].word.word);
    startTimer();
  } catch (error) { toast(error.message, 'error'); }
}

function startTimer() {
  clearInterval(state.timer);
  state.timer = window.setInterval(() => {
    if (!state.session || state.session.status !== 'playing') { clearInterval(state.timer); state.timer = null; finishSession(); return; }
    if (state.session.paused) return;
    tickSession(state.session);
    if (state.session.secondsLeft <= 0 || state.session.status === 'finished') finishSession();
    else {
      const clock = document.querySelector('#view-battle .quiz-clock strong');
      if (clock) clock.textContent = `${String(Math.floor(state.session.secondsLeft / 60)).padStart(2, '0')}:${String(state.session.secondsLeft % 60).padStart(2, '0')}`;
    }
  }, 1000);
}

function submitAnswer(answer) {
  if (!state.session || state.session.paused) return;
  const result = answerQuestion(state.session, answer ?? '');
  if (result.correct === null) return;
  if (state.session.voice && state.session.mode === 'quiz' && result.correct) speak(state.session.questions[state.session.index].word.word);
  refreshGameView();
}

function handleMemoryCard(cardId) {
  const result = revealMemoryCard(state.session, cardId);
  if (result.pair === false) {
    state.session.feedback = '这两张卡不匹配，再找找看。';
    clearTimeout(state.mismatchTimer);
    state.mismatchTimer = setTimeout(() => { hideMismatchedCards(state.session); state.session.feedback = ''; refreshGameView(); }, 700);
  } else if (result.pair) state.session.feedback = '配对成功！+120 分';
  if (result.finished) finishSession(); else refreshGameView();
}

async function finishSession() {
  if (!state.session || state.savedSessionIds.has(state.session.id)) return;
  state.session.status = 'finished';
  clearInterval(state.timer); state.timer = null;
  const record = completeSession(state.session);
  state.savedSessionIds.add(state.session.id);
  await storage.saveRecord(record);
  await refreshData();
  if (state.route === 'battle') refreshGameView();
  else renderHome();
}

function refreshGameView() {
  if (state.route === 'battle') renderRoute('battle');
}

async function exportWords() {
  downloadJSON({ format: 'english-vs-words', version: 1, exportedAt: new Date().toISOString(), decks: state.decks, words: state.words }, `english-vs-words-${new Date().toISOString().slice(0, 10)}.json`);
  toast('词库文件已导出。');
}
async function backupAll() {
  const backup = await storage.exportBackup();
  downloadJSON(backup, `english-vs-backup-${new Date().toISOString().slice(0, 10)}.json`);
  toast('完整备份已下载。');
}
async function exportRecords() {
  downloadJSON({ format: 'english-vs-records', exportedAt: new Date().toISOString(), records: state.records }, `english-vs-records-${new Date().toISOString().slice(0, 10)}.json`);
  toast('学习记录已导出。');
}
async function restoreBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!await confirmAction('恢复完整备份？', '当前词库、单词、成绩和设置会替换为备份中的内容。此操作无法撤销。', '恢复数据')) return;
    const result = await storage.importBackup(data);
    await refreshData(); state.settings = await storage.getSettings(); globalThis.aiImportSettings = { endpoint: state.settings.aiEndpoint, apiKey: state.settings.aiApiKey, model: state.settings.aiModel }; applyTheme(); renderAll();
    toast(`恢复完成：${result.decks} 个词库，${result.words} 个单词。`);
  } catch (error) { toast(`恢复失败：${error.message}`, 'error'); }
}
async function clearHistory() {
  if (!state.records.length) { toast('当前没有学习记录。'); return; }
  if (!await confirmAction('清空所有学习记录？', '词库与单词会保留，但所有本地游戏成绩将被删除。', '清空记录')) return;
  await storage.clearRecords(); await refreshData(); renderAll(); toast('学习记录已清空。');
}
async function clearAll() {
  if (!await confirmAction('清空本机所有数据？', '这会删除所有词库、单词和学习记录。建议先导出完整备份。', '清空全部数据')) return;
  try { await storage.clearAllData(); await refreshData(); state.records = []; state.settings = await storage.getSettings(); globalThis.aiImportSettings = {}; applyTheme(); renderAll(); toast('本机数据已清空，示例词库已重新载入。'); }
  catch (error) { toast(`清空失败：${error.message}`, 'error'); }
}

async function setTheme(theme) {
  state.settings.theme = theme;
  applyTheme();
  await storage.saveSettings(state.settings);
  if (state.route === 'settings') renderRoute('settings');
}
function applyTheme() {
  document.body.dataset.theme = state.settings.theme || 'light';
  document.querySelector('#theme-toggle').textContent = state.settings.theme === 'dark' ? '☾' : '☼';
}
function filterLeaderboard(records) {
  if (state.leaderboardPeriod === 'all') return records;
  const now = new Date(); const threshold = new Date(now);
  if (state.leaderboardPeriod === 'today') threshold.setHours(0, 0, 0, 0); else threshold.setDate(threshold.getDate() - 7);
  return records.filter(record => new Date(record.playedAt) >= threshold);
}
function deckName(id) { return state.decks.find(deck => deck.id === id)?.name || '课堂词库'; }
function modeName(id) { return MODES.find(mode => mode.id === id)?.title || id; }
function modeIcon(id) { return MODES.find(mode => mode.id === id)?.icon || '✦'; }

boot().catch(error => {
  console.error(error);
  toast(`应用启动失败：${error.message}。请使用 start.bat 通过本地服务打开。`, 'error', 10000);
});
