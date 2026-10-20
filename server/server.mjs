// Static file server + CORS/HTTP→HTTPS stream proxy for the IPTV web app.
//   node server/server.mjs            -> serves ./dist and /proxy on PORT (default 8787)
//   PROXY_ONLY=1 node server/server.mjs -> only /proxy (use with `expo start --web`)
// Env: PORT, DIST (default ./dist), ALLOW_ORIGIN (default *), ALLOW_PRIVATE=1 (disable SSRF guard; local testing only)
import http from 'node:http';
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 8787);
const DIST = path.resolve(process.env.DIST || 'dist');
const ORIGIN = process.env.ALLOW_ORIGIN || '*';
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.map': 'application/json' };

const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
};

function isPrivate(ip) {
  if (process.env.ALLOW_PRIVATE) return false;
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:127.') || l.startsWith('::ffff:10.') || l.startsWith('::ffff:192.168.');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function assertPublic(u) {
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error('Blocked address');
}

function proxied(abs, base, ua, ref) {
  const q = new URLSearchParams({ url: abs });
  if (ua) q.set('ua', ua);
  if (ref) q.set('ref', ref);
  return `${base}/proxy?${q}`;
}

function rewritePlaylist(text, upstream, base, ua, ref) {
  const abs = (u) => { try { return new URL(u, upstream).href; } catch { return null; } };
  return text
    .split(/\r?\n/)
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        // URI="..." attributes (keys, init segments, renditions, maps)
        return line.replace(/URI="([^"]+)"/g, (m, u) => {
          const a = abs(u);
          return a ? `URI="${proxied(a, base, ua, ref)}"` : m;
        });
      }
      const a = abs(t);
      return a ? proxied(a, base, ua, ref) : line;
    })
    .join('\n');
}

async function handleProxy(req, res, url) {
  const target = url.searchParams.get('url');
  const ua = url.searchParams.get('ua') || '';
  const ref = url.searchParams.get('ref') || '';
  const fail = (code, msg) => { res.writeHead(code, { ...cors, 'Content-Type': 'text/plain' }); res.end(msg); };
  if (!target) return fail(400, 'Missing url');
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const base = `${proto}://${req.headers.host}`;

  let current;
  try { current = new URL(target); } catch { return fail(400, 'Invalid url'); }
  const headers = { 'User-Agent': ua || DEFAULT_UA, Accept: '*/*' };
  if (ref) { headers.Referer = ref; try { headers.Origin = new URL(ref).origin; } catch {} }
  if (req.headers.range) headers.Range = req.headers.range;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  res.on('close', () => { clearTimeout(timer); ctl.abort(); });
  try {
    let upstream;
    for (let hop = 0; hop < 6; hop++) {
      await assertPublic(current);
      upstream = await fetch(current, { headers, redirect: 'manual', signal: ctl.signal });
      const loc = upstream.headers.get('location');
      if (upstream.status >= 300 && upstream.status < 400 && loc) { current = new URL(loc, current); continue; }
      break;
    }
    if (upstream.status >= 300 && upstream.status < 400) return fail(502, 'Too many redirects');
    clearTimeout(timer);

    const ctype = upstream.headers.get('content-type') || '';
    const looksPlaylist = /mpegurl/i.test(ctype) || /\.m3u8?(\?|$)/i.test(current.pathname + current.search);
    if (looksPlaylist && upstream.ok) {
      const text = await upstream.text();
      if (text.trimStart().startsWith('#EXTM3U')) {
        res.writeHead(200, { ...cors, 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'no-store' });
        return res.end(rewritePlaylist(text, current, base, ua, ref));
      }
      res.writeHead(upstream.status, { ...cors, 'Content-Type': ctype || 'application/octet-stream' });
      return res.end(text);
    }
    const out = { ...cors, 'Content-Type': ctype || 'application/octet-stream' };
    for (const h of ['content-length', 'content-range', 'accept-ranges']) { const v = upstream.headers.get(h); if (v) out[h] = v; }
    res.writeHead(upstream.status, out);
    if (!upstream.body || req.method === 'HEAD') return res.end();
    Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    if (!res.headersSent) fail(e.message === 'Blocked address' ? 403 : 502, e.name === 'AbortError' ? 'Upstream timed out' : `Upstream error: ${e.message}`);
    else res.destroy();
  }
}

async function handleStatic(req, res, pathname) {
  let file = path.join(DIST, decodeURIComponent(pathname));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  let stat = await fs.stat(file).catch(() => null);
  if (stat?.isDirectory()) { file = path.join(file, 'index.html'); stat = await fs.stat(file).catch(() => null); }
  if (!stat) { file = path.join(DIST, 'index.html'); stat = await fs.stat(file).catch(() => null); } // SPA fallback
  if (!stat) { res.writeHead(404); return res.end('dist/ not found. Run: npm run build:web'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': file.includes('_expo') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (url.pathname === '/proxy/health') { res.writeHead(200, { ...cors, 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url.pathname === '/proxy') return handleProxy(req, res, url);
  if (process.env.PROXY_ONLY) { res.writeHead(404, cors); return res.end(); }
  return handleStatic(req, res, url.pathname).catch(() => { res.writeHead(500); res.end(); });
}).listen(PORT, () => console.log(`IPTV server on http://localhost:${PORT} (${process.env.PROXY_ONLY ? 'proxy only' : 'static + proxy'})`));
