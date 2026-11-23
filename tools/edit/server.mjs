// Local edit mode: serves the site like GitHub Pages does, and lets you edit
// text right on the page. Every text block (paragraphs, headings, captions,
// list items) gets a numbered data-edit attribute on the way out; the editor
// script posts changed blocks back here and they're written into the HTML
// file in place, leaving the rest of the file untouched.
//
//   npm run edit            → http://localhost:4000
//   PORT=5000 npm run edit
//
// Only listens on 127.0.0.1. Nothing here is deployed behaviour.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The site served is the current directory (npm run edit runs from the repo root),
// so the script can also be pointed at another checkout: cd there and run it.
const ROOT = path.resolve(process.cwd());
const EDITOR = fileURLToPath(new URL('./editor.js', import.meta.url));
const PORT = Number(process.env.PORT) || 4000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
  '.gpx': 'application/gpx+xml', '.geojson': 'application/geo+json',
};

// ---------- finding text blocks in the source ----------

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption', 'li', 'dt', 'dd', 'td', 'th', 'caption', 'blockquote']);
const TOKEN = /<!--[\s\S]*?-->|<(script|style|template|textarea)\b[\s\S]*?<\/\1\s*>|<(\/?)([a-zA-Z][\w-]*)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;

// Every closed text block in the <body>, in source order, with the offsets
// of its opening tag and its contents.
function scan(src) {
  const bodyStart = src.search(/<body\b/i);
  if (bodyStart < 0) return [];
  const blocks = [];
  const open = [];
  TOKEN.lastIndex = bodyStart;
  let m;
  while ((m = TOKEN.exec(src))) {
    const name = m[3]?.toLowerCase();
    if (!name || !BLOCKS.has(name)) continue;
    if (!m[2]) {
      open.push({ name, tagStart: m.index, tagEnd: m.index + m[0].length });
    } else {
      for (let i = open.length - 1; i >= 0; i--) {
        if (open[i].name !== name) continue;
        const b = open[i];
        open.length = i;
        blocks.push({ ...b, start: b.tagEnd, end: m.index });
        break;
      }
    }
  }
  return blocks.sort((a, b) => a.tagStart - b.tagStart);
}

function annotate(src) {
  const blocks = scan(src);
  let out = src;
  // Back to front, so earlier offsets stay valid.
  for (let i = blocks.length - 1; i >= 0; i--) {
    const at = blocks[i].tagEnd - 1;
    out = out.slice(0, at) + ` data-edit="${i}"` + out.slice(at);
  }
  return out.replace(/<\/body>/i, '<script src="/__edit/editor.js"></script>\n</body>');
}

// ---------- comparing what the browser saw with what's on disk ----------

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®',
  trade: '™', rarr: '→', larr: '←', times: '×', middot: '·', bull: '•', eacute: 'é',
};
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (e, n) => ENTITIES[n.toLowerCase()] ?? e);
const text = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const loose = (s) => s.replace(/[^\p{L}\p{N}]/gu, '');

// ---------- files ----------

async function resolve(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return null;
  for (const candidate of [file, path.join(file, 'index.html'), file + '.html']) {
    try {
      if ((await fs.stat(candidate)).isFile()) return candidate;
    } catch {}
  }
  return null;
}

async function save(req, res) {
  let body = '';
  for await (const chunk of req) body += chunk;
  const { page, id, before, html } = JSON.parse(body);
  const file = await resolve(page);
  if (!file || !file.endsWith('.html')) return send(res, 404, { error: 'No HTML file for this page.' });

  const src = await fs.readFile(file, 'utf8');
  const block = scan(src)[id];
  if (!block) return send(res, 409, { error: 'This page changed on disk. Reload and try again.' });
  const current = src.slice(block.start, block.end);
  if (text(current) !== before && loose(text(current)) !== loose(before)) {
    return send(res, 409, { error: 'This page changed on disk. Reload and try again.' });
  }

  let next;
  if (!text(html) && !/<img\b/i.test(html)) {
    // Emptied out: remove the whole element, and its line if it had one.
    const closeEnd = src.indexOf('>', block.end) + 1;
    let from = block.tagStart;
    let to = closeEnd;
    const lineStart = src.lastIndexOf('\n', from - 1) + 1;
    if (!src.slice(lineStart, from).trim() && src[to] === '\n') { from = lineStart; to += 1; }
    next = src.slice(0, from) + src.slice(to);
  } else {
    // Keep the whitespace the block was wrapped in, so the file stays tidy.
    const lead = current.match(/^\s*/)[0];
    const trail = current.match(/\s*$/)[0];
    next = src.slice(0, block.start) + lead + html.trim() + trail + src.slice(block.end);
  }
  await fs.writeFile(file, next);
  console.log(`saved  ${path.relative(ROOT, file)}  <${block.name}> #${id}`);
  send(res, 200, { file: path.relative(ROOT, file), removed: !text(html) && !/<img\b/i.test(html) });
}

function send(res, status, json) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(json));
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname === '/__edit/save') return await save(req, res);
    if (url.pathname === '/__edit/editor.js') {
      res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-store' });
      return res.end(await fs.readFile(EDITOR));
    }

    // A directory without a trailing slash redirects, like GitHub Pages, so
    // relative links resolve the same way.
    const file = await resolve(url.pathname);
    if (file && path.basename(file) === 'index.html' && !url.pathname.endsWith('/') && !url.pathname.endsWith('.html')) {
      res.writeHead(301, { location: url.pathname + '/' + url.search });
      return res.end();
    }
    const target = file ?? path.join(ROOT, '404.html');
    const ext = path.extname(target).toLowerCase();
    let data = await fs.readFile(target);
    if (ext === '.html') data = annotate(data.toString('utf8'));
    res.writeHead(file ? 200 : 404, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch (error) {
    console.error(error);
    send(res, 500, { error: String(error.message || error) });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Edit mode: http://localhost:${PORT}  (press E on any page, or use the Edit button)`);
});
