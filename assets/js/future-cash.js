// The night sky from myfuture.cash, behind the Future Cash case study:
// three depths of stars that twinkle, drift very slowly and lag behind the
// scroll by different amounts, plus dust motes around the edges.
(() => {
  const sky = document.querySelector('.fc-sky');
  const cv = sky && sky.querySelector('.stars');
  if (!cv) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = cv.getContext('2d');
  const tints = ['#ffffff', '#ffffff', '#ffffff', '#cfd4ff', '#b9b0ff', '#ffe9c9', '#c9e4ff'];
  // depth: parallax per scrolled pixel, drift in px/s, size, brightness
  const layers = [
    { n: 260, par: 0.015, drift: 1.2, size: [0.4, 0.9], a: [0.15, 0.45] },
    { n: 110, par: 0.04, drift: 2.2, size: [0.7, 1.3], a: [0.3, 0.7] },
    { n: 28, par: 0.09, drift: 3.5, size: [1.1, 1.9], a: [0.55, 0.95], glow: true },
  ];
  let W, H, stars = [], last = 0, lastDraw = 0;
  // Pre-drawn glow sprites, one per tint (much cheaper than shadowBlur).
  const glow = Object.fromEntries([...new Set(tints)].map((c) => {
    const g = document.createElement('canvas');
    g.width = g.height = 32;
    const x = g.getContext('2d');
    const r = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, c);
    r.addColorStop(0.25, c + '88');
    r.addColorStop(1, c + '00');
    x.fillStyle = r;
    x.fillRect(0, 0, 32, 32);
    return [c, g];
  }));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = sky.getBoundingClientRect();
    W = r.width;
    H = r.height;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const k = Math.min(1, (W * H) / (1440 * 1100));
    stars = layers.flatMap((L, d) => Array.from({ length: Math.round(L.n * Math.max(k, 0.35)) }, () => ({
      x: Math.random() * W, y: Math.random() * H, d, r: rnd(...L.size), a: rnd(...L.a),
      tw: rnd(0.4, 1.6), ph: Math.random() * 7, c: tints[Math.floor(Math.random() * tints.length)],
    })));
  }

  function frame(t) {
    if (!still) {
      requestAnimationFrame(frame);
      if (t - lastDraw < 32) return;
      lastDraw = t;
    }
    const dt = last ? Math.min(t - last, 100) : 16;
    last = t;
    const sy = scrollY;
    sky.style.setProperty('--sy', sy);
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const L = layers[s.d];
      if (!still) s.x -= (L.drift * dt / 1000) * 0.25;
      if (s.x < -4) s.x += W + 8;
      let y = (s.y - sy * L.par) % H;
      if (y < 0) y += H;
      ctx.globalAlpha = still ? s.a : s.a * (0.65 + 0.35 * Math.sin((t / 1000) * s.tw + s.ph));
      ctx.fillStyle = s.c;
      if (L.glow) {
        const g = s.r * 7;
        ctx.drawImage(glow[s.c], s.x - g / 2, y - g / 2, g, g);
      } else {
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, 6.283);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  size();
  addEventListener('resize', () => { size(); if (still) frame(0); });
  if (still) {
    frame(0);
    addEventListener('scroll', () => frame(0), { passive: true });
  } else {
    requestAnimationFrame(frame);
  }

  // Dust motes, kept to the edges of the window (fewer on phones).
  const count = innerWidth < 700 ? 24 : 70;
  const motes = document.createDocumentFragment();
  for (let made = 0; made < count;) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    if (x > 18 && x < 82 && y > 8 && y < 92) continue;
    const m = document.createElement('span');
    m.className = 'mote';
    m.style.cssText = `left:${x}%;top:${y}%;--s:${(1.5 + Math.random() * 2.5).toFixed(1)}px;--d:${(2.5 + Math.random() * 4).toFixed(1)}s;--delay:-${(Math.random() * 6).toFixed(1)}s`;
    motes.appendChild(m);
    made++;
  }
  sky.appendChild(motes);
})();
