(() => {
  const videos = document.querySelectorAll('video[data-autoplay]');
  if (!videos.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const start = (video) => {
    if (video.dataset.started) {
      video.play().catch(() => {});
      return;
    }
    video.dataset.started = 'true';
    // Pick the source here rather than trusting <source media>, which not
    // every browser honors, so phones get the smaller file.
    const sources = [...video.querySelectorAll('source')];
    if (sources.some((source) => source.media)) {
      const pick = sources.find(
        (source) => !source.media || window.matchMedia(source.media).matches
      );
      for (const source of sources) if (source !== pick) source.remove();
      video.load();
    }
    video.preload = 'auto';
    // Ask to play right away: phones often never fire canplaythrough, and
    // the browser starts playback on its own once enough has buffered. If
    // autoplay is blocked (Low Power Mode, data saver), show controls so a
    // tap can start it.
    video.play().catch((error) => {
      if (error.name === 'NotAllowedError') video.controls = true;
    });
  };

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) start(entry.target);
      else if (!entry.target.paused) entry.target.pause();
    }
  }, { rootMargin: '200px 0px' });

  for (const video of videos) {
    if (reduced) {
      video.controls = true;
      video.preload = 'metadata';
      continue;
    }
    observer.observe(video);
  }
})();
