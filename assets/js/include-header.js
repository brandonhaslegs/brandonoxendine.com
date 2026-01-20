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
    })
    .catch((error) => {
      console.error(error);
    });
})();
