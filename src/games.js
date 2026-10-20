import { MODES, createId, DEMO_PLAYERS } from './data.js';
import { escapeHTML, formatDate } from './ui.js';

export function renderGamesPage(words, decks) {
  return `<div class="page-header"><div><span class="eyebrow">CLASSROOM GAME CENTER</span><h1>游戏中心</h1><p>挑选一个玩法，使用你的词库开始本地课堂挑战。</p></div><div class="page-actions"><button class="button button-outline" data-action="fullscreen">⛶ 课堂大屏</button><button class="button button-primary" data-route="battle">⚔ 快速开始</button></div></div>
    <div class="stat-cards"><div class="stat-card"><span>可用词汇</span><strong>${words.length}</strong><small>用于生成挑战题目</small></div><div class="stat-card"><span>课堂词库</span><strong>${decks.length}</strong><small>可自由选择</small></div><div class="stat-card"><span>游戏玩法</span><strong>${MODES.length}</strong><small>单机课堂挑战</small></div><div class="stat-card"><span>运行方式</span><strong>本地</strong><small>无需登录与联网</small></div></div>
    <div class="game-mode-grid">${MODES.map(mode => `<button class="mode-card mode-${mode.color}" data-action="configure-game" data-mode="${mode.id}"><span class="mode-icon">${mode.icon}</span><h3>${mode.title}</h3><p>${mode.description}</p><span class="tag">${mode.kind}</span><span class="mode-play">开始 →</span></button>`).join('')}</div>
    <div class="page-grid" style="margin-top:14px"><section class="content-card span-7"><div class="panel-heading" style="padding:0 0 10px"><div><span class="heading-icon blue">⌨</span><div><h2>课堂操作</h2><p>适合投影和全班轮流作答</p></div></div></div><div class="format-grid" style="grid-template-columns:repeat(3,1fr)"><div class="format-card"><strong>键盘答题</strong><p>选择题可按 1–4；回车确认拼写答案。</p></div><div class="format-card"><strong>大屏展示</strong><p>支持全屏显示，退出全屏可按 Esc。</p></div><div class="format-card"><strong>本机计分</strong><p>结果保存在此浏览器，不会同步到其他设备。</p></div></div></section><section class="content-card span-5"><div class="panel-heading" style="padding:0 0 10px"><div><span class="heading-icon amber">✧</span><div><h2>游戏玩法提示</h2><p>按词库内容生成干扰选项</p></div></div></div><p class="muted" style="font-size:var(--font-ui);line-height:1.8;margin:0">选择题、听力与拼写至少需要 4 个有英文和中文释义的单词；记忆翻牌至少需要 4 个单词。语音发音依赖浏览器 Web Speech API。联网多人实时对战和 AI 自动出题不属于本地离线功能。</p></section></div>`;
}

export function renderBattlePage(records = []) {
  const wins = records.filter(record => record.correct > 0).length;
  return `<div class="page-header"><div><span class="eyebrow">CLASSROOM ARENA</span><h1>对战模式</h1><p>本地课堂挑战大厅 · 支持个人练习与投影展示</p></div><div class="page-actions"><button class="button button-outline" data-action="fullscreen">⛶ 全屏展示</button><button class="button button-primary" data-action="configure-game" data-mode="quiz">开始单词对战</button></div></div>
    <div class="page-grid"><section class="content-card span-8" style="padding:0;overflow:hidden;background:#0c2858;color:#fff"><div class="battle-lobby-art"><div class="lobby-orb">✦</div><div class="lobby-kicker">ENGLISH VS · CLASSROOM MATCH</div><h2>准备好迎接<br>下一场词汇挑战了吗？</h2><p>选择本地词库，开启个人限时挑战。成绩会自动保存到学习记录。</p><button class="button button-light" data-action="configure-game" data-mode="quiz">选择游戏模式 <span>→</span></button><div class="lobby-badges"><span>⌨ 键盘操作</span><span>⏱ 自定义时长</span><span>▤ 本地词库</span></div></div></section><section class="content-card span-4"><div class="panel-heading" style="padding:0 0 12px"><div><span class="heading-icon cyan">▣</span><div><h2>课堂状态</h2><p>本机练习统计</p></div></div><span class="tag green">● 可开始</span></div><div class="stat-card"><span>累计挑战</span><strong>${records.length}</strong><small>次本地练习</small></div><div class="stat-card" style="margin-top:8px"><span>最近正确数</span><strong>${records[0]?.correct ?? 0}</strong><small>${records[0] ? `${records[0].total} 题 · ${formatDate(records[0].playedAt)}` : '完成一局后显示'}</small></div><div class="divider"></div><p class="muted" style="font-size:var(--font-ui);line-height:1.7">原型中的在线对手、实时聊天和跨设备同步需要网络服务器。本版本提供本地课堂演示与个人挑战，不会将演示数据伪装成真实在线玩家。</p></section>
    <section class="content-card span-12"><div class="panel-heading" style="padding:0 0 12px"><div><span class="heading-icon violet">♧</span><div><h2>选择挑战玩法</h2><p>每种模式都可独立完成并记录成绩</p></div></div></div><div class="game-mode-grid">${MODES.map(mode => `<button class="mode-card mode-${mode.color}" data-action="configure-game" data-mode="${mode.id}"><span class="mode-icon">${mode.icon}</span><h3>${mode.title}</h3><p>${mode.description}</p><span class="tag">${mode.kind}</span><span class="mode-play">开始 →</span></button>`).join('')}</div></section></div>`;
}

export function renderGameConfig(mode, decks, defaultDeckId) {
  const info = MODES.find(item => item.id === mode) || MODES[0];
  return `<p class="confirm-copy">${escapeHTML(info.description)} 选择一个词库并设置本轮长度。</p><form id="game-config-form" data-mode="${escapeHTML(info.id)}"><div class="form-field"><label for="game-deck">练习词库</label><select class="control-select" id="game-deck" name="deckId">${decks.map(deck => `<option value="${escapeHTML(deck.id)}" ${deck.id === defaultDeckId ? 'selected' : ''}>${escapeHTML(deck.name)}</option>`).join('')}</select></div><div class="form-row"><div class="form-field"><label for="game-count">题目数量</label><select class="control-select" id="game-count" name="count"><option value="5">5 题 · 快速热身</option><option value="10" selected>10 题 · 标准挑战</option><option value="15">15 题 · 进阶挑战</option></select></div><div class="form-field"><label for="game-seconds">每局时间</label><select class="control-select" id="game-seconds" name="seconds"><option value="60">60 秒</option><option value="90" selected>90 秒</option><option value="120">120 秒</option></select></div></div><label class="check-row"><input type="checkbox" name="voice" checked> 启用浏览器语音（听力模式固定启用）</label><div class="modal-form-actions"><button type="button" class="button button-outline" data-modal-cancel>取消</button><button type="submit" class="button button-primary">开始挑战</button></div></form>`;
}

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function createSession({ mode, words, deckId, count = 10, seconds = 90, voice = true }) {
  const valid = words.filter(word => word.word && word.meaning);
  const minimum = mode === 'memory' ? 4 : 4;
  if (valid.length < minimum) throw new Error(`所选词库至少需要 ${minimum} 个含释义的单词才能开始。`);
  const selected = shuffle(valid).slice(0, Math.min(Number(count), valid.length));
  const optionsFor = word => shuffle([word, ...shuffle(valid.filter(item => item.id !== word.id)).slice(0, 3)]);
  const questions = selected.map(word => ({
    word,
    options: optionsFor(word),
    answer: mode === 'quiz' || mode === 'spelling' ? word.word : word.meaning,
  }));
  const cards = mode === 'memory' ? shuffle(selected.flatMap((word, index) => [
    { id: `${index}-en`, pairId: word.id, label: word.word, kind: '英文' },
    { id: `${index}-zh`, pairId: word.id, label: word.meaning, kind: '释义' },
  ])) : [];
  return { id: createId('session'), mode, deckId, questions, cards, index: 0, score: 0, correct: 0, wrong: 0, matched: 0, picks: [], memoryMoves: 0, answered: false, feedback: '', secondsLeft: Number(seconds), totalSeconds: Number(seconds), voice, status: 'playing', startedAt: Date.now(), selectedCardIds: [], matchedCardIds: [], timeBonus: 0 };
}

export function answerQuestion(session, answer) {
  if (!session || session.status !== 'playing' || session.answered) return { session, correct: null, finished: false };
  const question = session.questions[session.index];
  const normalized = String(answer).trim().toLocaleLowerCase();
  const expected = String(question.answer).trim().toLocaleLowerCase();
  const correct = normalized === expected;
  session.answered = true;
  session.selectedAnswer = String(answer).trim();
  session.feedback = correct ? `回答正确！${question.word.word} · ${question.word.meaning}` : `正确答案：${question.answer}`;
  if (correct) { session.correct++; session.score += 100 + Math.min(50, Math.floor(session.secondsLeft / 3)); }
  else session.wrong++;
  return { session, correct, finished: false };
}

export function advanceSession(session) {
  if (!session || session.status !== 'playing') return session;
  session.index++;
  session.answered = false;
  session.feedback = '';
  if (session.secondsLeft <= 0 || session.index >= session.questions.length) session.status = 'finished';
  return session;
}

export function tickSession(session) {
  if (session?.status === 'playing') {
    session.secondsLeft = Math.max(0, session.secondsLeft - 1);
    if (!session.secondsLeft) session.status = 'finished';
  }
  return session;
}

export function revealMemoryCard(session, cardId) {
  if (!session || session.status !== 'playing' || session.selectedCardIds.includes(cardId) || session.matchedCardIds.includes(cardId)) return { session, pair: null, finished: false };
  session.selectedCardIds.push(cardId);
  if (session.selectedCardIds.length < 2) return { session, pair: null, finished: false };
  session.memoryMoves++;
  const first = session.cards.find(card => card.id === session.selectedCardIds[0]);
  const second = session.cards.find(card => card.id === session.selectedCardIds[1]);
  const pair = first?.pairId === second?.pairId;
  if (pair) {
    session.matchedCardIds.push(first.id, second.id);
    session.matched++;
    session.correct++;
    session.score += 120;
    session.selectedCardIds = [];
    if (session.matched === session.questions.length) session.status = 'finished';
  } else {
    session.wrong++;
  }
  return { session, pair, finished: session.status === 'finished' };
}

export function hideMismatchedCards(session) {
  if (session?.selectedCardIds.length === 2) session.selectedCardIds = [];
  return session;
}

export function completeSession(session) {
  if (!session) return null;
  session.status = 'finished';
  return {
    id: session.id, mode: session.mode, deckId: session.deckId,
    score: session.score, correct: session.correct, wrong: session.wrong,
    total: session.mode === 'memory' ? session.questions.length : session.questions.length,
    accuracy: session.questions.length ? Math.round(session.correct / session.questions.length * 100) : 0,
    duration: Math.max(0, Math.round((Date.now() - session.startedAt) / 1000)), playedAt: new Date().toISOString(),
  };
}

export function renderGameSession(session, deckName = '') {
  const mode = MODES.find(item => item.id === session.mode) || MODES[0];
  if (session.status === 'finished') return renderResult(session, mode, deckName);
  if (session.mode === 'memory') return renderMemory(session, mode, deckName);
  const question = session.questions[session.index];
  const progress = Math.round(session.index / session.questions.length * 100);
  const isListening = session.mode === 'listening';
  const isSpelling = session.mode === 'spelling';
  return `<div class="quiz-shell"><div class="quiz-top"><button class="button button-outline button-small" data-action="exit-game">← 退出本局</button><span class="tag">${escapeHTML(deckName)} · ${mode.title}</span><button class="button button-outline button-small" data-action="toggle-pause">${session.paused ? '继续' : '暂停'}</button></div><div class="quiz-progress"><span style="width:${progress}%"></span></div><div class="quiz-board"><div class="quiz-score-row"><div class="quiz-player"><span class="quiz-player-avatar">🧑🏻‍🎓</span><span><small>我的得分</small><strong>${session.score}</strong></span></div><div class="quiz-clock"><strong>${formatClock(session.secondsLeft)}</strong><small>第 ${session.index + 1} / ${session.questions.length} 题</small></div><div class="quiz-player opponent"><span><small>本轮正确</small><strong>${session.correct}</strong></span><span class="quiz-player-avatar">✨</span></div></div>
    <div class="question-card"><span class="question-kicker">${isListening ? 'LISTEN AND CHOOSE' : isSpelling ? 'SPELL THE WORD' : 'CHOOSE THE RIGHT WORD'}</span>${isListening ? `<div class="question-word" style="font-size:36px">♪</div><div class="question-hint">点击播放，听一听这个单词</div><button class="button button-primary button-small" style="margin-top:10px" data-action="play-question-audio">▶ 播放发音</button>` : isSpelling ? `<div class="question-word">${escapeHTML(question.word.meaning)}</div><div class="question-hint">${escapeHTML(question.word.part || '')} ${escapeHTML(question.word.phonetic || '')}</div>` : `<div class="question-word">${escapeHTML(question.word.meaning || question.word.word)}</div><div class="question-hint">${escapeHTML(question.word.part || '请选择对应的英文单词')}</div>`}${session.mode === 'quiz' && question.word.example ? `<div class="question-hint" style="margin-top:9px">例句：${escapeHTML(question.word.example)}</div>` : ''}</div>
    ${isSpelling ? `<form class="quiz-input-row" id="spelling-form"><input name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="输入英文单词" aria-label="输入英文答案" ${session.answered ? 'disabled' : ''}><button class="button button-primary" type="submit" ${session.answered ? 'disabled' : ''}>提交</button></form>` : `<div class="answer-grid">${question.options.map((option, index) => { const value = isListening ? option.meaning : option.word; const isCorrectOption = option.word === question.word.word; const isWrongSelection = session.answered && session.selectedAnswer === value && !isCorrectOption; return `<button class="answer-option ${session.answered && isCorrectOption ? 'correct' : ''} ${isWrongSelection ? 'incorrect' : ''}" data-answer="${escapeHTML(value)}" ${session.answered || session.paused ? 'disabled' : ''}>${index + 1}. ${escapeHTML(value)}</button>`; }).join('')}</div>`}
    <div class="quiz-feedback">${escapeHTML(session.feedback || (session.paused ? '本局已暂停' : '选择答案继续挑战'))}</div><div class="quiz-bottom"><span>已答对 ${session.correct} 题 · ${session.score} 分</span><span>${isListening ? '语音由浏览器播放' : '按键 1–4 也可作答'}　·　${mode.kind}</span>${session.answered ? '<button class="button button-light button-small" data-action="next-question">下一题 →</button>' : ''}</div></div></div>`;
}

function renderMemory(session, mode, deckName) {
  return `<div class="quiz-shell"><div class="quiz-top"><button class="button button-outline button-small" data-action="exit-game">← 退出本局</button><span class="tag">${escapeHTML(deckName)} · ${mode.title}</span><button class="button button-outline button-small" data-action="toggle-pause">${session.paused ? '继续' : '暂停'}</button></div><div class="quiz-board"><div class="quiz-score-row"><div class="quiz-player"><span class="quiz-player-avatar">🧑🏻‍🎓</span><span><small>已配对</small><strong>${session.matched} / ${session.questions.length}</strong></span></div><div class="quiz-clock"><strong>${formatClock(session.secondsLeft)}</strong><small>翻牌 ${session.memoryMoves} 次</small></div><div class="quiz-player opponent"><span><small>当前得分</small><strong>${session.score}</strong></span><span class="quiz-player-avatar">🧠</span></div></div><div class="question-card"><span class="question-kicker">MEMORY MATCH</span><div class="question-word" style="font-size:20px">找到英文与中文释义的配对</div><div class="question-hint">翻开两张牌，尽量用更少步数完成</div></div><div class="memory-grid">${session.cards.map(card => { const revealed = session.selectedCardIds.includes(card.id) || session.matchedCardIds.includes(card.id); const matched = session.matchedCardIds.includes(card.id); return `<button class="memory-card ${revealed ? 'revealed' : ''} ${matched ? 'matched' : ''}" data-memory-card="${escapeHTML(card.id)}" ${revealed || session.paused ? 'disabled' : ''}>${revealed ? `<span><small style="display:block;color:#8aa1ba;font-size:var(--font-ui)">${card.kind}</small>${escapeHTML(card.label)}</span>` : '✦'}</button>`; }).join('')}</div><div class="quiz-feedback">${session.feedback || (session.paused ? '本局已暂停' : '两张牌配对成功可获得 120 分')}</div><div class="quiz-bottom"><span>答对 ${session.correct} 对 · 错误 ${session.wrong} 次</span><span>记忆挑战 · 本地计分</span><button class="button button-light button-small" data-action="exit-game">结束挑战</button></div></div></div>`;
}

function renderResult(session, mode, deckName) {
  const accuracy = session.questions.length ? Math.round(session.correct / session.questions.length * 100) : 0;
  return `<div class="quiz-shell"><div class="quiz-top"><span class="tag">${escapeHTML(deckName)} · ${mode.title}</span><button class="button button-outline button-small" data-route="games">返回游戏中心</button></div><div class="quiz-board"><div class="result-card"><div class="question-kicker">CHALLENGE COMPLETE</div><div style="font-size:34px;margin:10px">${accuracy >= 80 ? '🏆' : accuracy >= 50 ? '🌟' : '💪'}</div><h2>${accuracy >= 80 ? '太棒了，表现出色！' : accuracy >= 50 ? '做得不错，继续加油！' : '挑战完成，再练一次！'}</h2><div class="result-score">${session.score}<small style="font-size:var(--font-ui)"> 分</small></div><div class="result-meta"><div><strong>${session.correct}</strong>答对</div><div><strong>${session.wrong}</strong>答错</div><div><strong>${accuracy}%</strong>正确率</div><div><strong>${formatClock(Math.max(0, session.totalSeconds - session.secondsLeft))}</strong>用时</div></div><div class="page-actions" style="justify-content:center"><button class="button button-outline" data-route="history">查看学习记录</button><button class="button button-primary" data-action="replay-game" data-mode="${session.mode}" data-deck="${escapeHTML(session.deckId)}">再挑战一次 →</button></div></div></div></div>`;
}

export function renderLeaderboardPage(records, period = 'all') {
  const players = [...DEMO_PLAYERS];
  const local = records.reduce((sum, record) => sum + record.score, 0);
  players.push({ name: '本机课堂', avatar: '📚', score: local, accuracy: records.length ? Math.round(records.reduce((sum, record) => sum + record.accuracy, 0) / records.length) : 0, games: records.length, local: true });
  players.sort((a, b) => b.score - a.score);
  return `<div class="page-header"><div><span class="eyebrow">CLASSROOM LEADERBOARD</span><h1>排行榜</h1><p>示例学生为原型演示数据；“本机课堂”为当前设备真实练习结果。</p></div><div class="page-actions"><button class="button button-outline" data-action="export-scores">↓ 导出成绩</button></div></div><div class="stat-cards"><div class="stat-card"><span>我的总积分</span><strong>${local}</strong><small>本机累计练习</small></div><div class="stat-card"><span>完成场次</span><strong>${records.length}</strong><small>保存在当前浏览器</small></div><div class="stat-card"><span>平均正确率</span><strong>${records.length ? Math.round(records.reduce((sum, record) => sum + record.accuracy, 0) / records.length) : 0}%</strong><small>根据本机记录计算</small></div><div class="stat-card"><span>更新时间</span><strong>实时</strong><small>本地数据自动汇总</small></div></div><section class="content-card"><div class="toolbar"><select class="control-select" data-action="leader-filter"><option value="all" ${period === 'all' ? 'selected' : ''}>全部时间</option><option value="week" ${period === 'week' ? 'selected' : ''}>最近一周</option><option value="today" ${period === 'today' ? 'selected' : ''}>今天</option></select><span class="muted" style="font-size:var(--font-ui)">示例榜单不代表联网课堂排名</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>排名</th><th>学生</th><th>积分</th><th>正确率</th><th>挑战场次</th><th>来源</th></tr></thead><tbody>${players.map((player, index) => `<tr><td><span class="leader-rank">${index + 1}</span></td><td><span class="leader-user"><span class="leader-avatar">${player.avatar}</span>${escapeHTML(player.name)}</span></td><td class="table-word">${player.score.toLocaleString()}</td><td>${player.accuracy}%</td><td>${player.games}</td><td><span class="tag ${player.local ? 'green' : ''}">${player.local ? '本机真实数据' : '原型示例'}</span></td></tr>`).join('')}</tbody></table></div></section>`;
}

export function renderHistoryPage(records, decks) {
  const games = [...new Set(records.map(record => record.mode))];
  return `<div class="page-header"><div><span class="eyebrow">LEARNING JOURNEY</span><h1>学习记录</h1><p>回顾本地挑战情况，掌握每次练习的进步。</p></div><div class="page-actions"><button class="button button-outline" data-action="export-scores">↓ 导出记录</button><button class="button button-danger" data-action="clear-records">清空记录</button></div></div><div class="stat-cards"><div class="stat-card"><span>累计挑战</span><strong>${records.length}</strong><small>场本地练习</small></div><div class="stat-card"><span>累计答对</span><strong>${records.reduce((sum, record) => sum + record.correct, 0)}</strong><small>个词汇答对</small></div><div class="stat-card"><span>累计积分</span><strong>${records.reduce((sum, record) => sum + record.score, 0)}</strong><small>所有模式合计</small></div><div class="stat-card"><span>常用玩法</span><strong>${games.length}</strong><small>种模式已体验</small></div></div><section class="content-card"><div class="toolbar"><label class="search-box"><span>⌕</span><input data-history-search placeholder="搜索游戏模式或词库"></label><select class="control-select" data-history-mode><option value="all">全部玩法</option>${MODES.map(mode => `<option value="${mode.id}">${mode.title}</option>`).join('')}</select><select class="control-select" data-history-period><option value="all">全部时间</option><option value="week">最近一周</option><option value="today">今天</option></select></div><div data-history-table>${historyTable(records, decks)}</div></section>`;
}

export function historyTable(records, decks, filter = {}) {
  const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 7);
  const filtered = records.filter(record => {
    const mode = MODES.find(item => item.id === record.mode);
    const deck = decks.find(item => item.id === record.deckId);
    const query = filter.search?.toLowerCase() || '';
    return (!filter.mode || filter.mode === 'all' || record.mode === filter.mode)
      && (!filter.search || `${mode?.title || ''} ${deck?.name || ''}`.toLowerCase().includes(query))
      && (!filter.period || filter.period === 'all' || (filter.period === 'today' ? new Date(record.playedAt).toDateString() === today.toDateString() : new Date(record.playedAt) >= start));
  });
  if (!filtered.length) return '<div class="empty-state"><div class="empty-icon">◷</div><strong>还没有符合条件的记录</strong><p>完成一局挑战后，成绩会出现在这里。</p></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>日期</th><th>游戏模式</th><th>词库</th><th>答对</th><th>得分</th><th>正确率</th><th>用时</th></tr></thead><tbody>${filtered.map(record => `<tr><td>${formatDate(record.playedAt)}</td><td><span class="tag">${escapeHTML(MODES.find(mode => mode.id === record.mode)?.title || record.mode)}</span></td><td>${escapeHTML(decks.find(deck => deck.id === record.deckId)?.name || '已删除词库')}</td><td>${record.correct} / ${record.total}</td><td class="table-word">${record.score}</td><td>${record.accuracy}%</td><td>${Math.floor(record.duration / 60)}:${String(record.duration % 60).padStart(2, '0')}</td></tr>`).join('')}</tbody></table></div>`;
}

function formatClock(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
