(() => {
  document.querySelectorAll('.compare').forEach((compare) => {
    const buttons = compare.querySelectorAll('.compare-toggle button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        compare.dataset.show = button.dataset.version;
        buttons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });
  });
})();
