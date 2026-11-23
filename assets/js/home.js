(() => {
  // Cycle through every piece in a collection, one per second, once the
  // tile is on screen. Reduced motion keeps the first image.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-cycle]').forEach((cycle) => {
    const images = [...cycle.querySelectorAll('img')];
    if (reduced || images.length < 2) return;
    let index = 0;
    let timer = null;
    const load = () => images.forEach((img) => {
      if (img.dataset.src) {
        img.src = img.dataset.src;
        delete img.dataset.src;
      }
    });
    const step = () => {
      images[index].classList.remove('is-active');
      index = (index + 1) % images.length;
      images[index].classList.add('is-active');
    };
    new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !timer) {
        load();
        timer = setInterval(step, 1000);
      } else if (!visible && timer) {
        clearInterval(timer);
        timer = null;
      }
    }).observe(cycle);
  });
})();

(() => {
  // Hero slideshow: one slide per visual language, 5s each. Only one slide
  // is ever .is-active, so they can't stack. Cycling starts once every
  // slide's font and icons have loaded, so nothing swaps in half-drawn;
  // until then (or without this script, or with reduced motion) the first
  // slide stays. Hovering or focusing the panel holds the current slide.
  const panel = document.querySelector('.hero-panel');
  if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const slides = [...panel.querySelectorAll('.hero-slide')];
  if (slides.length < 2) return;

  const SLIDE = 5000;
  const LEAVE = 4400; // icons start shrinking (0.3s + up to 0.3s stagger)
  const SHIFT = 4700; // panel color and corners move to the next slide

  const fonts = [...new Set(slides.map((slide) => {
    const style = getComputedStyle(slide.querySelector('.hero-headline'));
    return `${style.fontWeight} 40px ${style.fontFamily}`;
  }))];
  const accents = [...new Set(slides.map((slide) => {
    const em = slide.querySelector('.hero-headline em');
    return em ? `${getComputedStyle(em).fontWeight} 40px ${getComputedStyle(em).fontFamily}` : null;
  }).filter(Boolean))];
  const icons = [...new Set([...panel.querySelectorAll('.hero-icon')].map((icon) =>
    (icon.style.getPropertyValue('--src').match(/url\((.*)\)/) || [])[1]).filter(Boolean))];
  const loadImage = (src) => new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = done;
    img.src = src;
  });
  const ready = Promise.all([
    ...[...fonts, ...accents].map((font) => document.fonts.load(font).catch(() => {})),
    ...icons.map(loadImage),
  ]);

  let index = 0;
  let elapsed = 0;
  let last = 0;
  let stage = 0; // 0 showing, 1 leaving, 2 shifted
  const held = () => panel.matches(':hover, :focus-within') || document.hidden;

  const tick = (now) => {
    if (!held()) elapsed += now - last;
    last = now;
    const next = (index + 1) % slides.length;
    if (stage === 0 && elapsed >= LEAVE) {
      slides[index].classList.add('is-leaving');
      stage = 1;
    }
    if (stage === 1 && elapsed >= SHIFT) {
      panel.dataset.skin = slides[next].dataset.skin;
      stage = 2;
    }
    if (elapsed >= SLIDE) {
      slides[index].classList.remove('is-active', 'is-leaving');
      slides[next].classList.add('is-active');
      index = next;
      elapsed = 0;
      stage = 0;
    }
    requestAnimationFrame(tick);
  };

  ready.then(() => {
    panel.dataset.skin = slides[0].dataset.skin;
    panel.classList.add('is-cycling');
    // Restart the first slide's icons so they pop in like every other slide.
    slides[0].classList.remove('is-active');
    void slides[0].offsetWidth;
    slides[0].classList.add('is-active');
    requestAnimationFrame((now) => {
      last = now;
      requestAnimationFrame(tick);
    });
  });
})();
