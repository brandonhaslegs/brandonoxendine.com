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
    video.preload = 'auto';
    const play = () => video.play().catch(() => {});
    if (video.readyState >= 4) play();
    else video.addEventListener('canplaythrough', play, { once: true });
    video.load();
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
