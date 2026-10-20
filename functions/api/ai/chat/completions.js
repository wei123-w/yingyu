const MAX_REQUEST_BYTES = 25 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 90_000;

const ALLOWED_HOSTS = new Set([
  'api.groq.com',
  'generativelanguage.googleapis.com',
  'dashscope.aliyuncs.com',
  'api.deepseek.com',
  'openrouter.ai',
  'api.siliconflow.cn',
  'api.mistral.ai',
  'api.moonshot.cn',
  'api.moonshot.ai',
  'api.openai.com',
  'api.together.xyz',
]);

function jsonResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequestPost({ request }) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    return jsonResponse(403, '请求来源无效。');
  }

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse(413, 'AI 请求内容超过 25 MB。');
  }

  let input;
  try {
    const body = await request.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse(413, 'AI 请求内容为空或超过 25 MB。');
    }
    input = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return jsonResponse(400, 'AI 请求格式无效。');
  }

  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!apiKey || !input?.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    return jsonResponse(400, '请填写 API 密钥并提供有效的 AI 请求内容。');
  }

  let endpoint;
  try {
    endpoint = new URL(input.endpoint);
  } catch {
    return jsonResponse(400, 'AI 接口地址无效。');
  }
  if (endpoint.protocol !== 'https:' || (endpoint.port && endpoint.port !== '443') || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return jsonResponse(400, 'AI 接口必须使用不带参数的 HTTPS 地址。');
  }
  if (!ALLOWED_HOSTS.has(endpoint.hostname.toLowerCase())) {
    return jsonResponse(400, '当前云端版本不支持此 AI 服务商域名。');
  }
  if (!endpoint.pathname.replace(/\/+$/, '').endsWith('/chat/completions')) {
    return jsonResponse(400, '接口地址必须指向 Chat Completions 路径。');
  }

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input.payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const headers = new Headers({
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
    });
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return jsonResponse(504, '等待 AI 服务响应超过 90 秒，请稍后重试。');
    }
    return jsonResponse(502, '云端无法连接 AI 服务，请检查服务状态或网络。');
  }
}
