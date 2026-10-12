(() => {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.hidden = true;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="lightbox-toggle compare-toggle" role="group" aria-label="Show version" hidden>
      <button type="button" data-version="before" aria-pressed="false">Before</button>
      <button type="button" data-version="after" aria-pressed="true">After</button>
    </div>
    <button type="button" class="lightbox-close" aria-label="Close">Close</button>
    <img class="lightbox-image" alt="" />`;
  document.body.appendChild(overlay);

  const image = overlay.querySelector('.lightbox-image');
  const toggle = overlay.querySelector('.lightbox-toggle');
  const toggleButtons = toggle.querySelectorAll('button');
  let versions;
  let opener;

  const show = (version) => {
    const source = versions[version];
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    toggleButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.version === version));
    });
  };

  const open = (img) => {
    opener = img;
    const compare = img.closest('.compare');
    if (compare) {
      versions = {
        before: compare.querySelector('.compare-layer[data-version="before"] img'),
        after: compare.querySelector('.compare-layer[data-version="after"] img'),
      };
      toggle.hidden = false;
      show(compare.dataset.show || 'after');
    } else {
      versions = { single: img };
      toggle.hidden = true;
      show('single');
    }
    overlay.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    overlay.querySelector('.lightbox-close').focus();
  };

  const close = () => {
    overlay.hidden = true;
    image.removeAttribute('src');
    document.documentElement.classList.remove('lightbox-open');
    if (opener) opener.focus();
  };

  toggleButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      show(button.dataset.version);
    });
  });
  overlay.addEventListener('click', (event) => {
    if (event.target === image && versions.before) {
      show(image.src === (versions.after.currentSrc || versions.after.src) ? 'before' : 'after');
      return;
    }
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (overlay.hidden) return;
    if (event.key === 'Escape') close();
    if (versions.before && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      show(event.key === 'ArrowLeft' ? 'before' : 'after');
    }
  });

  // Anything inside [data-no-zoom] (icon sheets, live demos) stays put.
  document.querySelectorAll('main img').forEach((img) => {
    if (img.closest('[data-no-zoom]')) return;
    // Images that link somewhere else keep their link; ones that only link to
    // their own file zoom instead of navigating away.
    const link = img.closest('a[href]');
    if (link && !/\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i.test(link.getAttribute('href'))) return;
    img.classList.add('zoomable');
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.addEventListener('click', (event) => {
      event.preventDefault();
      open(img);
    });
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(img);
      }
    });
  });
})();
