(() => {
  // Highlight the chapter currently in view.
  const links = [...document.querySelectorAll('.ds-toc a[href^="#"]')];
  const chapters = links
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if (chapters.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            const active = link.getAttribute('href') === `#${entry.target.id}`;
            link.setAttribute('aria-current', String(active));
            if (active) link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          });
        });
      },
      { rootMargin: '-30% 0px -60% 0px' },
    );
    chapters.forEach((chapter) => observer.observe(chapter));
  }

  // Theme switchers: set data-theme on the target specimen.
  document.querySelectorAll('.ds-switch').forEach((group) => {
    const target = document.getElementById(group.dataset.target);
    if (!target) return;
    const buttons = group.querySelectorAll('button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        target.dataset.theme = button.dataset.theme;
        buttons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });
  });
})();
