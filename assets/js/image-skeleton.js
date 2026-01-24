(() => {
  const selector = 'img';
  const images = Array.from(document.querySelectorAll(selector));
  if (!images.length) return;

  const shouldSkip = (img) => {
    if (!img.getAttribute('src')) return true;
    if (img.dataset.noSkeleton !== undefined) return true;
    if (img.classList.contains('no-skeleton')) return true;
    if (img.closest('.image-frame')) return true;
    return false;
  };

  const markLoaded = (frame) => {
    frame.classList.add('is-loaded');
    frame.classList.remove('is-loading');
  };

  const markError = (frame) => {
    frame.classList.add('is-error');
    frame.classList.remove('is-loading');
  };

  images.forEach((img) => {
    if (shouldSkip(img)) return;

    const frame = document.createElement('span');
    frame.className = 'image-frame is-loading';

    const parent = img.parentNode;
    if (!parent) return;

    parent.insertBefore(frame, img);
    frame.appendChild(img);

    img.classList.add('image-asset');

    if (img.complete && img.naturalWidth > 0) {
      markLoaded(frame);
      return;
    }

    img.addEventListener(
      'load',
      () => {
        markLoaded(frame);
      },
      { once: true }
    );

    img.addEventListener(
      'error',
      () => {
        markError(frame);
      },
      { once: true }
    );
  });
})();
