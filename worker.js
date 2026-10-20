import { onRequestPost } from './functions/api/ai/chat/completions.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
