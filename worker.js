import { onRequestPost } from './functions/api/ai/chat/completions.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/speech') {
      if (request.method !== 'GET') {
        return new Response('仅支持 GET 请求。', {
          status: 405,
          headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
        });
      }

      const text = (url.searchParams.get('text') || '').trim();
      if (!text || text.length > 200) {
        return Response.json({ error: '朗读文本不能为空，且不能超过 200 个字符。' }, {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      if (!env.AI) {
        return Response.json({ error: '云端朗读尚未启用，请检查 Workers AI 绑定。' }, {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      try {
        const audio = await env.AI.run('@cf/myshell-ai/melotts', {
          prompt: text,
          lang: 'en',
        }, { returnRawResponse: true });
        const body = audio instanceof Response ? audio.body : audio;
        return new Response(body, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch (error) {
        console.error('云端语音生成失败：', error);
        return Response.json({ error: '云端语音生成失败，请检查 Workers AI 额度或稍后重试。' }, {
          status: 503,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
    }

    if (url.pathname === '/api/ai/chat/completions') {
      if (request.method !== 'POST') {
        return new Response('仅支持 POST 请求。', {
          status: 405,
          headers: { Allow: 'POST', 'Cache-Control': 'no-store' },
        });
      }
      return onRequestPost({ request });
    }

    return env.ASSETS.fetch(request);
  },
};
