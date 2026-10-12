(() => {
  // Squiggle geometry from Migaku's UiProgressBar: a start cap, repeating
  // 18px wave segments that overlap by 0.5px, and an end cap.
  const START = 9.61;
  const STEP = 18 - 0.5;
  const END = 18.55;
  const START_PATH =
    'M10 .078v6c-.73.006-1.46.271-2.04.794L5.43 9.15a3 3 0 11-4.015-4.458l2.529-2.278A9.068 9.068 0 0110 .078Z';

  const middle = (n) =>
    `M ${n} 6.078 v -6 C ${2.356 + n} 0.07 ${4.48 + n} 1.006 ${6.243 + n} 2.52 C ${7.05 + n} 3.212 ${7.865 + n} 3.912 ${9 + n} 3.922 c 1.112 -0.01 1.903 -0.65 2.697 -1.34 C ${13.475 + n} 1.038 ${15.601 + n} 0.071 ${18 + n} 0.078 v 6 c -1.232 -0.011 -2.037 0.741 -2.888 1.508 A 9.068 9.068 0 0 1 ${9 + n} 9.922 a 9.068 9.068 0 0 1 -6.112 -2.336 C ${2.038 + n} 6.819 ${1.232 + n} 6.067 ${n} 6.078 Z`;
  const end = (e) =>
    `M ${e} 6.078 v -6 C ${2.753 + e} 0.07 ${4.931 + e} 1.35 ${6.904 + e} 3.128 a 3.09 3.09 0 0 0 4.136 0 L ${13.57 + e} 0.85 a 3 3 0 0 1 4.015 4.458 l -2.529 2.278 a 9.09 9.09 0 0 1 -12.168 0 C ${2.038 + e} 6.819 ${1.232 + e} 6.067 ${e} 6.078 Z`;

  const squigglePath = (width) => {
    const count = Math.max(0, Math.floor((width - START - END) / STEP));
    const parts = [START_PATH];
    for (let i = 0; i < count; i++) parts.push(middle(START + STEP * i));
    parts.push(end(START + STEP * count));
    return parts.join(' ');
  };

  document.querySelectorAll('.mgk-squiggle').forEach((el, index) => {
    const track = el.querySelector('.mgk-squiggle-track');
    const id = `mgk-squiggle-${index}`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs><clipPath id="${id}"><path /></clipPath></defs>`;
    el.prepend(svg);
    track.style.clipPath = `url(#${id})`;
    el.style.setProperty('--progress', `${el.dataset.progress || 66}%`);

    const draw = () => {
      svg.querySelector('path').setAttribute('d', squigglePath(track.getBoundingClientRect().width));
    };
    draw();
    new ResizeObserver(draw).observe(track);

    const fill = () => el.classList.add('is-filled');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          fill();
          observer.disconnect();
        }
      }, { threshold: 0.6 });
      observer.observe(el);
    } else {
      fill();
    }
  });

  // Light / dark switch for the accent table and elevation.
  document.querySelectorAll('.mgk-stage[data-theme]').forEach((stage) => {
    const buttons = stage.querySelectorAll('.mgk-theme-toggle button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        stage.dataset.theme = button.dataset.theme;
        buttons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });
  });
})();
