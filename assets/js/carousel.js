(() => {
  const carousels = document.querySelectorAll('[data-carousel]');
  if (!carousels.length) return;

  const setupCarousel = (carousel) => {
    const images = Array.from(carousel.querySelectorAll('img'));
    if (!images.length) return;

    let index = 0;

    const setActive = (nextIndex) => {
      images.forEach((img, i) => {
        img.classList.toggle('active', i === nextIndex);
      });
      index = nextIndex;
    };

    setActive(0);

    setInterval(() => {
      setActive((index + 1) % images.length);
    }, 3000);
  };

  carousels.forEach(setupCarousel);
})();
