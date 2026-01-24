(() => {
  const head = document.head;
  if (!head) return;

  const addLink = (rel, href, extra = {}) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = href;
    Object.entries(extra).forEach(([key, value]) => {
      link.setAttribute(key, value);
    });
    head.appendChild(link);
  };

  const addScript = (src, extra = {}) => {
    const script = document.createElement('script');
    script.src = src;
    Object.entries(extra).forEach(([key, value]) => {
      if (value === true) {
        script.setAttribute(key, '');
      } else {
        script.setAttribute(key, value);
      }
    });
    head.appendChild(script);
  };

  addLink('stylesheet', '/assets/css/reset.css');
  addLink('stylesheet', '/assets/css/site.css');
  addLink('icon', '/favicon.png');
  addLink('preconnect', 'https://fonts.googleapis.com');
  addLink('preconnect', 'https://fonts.gstatic.com', { crossorigin: '' });
  addLink(
    'stylesheet',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
  );
  addScript('/assets/js/image-skeleton.js', { defer: true });
})();
