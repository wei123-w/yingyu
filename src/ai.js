/** 通过本机 Python 或云端 Pages Function 转发请求，避免网页跨域直连服务商接口。 */
export function requestAI(endpoint, apiKey, payload, options = {}) {
  return fetch('/api/ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, apiKey, payload }),
    ...options,
  });
}
