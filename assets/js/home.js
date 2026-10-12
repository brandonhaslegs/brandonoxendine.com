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
