(() => {
  // A port of fuzzco.com's 2015 homepage feed (_home.js): ten copies of the
  // curated section, an auto-scroll of 1px every 30ms, direction set by the
  // visitor's own scrolling, and sections recycled at both ends so it never
  // runs out.
  const scroller = document.querySelector('.fz-scroller');
  if (!scroller) return;
  const win = scroller.closest('.fz-window');
  const feed = scroller.querySelector('.fz-feed');
  const template = feed.querySelector('template.fz-section');

  const newSection = () => {
    const section = document.createElement('div');
    section.className = 'fz-sec';
    section.appendChild(template.content.cloneNode(true));
    return section;
  };
  for (let i = 0; i < 10; i++) feed.appendChild(newSection());

  const sections = () => feed.querySelectorAll('.fz-sec');
  const page = {
    goingDown: false, // as in the original: true scrolls *up*
    stopScrolling: false,
    startScrollTimer: null,
    prevScroll: null,
    scrollSpeed: 1,
    scrollInterval: 30,
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = !reduced;
  let visible = false;

  const setup = () => {
    const middle = sections()[5];
    scroller.scrollTop = middle.offsetTop - feed.offsetTop;
    page.prevScroll = scroller.scrollTop;
  };

  const autoScroll = () => {
    if (page.stopScrolling || !playing || !visible) return;
    scroller.scrollTop += page.goingDown ? -page.scrollSpeed : page.scrollSpeed;
  };

  const watchScroll = () => {
    const scrollTop = scroller.scrollTop;
    autoScroll();
    if (page.prevScroll + 2 < scrollTop || page.prevScroll - 2 > scrollTop) {
      page.stopScrolling = true;
      clearTimeout(page.startScrollTimer);
      page.startScrollTimer = setTimeout(() => {
        page.stopScrolling = false;
      }, 50);
      if (page.prevScroll + 30 < scrollTop) page.goingDown = false;
      if (page.prevScroll - 30 > scrollTop) page.goingDown = true;
    }
    page.prevScroll = scrollTop;
  };

  const watchFeed = () => {
    const all = sections();
    const first = all[0];
    const last = all[all.length - 1];
    const scrollTop = scroller.scrollTop;
    const topReloadPoint = first.offsetHeight;
    const bottomReloadPoint = scroller.scrollHeight - scroller.clientHeight - last.offsetHeight;
    if (scrollTop <= topReloadPoint) {
      const added = newSection();
      feed.insertBefore(added, first);
      last.remove();
      const next = scrollTop + added.offsetHeight;
      page.prevScroll = next;
      scroller.scrollTop = next;
    } else if (scrollTop >= bottomReloadPoint) {
      const height = first.offsetHeight;
      first.remove();
      feed.appendChild(newSection());
      const next = scrollTop - height;
      page.prevScroll = next;
      scroller.scrollTop = next;
    }
  };

  setup();
  window.addEventListener('resize', () => {
    page.prevScroll = scroller.scrollTop;
  });
  setInterval(watchScroll, page.scrollInterval);
  setInterval(watchFeed, page.scrollInterval);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }).observe(win);
  } else {
    visible = true;
  }

  const playButton = document.querySelector('[data-fz-play]');
  const renderPlay = () => {
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.textContent = playing ? 'Auto-scroll on' : 'Auto-scroll off';
  };
  playButton.addEventListener('click', () => {
    playing = !playing;
    renderPlay();
  });
  renderPlay();

  const gridButton = document.querySelector('[data-fz-grid]');
  gridButton.addEventListener('click', () => {
    const on = win.classList.toggle('show-grid');
    gridButton.setAttribute('aria-pressed', String(on));
    gridButton.textContent = on ? 'Hide grid' : 'Show grid';
  });
})();
