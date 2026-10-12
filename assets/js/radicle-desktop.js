(() => {
  // Light / dark switch for the component sheet.
  document.querySelectorAll('figure.rds').forEach((figure) => {
    const buttons = figure.querySelectorAll('.rds-toggle button');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        figure.dataset.theme = button.dataset.theme;
        buttons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });
  });
})();
