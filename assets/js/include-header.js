(() => {
  const target = document.getElementById('site-header');
  if (!target) return;
  fetch('/includes/header.html')
    .then((response) => {
      if (!response.ok) throw new Error('Failed to load header');
      return response.text();
    })
    .then((html) => {
      target.innerHTML = html;
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      const links = target.querySelectorAll('nav a');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href) return;
        const normalized = href.replace(/\/$/, '') || '/';
        const isWriting = normalized === '/writing' && path.startsWith('/writing');
        const isInfo = normalized === '/info' && path.startsWith('/info');
        const isWork = normalized === '/' && (path === '/' || path === '/index.html');
        if (normalized === path || isWriting || isInfo || isWork) {
          link.setAttribute('aria-current', 'page');
        }
      });
    })
    .catch((error) => {
      console.error(error);
    });
})();
