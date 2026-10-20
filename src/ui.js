const toastRegion = document.querySelector('#toast-region');
const backdrop = document.querySelector('#modal-backdrop');
const modalTitle = document.querySelector('#modal-title');
const modalContent = document.querySelector('#modal-content');
let activeConfirmResolver = null;

export function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function toast(message, type = 'success', duration = 3000) {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  toastRegion.append(item);
  window.setTimeout(() => item.remove(), duration);
}

export function openModal(title, content, onReady) {
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  document.querySelector('#modal-close').focus();
  onReady?.(modalContent);
}

export function closeModal() {
  if (activeConfirmResolver) { const resolve = activeConfirmResolver; activeConfirmResolver = null; resolve(false); }
  backdrop.hidden = true;
  modalContent.replaceChildren();
  document.body.style.overflow = '';
}

const FEMALE_ENGLISH_VOICE = /\b(aria|ava|jenny|jane|samantha|zira|hazel|susan|karen|victoria|allison|siri|female|woman)\b|晓晓|晓伊|Jenny|Zira|Hazel|Libby/i;

function availableSpeechVoices(synthesis) {
  const current = synthesis.getVoices();
  if (current.length) return Promise.resolve(current);
  return new Promise(resolve => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeoutId);
      synthesis.removeEventListener?.('voiceschanged', finish);
      resolve(synthesis.getVoices());
    };
    const timeoutId = window.setTimeout(finish, 1600);
    synthesis.addEventListener?.('voiceschanged', finish, { once: true });
  });
}

function warmSpeechVoices() {
  const synthesis = window.speechSynthesis;
  if (!synthesis) return;
  synthesis.getVoices();
  synthesis.addEventListener?.('voiceschanged', () => synthesis.getVoices(), { once: true });
}

warmSpeechVoices();

function chooseEnglishVoice(voices, language) {
  const languagePrefix = language.toLowerCase().split('-')[0];
  const matching = voices.filter(voice => voice.lang?.toLowerCase().startsWith(`${languagePrefix}-`));
  const candidates = matching.length ? matching : voices.filter(voice => voice.lang?.toLowerCase().startsWith('en-'));
  return candidates.sort((left, right) => {
    const score = voice => {
      let value = 0;
      if (FEMALE_ENGLISH_VOICE.test(voice.name)) value += 100;
      if (/natural|neural|online|premium|enhanced/i.test(voice.name)) value += 24;
      if (voice.lang?.toLowerCase() === language.toLowerCase()) value += 18;
      if (voice.localService) value += 6;
      return value;
    };
    return score(right) - score(left);
  })[0] || null;
}

function speechErrorMessage(error) {
  const messages = {
    'audio-busy': '浏览器音频正被其他程序占用，请关闭其他语音播放后重试。',
    'audio-hardware': '没有检测到可用的音频输出设备，请检查扬声器或耳机。',
    'network': '语音服务暂时无法连接，请检查网络后重试。',
    'synthesis-unavailable': '系统语音服务不可用，请检查操作系统的语音设置。',
    'voice-unavailable': '没有可用的英语语音，请在系统中安装英语语音包后重试。',
    'language-unavailable': '浏览器找不到英语语音，请在系统语言设置中安装英语语音。',
    'not-allowed': '浏览器拦截了朗读，请先点击“试听英语发音”按钮，再开始听力挑战。',
    'synthesis-failed': '语音播放失败，请更换浏览器语音或检查系统语音设置。',
  };
  return messages[error] || '语音播放失败，请检查扬声器和浏览器语音设置后重试。';
}

function speakWithVoices(text, language, synthesis, voices) {
  const preferredVoice = chooseEnglishVoice(voices, language);
  const voice = preferredVoice || voices.find(item => item.default) || voices[0] || null;
  if (!voice) {
    toast('浏览器没有提供可用语音，请检查系统语音设置。', 'error');
    return false;
  }
  synthesis.cancel();
  synthesis.resume?.();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = voice.lang || language;
  utterance.rate = 0.84;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  utterance.voice = voice;
  utterance.onerror = event => {
    if (event.error === 'canceled' || event.error === 'interrupted') return;
    const reason = speechErrorMessage(event.error);
    const code = event.error || '浏览器未提供错误码';
    toast(`${reason}（错误码：${code}；语音：${voice.name || '系统默认'}）`, 'error', 6000);
  };
  synthesis.speak(utterance);
  return true;
}

let activeSpeechAudio = null;
let activeSpeechUrl = null;

function releaseSpeechAudio(audio = activeSpeechAudio) {
  if (!audio || audio !== activeSpeechAudio) return;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  activeSpeechAudio = null;
  if (activeSpeechUrl) URL.revokeObjectURL(activeSpeechUrl);
  activeSpeechUrl = null;
  document.querySelector('.speech-player-toast')?.remove();
}

function showSpeechAudioControls(audio, reason) {
  if (audio.dataset.controlsShown === 'true') return;
  audio.dataset.controlsShown = 'true';
  const panel = document.createElement('div');
  panel.className = 'toast speech-player-toast';
  panel.setAttribute('role', 'status');

  const message = document.createElement('span');
  message.textContent = reason || '浏览器阻止了自动播放，请点击下方按钮播放。';

  audio.controls = true;
  audio.setAttribute('aria-label', '英语发音播放控件');
  audio.className = 'speech-audio-controls';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'icon-button speech-audio-close';
  close.setAttribute('aria-label', '关闭语音播放控件');
  close.textContent = '×';
  close.addEventListener('click', () => releaseSpeechAudio(audio), { once: true });

  panel.append(message, audio, close);
  toastRegion.append(panel);
}

async function playLocalSpeech(text) {
  if (activeSpeechAudio) releaseSpeechAudio();

  const endpoint = new URL('../api/speech', import.meta.url);
  endpoint.searchParams.set('text', text);
  const response = await fetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    let message = `本机语音服务返回错误（${response.status}）。`;
    try {
      const details = await response.json();
      if (details.error) message = details.error;
    } catch { /* 保留默认错误提示 */ }
    throw new Error(message);
  }

  const audioBlob = await response.blob();
  if (!audioBlob.size || !audioBlob.type.includes('audio')) {
    throw new Error('本机语音服务没有返回有效音频。');
  }

  activeSpeechUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(activeSpeechUrl);
  audio.preload = 'auto';
  activeSpeechAudio = audio;
  audio.addEventListener('ended', () => releaseSpeechAudio(audio), { once: true });
  audio.addEventListener('error', () => {
    if (audio === activeSpeechAudio) showSpeechAudioControls(audio, '浏览器无法自动播放该音频，请点击下方播放按钮重试。');
  }, { once: true });

  try {
    await audio.play();
  } catch (error) {
    if (error?.name === 'AbortError') return;
    if (audio !== activeSpeechAudio) return;
    showSpeechAudioControls(audio, '浏览器阻止了自动播放，请点击下方按钮播放。');
  }
}

function speakWithBrowser(text, language, localError) {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    toast(`本机语音服务不可用：${localError.message} 请从项目目录重新运行 start.bat。`, 'error', 7000);
    return false;
  }
  const synthesis = window.speechSynthesis;
  const voices = synthesis.getVoices();
  if (voices.length) return speakWithVoices(text, language, synthesis, voices);
  void availableSpeechVoices(synthesis).then(loadedVoices => {
    if (loadedVoices.length) speakWithVoices(text, language, synthesis, loadedVoices);
    else toast(`本机语音服务不可用：${localError.message}；浏览器也没有加载到语音。`, 'error', 7000);
  });
  return true;
}

export function speak(text, language = 'en-US') {
  const spokenText = String(text || '').trim();
  if (!spokenText) return false;
  void playLocalSpeech(spokenText).catch(error => speakWithBrowser(spokenText, language, error));
  return true;
}

export async function toggleFullscreen(element = document.documentElement) {
  if (!document.fullscreenElement) {
    if (!element.requestFullscreen) { toast('此浏览器不支持全屏展示。', 'error'); return false; }
    try { await element.requestFullscreen(); return true; }
    catch { toast('浏览器未允许全屏展示。', 'error'); return false; }
  }
  await document.exitFullscreen?.();
  return false;
}

export function formatDate(value, withTime = true) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', withTime
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function confirmAction(title, description, confirmLabel = '确认') {
  return new Promise(resolve => {
    activeConfirmResolver = resolve;
    openModal(title, `<p class="confirm-copy">${escapeHTML(description)}</p><div class="modal-form-actions"><button class="button button-outline" data-confirm="cancel">取消</button><button class="button button-danger" data-confirm="yes">${escapeHTML(confirmLabel)}</button></div>`, root => {
      root.querySelector('[data-confirm="cancel"]').addEventListener('click', () => closeModal());
      root.querySelector('[data-confirm="yes"]').addEventListener('click', () => { activeConfirmResolver = null; closeModal(); resolve(true); });
    });
  });
}

document.querySelector('#modal-close')?.addEventListener('click', closeModal);
backdrop?.addEventListener('click', event => { if (event.target === backdrop) closeModal(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !backdrop.hidden) closeModal();
});
