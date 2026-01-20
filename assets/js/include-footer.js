(() => {
  const target = document.getElementById('site-footer');
  if (!target) return;
  fetch('/includes/footer.html')
    .then((response) => {
      if (!response.ok) throw new Error('Failed to load footer');
      return response.text();
    })
    .then((html) => {
      target.innerHTML = html;
    })
    .catch((error) => {
      console.error(error);
    });
})();
