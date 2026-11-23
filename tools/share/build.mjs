// Share images for every page: a 1200×630 card per page in images/share/,
// and the Open Graph / Twitter tags that point to it.
//
//   npm run share                 every page
//   npm run share -- projects/drips/index.html   just these pages
//
// Each card is made from the page's own lead image (or its video poster):
// a photo or screenshot close to the card's shape fills it; anything else
// (transparent collages, posters, tall or very wide images) sits whole on a
// background matched to the image's own edge color. Pages with several
// portrait images (posters, books) get a row of them. Pages with no images
// get a pink title card in the site's type.
//
// Tags go between <!-- share --> and <!-- /share --> in each page's <head>,
// so running this again replaces them. Pages that already have their own
// og:image outside those markers (the home page) are left alone.
// Needs Google Chrome installed (Playwright drives it).
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const SITE = 'https://www.brandonoxendine.com';
const OUT = 'images/share';
const W = 1200;
const H = 630;
const SKIP = new Set(['404.html']);

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter((f) => f && !f.startsWith('includes/') && !SKIP.has(f));

const decode = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&amp;/g, '&')
  .replace(/&rsquo;/g, '’').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function urlPath(file) {
  if (file === 'index.html') return '/';
  return '/' + file.replace(/index\.html$/, '').replace(/\.html$/, '');
}

function read(src, file) {
  const head = (src.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i) || [])[1] || '';
  const title = decode(((head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '').trim().replace(/\s+/g, ' '));
  const desc = decode((head.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || [])[1] || '');
  const canonical = (head.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1];
  const main = (src.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) || [])[1] || src;
  const media = [];
  for (const m of main.matchAll(/<img\b([^>]*)>|<video\b([^>]*)>/gi)) {
    const a = m[1] ?? m[2];
    const src = (a.match(/\s(?:data-src|src|poster)="([^"]+)"/) || [])[1];
    if (!src || /^https?:|^data:|\.svg($|\?)/i.test(src)) continue;
    const w = +(a.match(/\swidth="(\d+)"/) || [])[1] || 0;
    const h = +(a.match(/\sheight="(\d+)"/) || [])[1] || 0;
    media.push({ src: src.split('?')[0], w, h });
  }
  // A short label for the title card: the page title without the byline.
  const label = title.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/\s*(by|—|–|-|\||•)?\s*Brandon Oxendine.*$/i, '').trim() || 'Brandon Oxendine';
  return { title: title || 'Brandon Oxendine', desc, canonical: canonical || SITE + urlPath(file), media, label };
}

const exists = async (p) => fs.access(p).then(() => true, () => false);

const card = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Maxi; src: url("file://${ROOT}/fonts/ABCMaxiRoundVariable.woff2"); }
html, body { margin: 0; }
.c { width: ${W}px; height: ${H}px; position: relative; overflow: hidden; background: var(--bg, #000); display: flex; align-items: center; justify-content: center; gap: 24px; }
.cover { width: 100%; height: 100%; object-fit: cover; }
.contain { max-width: calc(100% - 96px); max-height: calc(100% - 96px); object-fit: contain; }
.row img { height: calc(100% - 96px); width: auto; max-width: 260px; object-fit: contain; border-radius: 4px; }
.title { background: #000; padding: 24px; box-sizing: border-box; }
.panel { width: 100%; height: 100%; box-sizing: border-box; border-radius: 64px; background: hotpink; display: flex; flex-direction: column; justify-content: space-between; padding: 72px 80px; font-family: Maxi, sans-serif; color: #000; }
.panel h1 { margin: 0; line-height: 1; letter-spacing: -0.02em; font-weight: 500; text-wrap: balance; }
.panel p { margin: 0; font-size: 32px; }
</style></head><body>${body}</body></html>`;

const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await fs.mkdir(path.join(ROOT, OUT), { recursive: true });
// Pages are loaded from a file:// URL so they're allowed to load local images.
const SCRATCH = path.join(ROOT, OUT, '.render.html');
const show = async (html) => {
  await fs.writeFile(SCRATCH, html);
  await page.goto('file://' + SCRATCH, { waitUntil: 'load' });
};

// What an image looks like: its real size, whether it has transparency, and
// the color of its edges (for letterboxing).
async function inspect(file) {
  await show(`<img id=i src="file://${file}">`);
  return page.evaluate(async () => {
    const img = document.getElementById('i');
    await img.decode().catch(() => {});
    if (!img.naturalWidth) return null;
    const c = document.createElement('canvas');
    const s = 64;
    c.width = c.height = s;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, s, s);
    const d = x.getImageData(0, 0, s, s).data;
    let alpha = false;
    const edge = [0, 0, 0];
    let n = 0;
    for (let i = 0; i < s; i++) {
      for (const [px, py] of [[i, 0], [i, s - 1], [0, i], [s - 1, i]]) {
        const o = (py * s + px) * 4;
        if (d[o + 3] < 250) alpha = true;
        edge[0] += d[o]; edge[1] += d[o + 1]; edge[2] += d[o + 2]; n++;
      }
    }
    for (let o = 3; o < d.length && !alpha; o += 4) if (d[o] < 250) alpha = true;
    const [r, g, b] = edge.map((v) => Math.round(v / n));
    return { w: img.naturalWidth, h: img.naturalHeight, alpha, edge: `rgb(${r} ${g} ${b})` };
  });
}

let made = 0;
for (const file of files) {
  const abs = path.join(ROOT, file);
  let src = await fs.readFile(abs, 'utf8');
  if (/property="og:image"/.test(src.replace(/<!-- share -->[\s\S]*?<!-- \/share -->/, ''))) continue;
  const info = read(src, file);

  // The lead image: the first one big enough to carry a card.
  const found = [];
  for (const m of info.media) {
    const f = m.src.startsWith('/') ? path.join(ROOT, decodeURIComponent(m.src)) : path.join(path.dirname(abs), decodeURIComponent(m.src));
    if (!(await exists(f))) continue;
    const meta = await inspect(f);
    if (!meta || Math.max(meta.w, meta.h) < 300) continue;
    found.push({ ...m, ...meta, file: f });
    if (found.length >= 6) break;
  }

  let body;
  const lead = found[0];
  const portraits = found.filter((m) => m.w / m.h < 0.9);
  if (!lead) {
    const size = info.label.length > 28 ? 72 : info.label.length > 14 ? 96 : 128;
    body = `<div class="c title"><div class="panel"><h1 style="font-size:${size}px">${attr(info.label)}</h1><p>Brandon Oxendine</p></div></div>`;
  } else if (portraits.length >= 3 && lead.w / lead.h < 0.9) {
    body = `<div class="c row" style="--bg:#000">${portraits.slice(0, 4).map((m) => `<img src="file://${m.file}">`).join('')}</div>`;
  } else {
    const ratio = lead.w / lead.h;
    // Photos fill the card even if that crops a little; screenshots and
    // graphics only when they're already close to its shape, so nothing
    // important (a wordmark, a UI edge) gets cut off.
    const photo = /\.jpe?g$/i.test(lead.file);
    const fill = !lead.alpha && (photo ? ratio >= 1.2 && ratio <= 2.6 : ratio >= 1.75 && ratio <= 2.1);
    body = fill
      ? `<div class="c"><img class="cover" src="file://${lead.file}"></div>`
      : `<div class="c" style="--bg:${lead.alpha ? '#000' : lead.edge}"><img class="contain" src="file://${lead.file}"></div>`;
  }

  const slug = (file === 'index.html' ? 'home' : file.replace(/\/?index\.html$/, '').replace(/\.html$/, '')).replace(/[^\w-]+/g, '-');
  const tmp = path.join(ROOT, OUT, `${slug}.tmp.jpg`);
  await show(card(body));
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map((i) => i.decode().catch(() => {}))]));
  await page.screenshot({ path: tmp, type: 'jpeg', quality: 86 });
  const hash = execFileSync('shasum', ['-a', '256', tmp], { encoding: 'utf8' }).slice(0, 8);
  const name = `${slug}-${hash}.jpg`;
  // Drop this page's previous card, if any.
  for (const old of await fs.readdir(path.join(ROOT, OUT))) {
    if (old.startsWith(slug + '-') && old !== name && /^[\w-]+-[0-9a-f]{8}\.jpg$/.test(old) && old.slice(0, -13) === slug) {
      await fs.unlink(path.join(ROOT, OUT, old));
    }
  }
  await fs.rename(tmp, path.join(ROOT, OUT, name));

  const image = `${SITE}/${OUT}/${name}`;
  const tags = [
    '<!-- share -->',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Brandon Oxendine" />`,
    `<meta property="og:title" content="${attr(info.title)}" />`,
    info.desc && `<meta property="og:description" content="${attr(info.desc)}" />`,
    `<meta property="og:url" content="${attr(info.canonical)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="${W}" />`,
    `<meta property="og:image:height" content="${H}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:image" content="${image}" />`,
    '<!-- /share -->',
  ].filter(Boolean);

  const indent = (src.match(/\n([ \t]*)<title>/) || [])[1] ?? '    ';
  const block = tags.map((t) => indent + t).join('\n');
  if (/<!-- share -->[\s\S]*?<!-- \/share -->/.test(src)) {
    src = src.replace(/[ \t]*<!-- share -->[\s\S]*?<!-- \/share -->/, block);
  } else {
    src = src.replace(/(\n[ \t]*)<\/head>/i, `\n${block}$1</head>`);
  }
  await fs.writeFile(abs, src);
  made++;
  console.log(`${file}  →  ${name}`);
}

await browser.close();
await fs.rm(SCRATCH, { force: true });
console.log(`\n${made} share images.`);
