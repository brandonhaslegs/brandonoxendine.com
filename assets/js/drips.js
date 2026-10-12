(() => {
  // Swap <img data-inline> for inline SVG so icons and emoji pick up the
  // lab's theme tokens. Without JS the images still show, in light colors.
  const inline = async () => {
    const cache = new Map();
    const images = [...document.querySelectorAll('img[data-inline]')];
    await Promise.all(
      images.map(async (img) => {
        const url = img.getAttribute('src');
        if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.text() : '')));
        const markup = await cache.get(url);
        if (!markup) return;
        const holder = document.createElement('span');
        holder.innerHTML = markup;
        const svg = holder.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('width', img.getAttribute('width'));
        svg.setAttribute('height', img.getAttribute('height'));
        if (img.alt) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', img.alt);
        } else {
          svg.setAttribute('aria-hidden', 'true');
        }
        img.replaceWith(svg);
      }),
    );
  };

  // getContrastColor() from the app: black text on bright colors.
  const parseColor = (value) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.appendChild(probe);
    const rgb = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number);
    probe.remove();
    return rgb;
  };
  const contrastText = (value) => {
    const [r, g, b, a = 1] = parseColor(value);
    const brightness = r * 0.299 + g * 0.587 + b * 0.114 + (1 - a) * 255;
    return brightness > 170 ? '#000' : '#fff';
  };
  const toHex = (value) => {
    const [r, g, b] = parseColor(value);
    return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`;
  };

  const lab = document.getElementById('drips-lab');
  const followers = [...document.querySelectorAll('[data-follow="drips-lab"]')];

  // PrimaryColorThemer: re-declare the four primary tokens for one project.
  const themeProject = (el, hex) => {
    const [r, g, b] = parseColor(hex);
    const light = !lab || !lab.dataset.theme;
    const shift = light ? -30 : 30;
    const clamp = (n) => Math.max(0, Math.min(255, n + shift));
    el.style.setProperty('--color-primary', hex);
    el.style.setProperty('--color-primary-level-1', `rgba(${r}, ${g}, ${b}, 0.17)`);
    el.style.setProperty('--color-primary-level-2', `rgba(${r}, ${g}, ${b}, 0.37)`);
    el.style.setProperty('--color-primary-level-6', `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, 1)`);
  };

  const refresh = () => {
    if (!lab) return;
    const styles = getComputedStyle(lab);
    lab.querySelectorAll('[data-token]').forEach((code) => {
      code.textContent = toHex(styles.getPropertyValue(code.dataset.token).trim());
    });
    lab.style.setProperty('--on-primary', contrastText(styles.getPropertyValue('--color-primary').trim()));
    lab.querySelectorAll('.inner.destructive').forEach((el) => {
      el.style.color = contrastText(styles.getPropertyValue('--color-negative').trim());
    });
    document.querySelectorAll('[data-projects] [data-color]').forEach((card) => themeProject(card, card.dataset.color));
  };

  document.querySelectorAll('.drips-segmented').forEach((group) => {
    const attr = `data-${group.dataset.attr}`;
    const buttons = group.querySelectorAll('button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        [lab, ...followers].forEach((el) => {
          if (button.dataset.value) el.setAttribute(attr, button.dataset.value);
          else el.removeAttribute(attr);
        });
        buttons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        refresh();
      });
    });
  });

  const palette = ['#27C537', '#FF5F5F', '#5FB2FF', '#9A5E27', '#9B5DFF', '#FF84DC', '#FFA24B', '#27939A', '#FFAB99', '#FF7020', '#FFC120', '#BD4139', '#5555FF', '#BBA781', '#9BD226'];
  document.querySelectorAll('[data-projects] [data-color]').forEach((card) => {
    const next = () => {
      const index = palette.indexOf(card.dataset.color.toUpperCase());
      card.dataset.color = palette[(index + 1) % palette.length];
      themeProject(card, card.dataset.color);
    };
    // Hover cycles the color with a mouse; touch has no hover, so a tap does.
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') next();
    });
    card.addEventListener('click', (event) => {
      if (event.pointerType !== 'mouse') next();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        next();
      }
    });
  });

  // Simple tabs for the theme screenshots.
  document.querySelectorAll('[data-tabs]').forEach((tabs) => {
    const buttons = tabs.querySelectorAll('[data-tab]');
    const show = (index) => {
      tabs.querySelectorAll('[data-panel]').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.panel === index);
      });
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === index)));
    };
    buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
    show('0');
  });

  refresh();
  inline();
})();
