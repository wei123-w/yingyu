import { createId } from './data.js';
import { requestAI } from './ai.js?v=15';

const FIELD_ALIASES = {
  word: ['word', 'english', 'englishword', '英文', '英文单词', '单词', '词汇', '单词英文'],
  phonetic: ['phonetic', 'ipa', 'pronunciation', '音标', '发音'],
  part: ['part', 'pos', 'type', '词性'],
  meaning: ['meaning', 'translation', 'chinese', 'chinesemeaning', '中文', '释义', '中文释义', '意思'],
  example: ['example', 'sentence', '例句', '例句英文'],
  deck: ['deck', 'category', 'group', '分类', '词库'],
  unit: ['unit', 'lesson', 'chapter', 'unit name', 'unit number', '所属单元', '教材单元', '单元', '单元名称', '单元分类', '课次', '第几单元'],
};

function keyFor(value) {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s_-]/g, '');
  return Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.some(alias => alias.toLowerCase().replace(/[\s_-]/g, '') === key))?.[0];
}

function splitCSVLine(line, delimiter) {
  const cells = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}

function csvToRows(source) {
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = lines[0];
  const delimiter = ['\t', ',', ';'].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const matrix = lines.map(line => splitCSVLine(line, delimiter));
  const hasHeader = matrix[0].some(cell => keyFor(cell));
  const headers = hasHeader ? matrix.shift().map(keyFor) : ['word', 'meaning', 'phonetic', 'part', 'example', 'deck', 'unit'];
  return matrix.map(cells => Object.fromEntries(cells.map((cell, index) => [headers[index] || `extra${index}`, cell])));
}

function txtToRows(source) {
  let currentUnit = '';
  const output = [];
  for (const line of source.replace(/^\uFEFF/, '').split(/\r?\n/).map(item => item.trim()).filter(Boolean)) {
    const heading = unitHeading(line);
    if (heading) { currentUnit = heading; continue; }
    const cells = line.split(/\t+|\s+-\s+|\s+[–—]\s+|[,;]+/).map(cell => cell.trim());
    let row;
    if (cells.length === 1) {
      const colon = line.match(/^([\p{L}][\p{L}'’ -]*)\s*[:：]\s*(.+)$/u);
      if (colon) row = { word: colon[1].trim(), meaning: colon[2].trim() };
      else {
        const paired = line.match(/^([a-zA-Z][a-zA-Z'’-]{1,39})\s+(\/[^/]+\/\s*)?((?:adj\.?|n\.?|v\.?|adv\.?|prep\.?|pron\.?|conj\.?|num\.?)\s+)?([\u4e00-\u9fff].+)$/iu);
        row = paired ? { word: paired[1].trim(), phonetic: paired[2]?.trim() || '', part: paired[3]?.trim() || '', meaning: paired[4].trim() } : { word: cells[0] };
      }
    } else row = { word: cells[0], meaning: cells[1] || '', phonetic: cells[2] || '', part: cells[3] || '', example: cells[4] || '' };
    output.push({ ...row, unit: currentUnit });
  }
  return output;
}

function unitHeading(line) {
  const value = String(line || '').trim();
  const english = value.match(/^(unit|lesson|chapter)\s*(\d{1,2}|[一二三四五六七八九十]+)(?=$|[\s:：.、-])(?:\s+.*|\s*[:：.、-].*)?$/i);
  if (english) return `${english[1][0].toUpperCase()}${english[1].slice(1).toLowerCase()} ${english[2]}`;
  const chinese = value.match(/^(第\s*[0-9一二三四五六七八九十]+\s*(?:单元|课|课时))(?:\s+.*|\s*[:：.、-].*)?$/);
  return chinese?.[1].replace(/\s+/g, '') || '';
}

export function normalizeImportRows(input) {
  let rows = Array.isArray(input) ? input : input?.words;
  if (!Array.isArray(rows)) throw new Error('JSON 文件应为单词数组，或包含 words 数组的备份对象。');
  return rows.map((item, index) => {
    let row;
    if (Array.isArray(item)) row = { word: item[0], meaning: item[1], phonetic: item[2], part: item[3], example: item[4], deck: item[5], unit: item[6] };
    else {
      row = {};
      for (const [rawKey, value] of Object.entries(item || {})) {
        const field = keyFor(rawKey);
        if (field) row[field] = value;
      }
    }
    const word = String(row.word ?? '').trim();
    if (!word || !/^[\p{L}][\p{L}'’ -]*$/u.test(word)) return null;
    return {
      id: createId('word'), word, phonetic: String(row.phonetic ?? '').trim(),
      part: String(row.part ?? '').trim(), meaning: String(row.meaning ?? '').trim(),
      example: String(row.example ?? '').trim(), deck: String(row.deck ?? '').trim(), unit: String(row.unit ?? '').trim(),
      sourceRow: index + 1,
    };
  }).filter(Boolean);
}

export async function readImportFile(file) {
  const name = file.name.toLowerCase();
  const ext = name.split('.').pop();
  const fileUnit = unitHeading(name.slice(0, -(ext.length + 1)));
  if (ext === 'docx') {
    if (!globalThis.mammoth) throw new Error('Word 文档解析器未能加载，请检查项目文件是否完整。');
    const result = await globalThis.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const rows = applyFileUnit(normalizeImportRows(txtToRows(result.value)), fileUnit);
    return { rows, warning: rows.length ? 'Word 文档已在本机提取文字，请确认预览内容后再导入。' : '已读取 Word 文档，但没有识别出单词列表。请确保文档每行包含英文单词和中文释义。' };
  }
  if (ext === 'pdf') {
    const pdfjs = await import('../vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines = [];
    const maxPages = Math.min(pdf.numPages, 120);
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      let currentY = null;
      let line = '';
      for (const item of textContent.items) {
        if (!item.str) continue;
        const y = Math.round(item.transform?.[5] || 0);
        if (currentY !== null && Math.abs(y - currentY) > 3) { if (line.trim()) lines.push(line.trim()); line = ''; }
        line += `${line ? ' ' : ''}${item.str}`;
        currentY = y;
      }
      if (line.trim()) lines.push(line.trim());
    }
    let rows = applyFileUnit(normalizeImportRows(txtToRows(lines.join('\n'))), fileUnit);
    let aiPages = 0;
    const settings = globalThis.aiImportSettings || {};
    if (!rows.length && settings.apiKey && settings.endpoint) {
      const maxAiPages = Math.min(pdf.numPages, 10);
      let currentUnit = fileUnit;
      for (let pageNumber = 1; pageNumber <= maxAiPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.35 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const pageRows = await requestVisionWords(dataUrl, settings, currentUnit);
        const pageUnits = pageRows.map(row => row.unit).filter(Boolean);
        rows.push(...applyFileUnit(pageRows, currentUnit || pageUnits[0] || ''));
        if (pageUnits.length) currentUnit = pageUnits[pageUnits.length - 1];
        aiPages++;
      }
    }
    const warning = pdf.numPages > maxPages ? `文件共 ${pdf.numPages} 页，本次仅提取前 ${maxPages} 页。识别到 ${rows.length} 个词汇。` : aiPages ? `已将扫描 PDF 前 ${aiPages} 页发送到你配置的 AI 服务，识别到 ${rows.length} 个词汇。请逐项审核。` : rows.length ? `PDF 已在本机提取文字，识别到 ${rows.length} 个词汇。扫描版 PDF 需配置联网 AI 图片识别。` : 'PDF 中没有可直接提取的文字。扫描版 PDF 可配置 AI 图片识别，或先转换为 TXT/CSV。';
    return { rows, warning };
  }
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    const settings = globalThis.aiImportSettings || {};
    if (!settings.apiKey || !settings.endpoint) return { rows: [], warning: '图片文字识别需要配置兼容 Chat Completions 的 AI 接口、模型与 API 密钥。图片会发送到你配置的服务处理；可在“系统设置 → AI 导入”填写。', unsupported: true };
    const mimeType = file.type || ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[ext] || 'image/png');
    const dataUrl = `data:${mimeType};base64,${arrayBufferToBase64(await file.arrayBuffer())}`;
    const rows = applyFileUnit(await requestVisionWords(dataUrl, settings), fileUnit);
    return { rows, warning: `已通过你配置的 AI 服务识别 ${rows.length} 个词汇，请逐项审核后导入。图片已发送至该服务。` };
  }
  if (ext === 'doc') return { rows: [], warning: '旧版 DOC 格式暂不支持；请另存为 DOCX 或 TXT 后导入。', unsupported: true };
  const text = await file.text();
  if (!text.trim()) throw new Error('文件内容为空。');
  if (ext === 'json') {
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (parsed?.format === 'english-vs-backup') return { backup: parsed, rows: [], warning: '检测到完整备份文件，可在系统设置中执行完整恢复。' };
    return { rows: applyFileUnit(normalizeImportRows(parsed), fileUnit), warning: '' };
  }
  const rows = applyFileUnit(normalizeImportRows(ext === 'txt' ? txtToRows(text) : csvToRows(text)), fileUnit);
  return { rows, warning: rows.length ? '' : '没有识别到英文单词。建议每行使用“英文,中文释义,音标,词性,例句,词库”列，或按“英文 - 中文释义”逐行填写。' };
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  return btoa(binary);
}

function applyFileUnit(rows, fallbackUnit) {
  return fallbackUnit ? rows.map(row => row.unit ? row : { ...row, unit: fallbackUnit }) : rows;
}

async function requestVisionWords(dataUrl, settings, previousUnit = '') {
  const unitHint = previousUnit ? `如果图片没有新的单元标题，请沿用上一页已确认的“${previousUnit}”；如果本页出现新标题，以本页为准。` : '';
  const response = await requestAI(settings.endpoint, settings.apiKey, {
    model: settings.model || 'gpt-4o-mini', messages: [{ role: 'user', content: [
      { type: 'text', text: `请从图片中提取清晰可见的英语单词及其所属单元、中文释义、音标、词性和例句。如果图片中出现“第1单元”“Unit 1”“Lesson 2”等标题，请把对应词汇归到该单元；${unitHint}无法确认时 unit 留空，不要猜测。只返回 JSON，不要 Markdown，格式为 {"words":[{"word":"apple","unit":"第1单元","meaning":"苹果","phonetic":"/ˈæpəl/","part":"n.","example":"I ate an apple."}]}。其他不确定的字段留空。` },
      { type: 'image_url', image_url: { url: dataUrl } },
    ] }] },
  );
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`AI 服务返回了无法读取的响应（${response.status}）。`); }
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.error;
    throw new Error(typeof detail === 'string' ? detail : `AI 服务返回错误（${response.status}），请检查接口地址、密钥和模型。`);
  }
  let content = payload.choices?.[0]?.message?.content;
  if (Array.isArray(content)) content = content.map(part => part.text || '').join('\n');
  const jsonText = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return normalizeImportRows(JSON.parse(jsonText));
}
