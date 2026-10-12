(() => {
  // The category menu's second layer, with the same "menu aim" Grover
  // shipped: while the pointer heads diagonally toward the subcategories,
  // hovering other rows on the way doesn't switch the category.
  const menu = document.querySelector('.grv-menu');
  if (!menu) return;
  const rows = [...menu.querySelectorAll('.grv-menu-main a[data-cat]')];
  const subs = [...menu.querySelectorAll('.grv-sub')];
  const panel = menu.querySelector('.grv-sub-panel');
  const DELAY = 200;

  const open = (row) => {
    rows.forEach((r) => {
      if (r === row) r.setAttribute('aria-current', 'true');
      else r.removeAttribute('aria-current');
    });
    subs.forEach((sub) => (sub.hidden = sub.dataset.cat !== row.dataset.cat));
  };

  const points = [];
  menu.addEventListener('mousemove', (event) => {
    points.push({ x: event.clientX, y: event.clientY });
    if (points.length > 3) points.shift();
  });

  // True when the pointer is moving into the triangle between its last
  // position and the near edge of the subcategory panel.
  let lastChecked = null;
  const aiming = () => {
    const cur = points[points.length - 1];
    const prev = points[0];
    if (!cur || !prev || cur === prev) return false;
    if (lastChecked && lastChecked.x === cur.x && lastChecked.y === cur.y) return false;
    const rect = panel.getBoundingClientRect();
    if (rect.left <= cur.x || rect.top > menu.getBoundingClientRect().top + 1) return false;
    const slope = (a, b) => (b.y - a.y) / (b.x - a.x);
    const top = { x: rect.left, y: rect.top };
    const bottom = { x: rect.left, y: rect.bottom };
    return slope(cur, top) < slope(prev, top) && slope(cur, bottom) > slope(prev, bottom);
  };

  let timer;
  const attempt = (row) => {
    clearTimeout(timer);
    if (aiming()) {
      lastChecked = points[points.length - 1];
      timer = setTimeout(() => attempt(row), DELAY);
    } else {
      lastChecked = null;
      open(row);
    }
  };

  rows.forEach((row) => {
    row.addEventListener('mouseenter', () => attempt(row));
    row.addEventListener('focus', () => open(row));
    row.addEventListener('click', (event) => {
      event.preventDefault();
      clearTimeout(timer);
      open(row);
    });
  });
  menu.addEventListener('mouseleave', () => clearTimeout(timer));
  menu.querySelectorAll('.grv-sub a').forEach((link) => {
    link.addEventListener('click', (event) => event.preventDefault());
  });
})();
