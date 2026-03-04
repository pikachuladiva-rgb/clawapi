import http from 'http';
import https from 'https';
import { URL } from 'url';

const DUMMY_COUNT_TOKENS = JSON.stringify({ input_tokens: 1000 });

export function startApiProxy(upstream: string, port = 18080): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      console.error(`[api-proxy] ${req.method} ${req.url}`);

      if (req.url?.includes('/count_tokens')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(DUMMY_COUNT_TOKENS);
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        console.error(`[api-proxy] Request body length: ${body.length}`);
        const target = new URL(req.url || '/', upstream);
        const mod = target.protocol === 'https:' ? https : http;

        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (v && k !== 'host' && k !== 'content-length') {
            headers[k] = Array.isArray(v) ? v[0] : v;
          }
        }
        headers['content-length'] = Buffer.byteLength(body).toString();

        const proxyReq = mod.request(target, { method: req.method, headers }, (proxyRes) => {
          console.error(`[api-proxy] Response status: ${proxyRes.statusCode}`);
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        });
        proxyReq.on('error', (err) => {
          console.error(`[api-proxy] Proxy error: ${err}`);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: String(err) } }));
        });
        proxyReq.end(body);
      });
    });

    server.listen(port, '127.0.0.1', () => {
      console.error(`[api-proxy] Listening on 127.0.0.1:${port}, upstream: ${upstream}`);
      resolve(port);
    });
  });
}
